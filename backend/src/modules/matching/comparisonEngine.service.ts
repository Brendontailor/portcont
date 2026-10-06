import { prisma } from '../../lib/prisma.js';
import { createNormalizedName, normalizeName } from './normalizeName.service.js';
import { calculateSimilarity, classifyMatch } from './fuzzyMatch.service.js';
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

function createCandidates(
  clientsA: ParsedClient[],
  clientsB: ParsedClient[],
  equivalences: Map<string, Map<string, boolean>>
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  const normalizedB = new Map<string, ParsedClient>();
  for (const client of clientsB) {
    normalizedB.set(client.normalizedName, client);
  }

  const remainingA = [...clientsA];
  const remainingB = new Map(normalizedB);

  for (const clientA of remainingA) {
    const exactMatch = remainingB.get(clientA.normalizedName);
    if (exactMatch) {
      candidates.push({
        clientA,
        clientB: exactMatch,
        similarity: 100,
      });
      remainingB.delete(clientA.normalizedName);
    }
  }

  const unmatchedA = remainingA.filter(a => !candidates.some(c => c.clientA === a));

  for (const clientA of unmatchedA) {
    const equivMap = equivalences.get(clientA.normalizedName);
    if (equivMap) {
      for (const [normalizedBKey, isSame] of equivMap) {
        if (isSame) {
          const match = remainingB.get(normalizedBKey);
          if (match) {
            candidates.push({
              clientA,
              clientB: match,
              similarity: 100,
            });
            remainingB.delete(normalizedBKey);
            break;
          }
        }
      }
    }
  }

  const stillUnmatchedA = unmatchedA.filter(a => !candidates.some(c => c.clientA === a));

  for (const clientA of stillUnmatchedA) {
    const normalizedA = createNormalizedName(clientA.originalName);

    for (const clientB of remainingB.values()) {
      const normalizedB = createNormalizedName(clientB.originalName);

      if (
        normalizedA.firstName && normalizedB.firstName &&
        normalizedA.firstName !== normalizedB.firstName
      ) {
        continue;
      }

      if (
        normalizedA.lastName && normalizedB.lastName &&
        normalizedA.lastName !== normalizedB.lastName
      ) {
        const sim = calculateSimilarity(normalizedA, normalizedB);
        if (sim < 60) continue;
      }

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
  const matchedANames = new Set<string>();
  const matchedBNames = new Set<string>();

  for (const candidate of resolved) {
    const classification = classifyMatch(candidate.similarity);
    if (classification === 'MATCHED') {
      matched.push(candidate);
      matchedANames.add(candidate.clientA.normalizedName);
      matchedBNames.add(candidate.clientB.normalizedName);
    } else if (classification === 'REVIEW') {
      review.push(candidate);
      matchedANames.add(candidate.clientA.normalizedName);
      matchedBNames.add(candidate.clientB.normalizedName);
    }
  }

  const onlyA = dedupedA.filter(c => !matchedANames.has(c.normalizedName));
  const onlyB = dedupedB.filter(c => !matchedBNames.has(c.normalizedName));

  return {
    matched,
    onlyA,
    onlyB,
    review,
    stats: {
      totalA: dedupedA.length,
      totalB: dedupedB.length,
      matchedCount: matched.length,
      onlyACount: onlyA.length,
      onlyBCount: onlyB.length,
      reviewCount: review.length,
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
    },
  });

  return comparison;
}