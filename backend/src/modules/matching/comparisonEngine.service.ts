import { prisma } from '../../lib/prisma.js';
import { createNormalizedName, getNameTokens } from './normalizeName.service.js';
import { calculateSimilarity, classifyMatch, hasCommonTokenSignal } from './fuzzyMatch.service.js';
import { env } from '../../config/env.js';
import type { ParsedClient, MatchCandidate, ComparisonResult, MatchStatus } from './matching.types.js';

function deduplicateClients(clients: ParsedClient[]): ParsedClient[] {
  const map = new Map<string, ParsedClient>();
  for (const client of clients) {
    const existing = map.get(client.normalizedName);
    if (existing) {
      existing.occurrences += client.occurrences;
    } else {
      map.set(client.normalizedName, { ...client });
    }
  }
  return Array.from(map.values());
}

function tokenBlocks(token: string): string[] {
  const blocks = [`exact:${token}`];
  if (token.length >= 3) blocks.push(`prefix:${token.slice(0, 3)}`);
  // A shared deletion signature also catches a typo in the first letters.
  // These blocks only propose candidates; similarity still decides the result.
  if (token.length >= 4) {
    blocks.push(`edit:${token}`);
    for (let i = 0; i < token.length; i++) blocks.push(`edit:${token.slice(0, i)}${token.slice(i + 1)}`);
  }
  return blocks;
}

function buildTokenIndex(clients: ParsedClient[]): Map<string, Set<ParsedClient>> {
  const index = new Map<string, Set<ParsedClient>>();
  for (const client of clients) {
    const { main } = getNameTokens(client.normalizedName);
    const blocks = new Set<string>();
    for (const token of main) {
      for (const block of tokenBlocks(token)) blocks.add(block);
    }
    for (const block of blocks) {
      let set = index.get(block);
      if (!set) {
        set = new Set();
        index.set(block, set);
      }
      set.add(client);
    }
  }
  return index;
}

function getCandidateSet(client: ParsedClient, index: Map<string, Set<ParsedClient>>): Set<ParsedClient> {
  const { main } = getNameTokens(client.normalizedName);
  const candidates = new Set<ParsedClient>();
  for (const token of main) {
    for (const key of tokenBlocks(token)) {
      const block = index.get(key);
      if (block) for (const c of block) candidates.add(c);
    }
  }
  return candidates;
}

function createCandidates(
  clientsA: ParsedClient[],
  clientsB: ParsedClient[],
  equivalences: Map<string, Map<string, boolean>>
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  const normalizedBCache = new Map<string, ParsedClient>();
  for (const client of clientsB) {
    normalizedBCache.set(client.normalizedName, client);
  }

  const remainingB = new Map(normalizedBCache);
  const matchedAKeys = new Set<string>();

  // 1. Matches exatos por normalizedName
  for (const clientA of clientsA) {
    const exact = remainingB.get(clientA.normalizedName);
    if (exact) {
      candidates.push({ clientA, clientB: exact, similarity: 100 });
      remainingB.delete(clientA.normalizedName);
      matchedAKeys.add(clientA.normalizedName);
    }
  }

  // 2. Equivalências manuais conhecidas
  for (const clientA of clientsA) {
    if (matchedAKeys.has(clientA.normalizedName)) continue;
    const equivMap = equivalences.get(clientA.normalizedName);
    if (!equivMap) continue;
    for (const [normalizedBKey, isSame] of equivMap) {
      if (!isSame) continue;
      const match = remainingB.get(normalizedBKey);
      if (match) {
        candidates.push({ clientA, clientB: match, similarity: 100 });
        remainingB.delete(normalizedBKey);
        matchedAKeys.add(clientA.normalizedName);
        break;
      }
    }
  }

  // 3. Fuzzy matching com pré-filtragem por blocos de tokens
  const tokenIndex = buildTokenIndex([...remainingB.values()]);
  const nameCache = new Map<string, ReturnType<typeof createNormalizedName>>();

  for (const clientA of clientsA) {
    if (matchedAKeys.has(clientA.normalizedName)) continue;

    let normalizedA = nameCache.get(clientA.normalizedName);
    if (!normalizedA) {
      normalizedA = createNormalizedName(clientA.originalName);
      nameCache.set(clientA.normalizedName, normalizedA);
    }

    const possibleB = getCandidateSet(clientA, tokenIndex);

    for (const clientB of possibleB) {
      if (!remainingB.has(clientB.normalizedName)) continue;
      if (equivalences.get(clientA.normalizedName)?.get(clientB.normalizedName) === false) continue;

      let normalizedB = nameCache.get(clientB.normalizedName);
      if (!normalizedB) {
        normalizedB = createNormalizedName(clientB.originalName);
        nameCache.set(clientB.normalizedName, normalizedB);
      }

      if (!hasCommonTokenSignal(normalizedA, normalizedB)) continue;

      const similarity = calculateSimilarity(normalizedA, normalizedB);
      if (similarity >= env.REVIEW_THRESHOLD) {
        candidates.push({ clientA, clientB, similarity });
      }
    }
  }

  return candidates;
}

function resolveOneToOneMatches(candidates: MatchCandidate[]): MatchCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.similarity - a.similarity);
  const matchedA = new Set<string>();
  const matchedB = new Set<string>();
  const resolved: MatchCandidate[] = [];

  for (const candidate of sorted) {
    const keyA = candidate.clientA.normalizedName;
    const keyB = candidate.clientB.normalizedName;

    if (!matchedA.has(keyA) && !matchedB.has(keyB)) {
      resolved.push(candidate);
      matchedA.add(keyA);
      matchedB.add(keyB);
    }
  }

  return resolved;
}

async function loadEquivalences(): Promise<Map<string, Map<string, boolean>>> {
  const equivalences = await prisma.nameEquivalence.findMany();
  const map = new Map<string, Map<string, boolean>>();

  for (const eq of equivalences) {
    if (!map.has(eq.normalizedA)) {
      map.set(eq.normalizedA, new Map());
    }
    map.get(eq.normalizedA)!.set(eq.normalizedB, eq.isSame);

    if (!map.has(eq.normalizedB)) {
      map.set(eq.normalizedB, new Map());
    }
    map.get(eq.normalizedB)!.set(eq.normalizedA, eq.isSame);
  }

  return map;
}

export async function compareBases(
  clientsA: ParsedClient[],
  clientsB: ParsedClient[]
): Promise<ComparisonResult> {
  const dedupedA = deduplicateClients(clientsA);
  const dedupedB = deduplicateClients(clientsB);

  const equivalences = await loadEquivalences();
  const candidates = createCandidates(dedupedA, dedupedB, equivalences);
  const resolved = resolveOneToOneMatches(candidates);

  const matched: MatchCandidate[] = [];
  const review: MatchCandidate[] = [];
  const reviewANames = new Set<string>();
  const reviewBNames = new Set<string>();
  const matchedOccurrencesA = new Map<string, number>();
  const matchedOccurrencesB = new Map<string, number>();

  for (const candidate of resolved) {
    const classification = classifyMatch(candidate.similarity);
    if (classification === 'MATCHED') {
      const pairedOccurrences = Math.min(candidate.clientA.occurrences, candidate.clientB.occurrences);
      matched.push({
        ...candidate,
        clientA: { ...candidate.clientA, occurrences: pairedOccurrences },
        clientB: { ...candidate.clientB, occurrences: pairedOccurrences },
      });
      matchedOccurrencesA.set(candidate.clientA.normalizedName, pairedOccurrences);
      matchedOccurrencesB.set(candidate.clientB.normalizedName, pairedOccurrences);
    } else if (classification === 'REVIEW') {
      review.push(candidate);
      reviewANames.add(candidate.clientA.normalizedName);
      reviewBNames.add(candidate.clientB.normalizedName);
    }
  }

  const onlyA = dedupedA.flatMap(client => {
    if (reviewANames.has(client.normalizedName)) return [];
    const remainingOccurrences = client.occurrences - (matchedOccurrencesA.get(client.normalizedName) ?? 0);
    return remainingOccurrences > 0 ? [{ ...client, occurrences: remainingOccurrences }] : [];
  });
  const onlyB = dedupedB.flatMap(client => {
    if (reviewBNames.has(client.normalizedName)) return [];
    const remainingOccurrences = client.occurrences - (matchedOccurrencesB.get(client.normalizedName) ?? 0);
    return remainingOccurrences > 0 ? [{ ...client, occurrences: remainingOccurrences }] : [];
  });
  const totalOccurrencesA = dedupedA.reduce((total, client) => total + client.occurrences, 0);
  const totalOccurrencesB = dedupedB.reduce((total, client) => total + client.occurrences, 0);

  return {
    matched,
    onlyA,
    onlyB,
    review,
    stats: {
      totalA: totalOccurrencesA,
      totalB: totalOccurrencesB,
      matchedCount: matched.reduce((total, candidate) => total + candidate.clientA.occurrences, 0),
      onlyACount: onlyA.reduce((total, client) => total + client.occurrences, 0),
      onlyBCount: onlyB.reduce((total, client) => total + client.occurrences, 0),
      reviewCount: review.reduce((total, candidate) => total + Math.min(candidate.clientA.occurrences, candidate.clientB.occurrences), 0),
    },
  };
}

export async function saveComparison(
  periodId: string,
  title: string | undefined,
  fileAName: string,
  fileBName: string,
  result: ComparisonResult,
  declaredA: number | undefined,
  declaredB: number | undefined,
  incompleteA: boolean,
  incompleteB: boolean,
  sourceFiles: { side: 'A' | 'B'; originalName: string; storageKey?: string; storageUrl?: string; mimeType: string; size: number; declaredRecords?: number; extractedRecords?: number }[],
  clientsA: ParsedClient[],
  clientsB: ParsedClient[]
) {
  const comparison = await prisma.comparison.create({
    data: {
      periodId,
      title,
      fileAName,
      fileBName,
      totalA: result.stats.totalA,
      totalB: result.stats.totalB,
      matchedCount: result.stats.matchedCount,
      onlyACount: result.stats.onlyACount,
      onlyBCount: result.stats.onlyBCount,
      reviewCount: result.stats.reviewCount,
      declaredA,
      declaredB,
      incompleteA,
      incompleteB,
      entries: {
        create: [
          ...result.matched.map(m => ({
            originalA: m.clientA.originalName,
            normalizedA: m.clientA.normalizedName,
            originalB: m.clientB.originalName,
            normalizedB: m.clientB.normalizedName,
            occurrencesA: m.clientA.occurrences,
            occurrencesB: m.clientB.occurrences,
            similarity: m.similarity,
            status: 'MATCHED' as MatchStatus,
          })),
          ...result.review.map(m => ({
            originalA: m.clientA.originalName,
            normalizedA: m.clientA.normalizedName,
            originalB: m.clientB.originalName,
            normalizedB: m.clientB.normalizedName,
            occurrencesA: m.clientA.occurrences,
            occurrencesB: m.clientB.occurrences,
            similarity: m.similarity,
            status: 'REVIEW' as MatchStatus,
          })),
          ...result.onlyA.map(c => ({
            originalA: c.originalName,
            normalizedA: c.normalizedName,
            occurrencesA: c.occurrences,
            status: 'ONLY_A' as MatchStatus,
          })),
          ...result.onlyB.map(c => ({
            originalB: c.originalName,
            normalizedB: c.normalizedName,
            occurrencesB: c.occurrences,
            status: 'ONLY_B' as MatchStatus,
          })),
        ],
      },
      sourceFiles: {
        create: sourceFiles.map(f => ({
          side: f.side,
          originalName: f.originalName,
          storageKey: f.storageKey,
          storageUrl: f.storageUrl,
          mimeType: f.mimeType,
          size: f.size,
          declaredRecords: f.declaredRecords,
          extractedRecords: f.extractedRecords,
        })),
      },
      clients: {
        create: [
          ...clientsA.map(c => ({
            side: 'A' as const,
            originalName: c.originalName,
            normalizedName: c.normalizedName,
            occurrences: c.occurrences,
          })),
          ...clientsB.map(c => ({
            side: 'B' as const,
            originalName: c.originalName,
            normalizedName: c.normalizedName,
            occurrences: c.occurrences,
          })),
        ],
      },
    },
    include: {
      entries: true,
      sourceFiles: true,
      clients: true,
      period: { include: { partner: true } },
    },
  });

  return comparison;
}
