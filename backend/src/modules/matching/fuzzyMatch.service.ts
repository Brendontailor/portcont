import { env } from '../../config/env.js';
import type { NormalizedName } from './matching.types.js';
import { getNameTokens } from './normalizeName.service.js';

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);

  for (let j = 1; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);

    for (let j = start; j < end; j++) {
      if (!bMatches[j] && a[i] === b[j]) {
        aMatches[i] = true;
        bMatches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (aMatches[i]) {
      while (!bMatches[k]) k++;
      if (a[i] !== b[k]) transpositions++;
      k++;
    }
  }

  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(a.length, b.length, 4); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + 0.1 * prefix * (1 - jaro);
}

function fuzzyTokenSetSimilarity(mainA: string[], mainB: string[]): number {
  const setB = new Set(mainB);
  const usedB = new Set<string>();
  let intersection = 0;

  for (const t of mainA) {
    if (setB.has(t) && !usedB.has(t)) {
      intersection += 1;
      usedB.add(t);
      continue;
    }
    for (const b of mainB) {
      if (usedB.has(b)) continue;
      const s = jaroWinkler(t, b);
      if (s >= 0.85) {
        intersection += s;
        usedB.add(b);
        break;
      }
    }
  }

  const union = mainA.length + mainB.length - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

function bestTokenMatch(token: string, tokens: string[]): number {
  let best = 0;
  for (const t of tokens) {
    const s = token === t ? 1 : jaroWinkler(token, t);
    if (s > best) best = s;
    if (best === 1) break;
  }
  return best;
}

function wordLevelSimilarity(mainA: string[], mainB: string[]): number {
  if (mainA.length === 0 || mainB.length === 0) return 0;
  const sumA = mainA.reduce((acc, t) => acc + bestTokenMatch(t, mainB), 0) / mainA.length;
  const sumB = mainB.reduce((acc, t) => acc + bestTokenMatch(t, mainA), 0) / mainB.length;
  return (sumA + sumB) / 2;
}

function positionalSimilarity(mainA: string[], mainB: string[]): number {
  const len = Math.max(mainA.length, mainB.length);
  if (len === 0) return 1;
  let matches = 0;
  const minLen = Math.min(mainA.length, mainB.length);
  for (let i = 0; i < minLen; i++) {
    if (mainA[i] === mainB[i] || jaroWinkler(mainA[i], mainB[i]) >= 0.92) matches++;
  }
  return matches / len;
}

function countConflictingTokens(mainA: string[], mainB: string[]): number {
  const setB = new Set(mainB);
  let conflicts = 0;
  for (const t of mainA) {
    if (setB.has(t)) continue;
    const hasSimilar = mainB.some(b => jaroWinkler(t, b) >= 0.85);
    if (!hasSimilar) conflicts++;
  }
  return conflicts;
}

export function calculateSimilarity(a: NormalizedName, b: NormalizedName): number {
  if (a.normalized === b.normalized) return 100;

  const { main: mainA } = getNameTokens(a.normalized);
  const { main: mainB } = getNameTokens(b.normalized);

  // Do not match records with too little identifying information: an initial
  // or a single common word is not enough to establish a person's identity.
  if (mainA.length < 2 || mainB.length < 2) return 0;

  const jw = jaroWinkler(a.normalized, b.normalized) * 100;
  const lev = (1 - levenshteinDistance(a.normalized, b.normalized) / Math.max(a.normalized.length, b.normalized.length)) * 100;
  const wordSim = wordLevelSimilarity(mainA, mainB) * 100;
  const tokenSet = fuzzyTokenSetSimilarity(mainA, mainB) * 100;
  const order = positionalSimilarity(mainA, mainB) * 100;
  const first = a.firstName && b.firstName ? jaroWinkler(a.firstName, b.firstName) * 100 : 0;
  const last = a.lastName && b.lastName ? jaroWinkler(a.lastName, b.lastName) * 100 : 0;

  let score =
    wordSim * 0.30 +
    tokenSet * 0.20 +
    order * 0.05 +
    first * 0.15 +
    last * 0.10 +
    jw * 0.10 +
    lev * 0.10;

  const conflicts = countConflictingTokens(mainA, mainB) + countConflictingTokens(mainB, mainA);
  if (conflicts >= 2) score *= 0.5;
  else if (conflicts === 1) score *= 0.8;

  const result = Math.max(0, Math.min(100, Math.round(score)));

  // Spelling similarity is not proof of identity. Keep differing name tokens
  // for review, even when a small typo produces a very high score.
  const sameTokens = mainA.length === mainB.length && mainA.every((token, i) => token === mainB[i]);
  return sameTokens ? result : Math.min(result, env.MATCH_THRESHOLD - 1);
}

export function hasCommonTokenSignal(a: NormalizedName, b: NormalizedName): boolean {
  const { main: mainA } = getNameTokens(a.normalized);
  const { main: mainB } = getNameTokens(b.normalized);

  if (mainA.length === 0 || mainB.length === 0) return false;

  for (const t of mainA) {
    if (mainB.includes(t)) return true;
  }
  for (const t of mainA) {
    for (const u of mainB) {
      if (jaroWinkler(t, u) >= 0.85) return true;
    }
  }
  return false;
}

export function classifyMatch(score: number): 'MATCHED' | 'REVIEW' | 'DIFFERENT' {
  const { MATCH_THRESHOLD, REVIEW_THRESHOLD } = env;
  if (score >= MATCH_THRESHOLD) return 'MATCHED';
  if (score >= REVIEW_THRESHOLD) return 'REVIEW';
  return 'DIFFERENT';
}
