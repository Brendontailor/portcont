import { env } from '../../config/env.js';
import type { NormalizedName } from './matching.types.js';

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

  const matchWindow = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

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

function tokenSetSimilarity(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...tokensA, ...tokensB]).size;

  if (union === 0) return 0;
  return intersection / union;
}

function tokenOrderSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const minLen = Math.min(tokensA.length, tokensB.length);
  let matches = 0;

  for (let i = 0; i < minLen; i++) {
    if (tokensA[i] === tokensB[i]) matches++;
  }

  return matches / Math.max(tokensA.length, tokensB.length);
}

function firstNameSimilarity(nameA: NormalizedName, nameB: NormalizedName): number {
  if (!nameA.firstName || !nameB.firstName) return 0;
  return jaroWinkler(nameA.firstName, nameB.firstName);
}

function lastNameSimilarity(nameA: NormalizedName, nameB: NormalizedName): number {
  if (!nameA.lastName || !nameB.lastName) return 0;
  return jaroWinkler(nameA.lastName, nameB.lastName);
}

function mainTokenSimilarity(nameA: NormalizedName, nameB: NormalizedName): number {
  const { main: mainA } = getNameTokens(nameA.normalized);
  const { main: mainB } = getNameTokens(nameB.normalized);

  if (mainA.length === 0 && mainB.length === 0) return 1;
  if (mainA.length === 0 || mainB.length === 0) return 0;

  return tokenSetSimilarity(mainA, mainB);
}

function getNameTokens(normalized: string): { main: string[]; particles: string[] } {
  const NAME_PARTICLES = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
  const main: string[] = [];
  const particles: string[] = [];

  for (const token of tokens) {
    if (NAME_PARTICLES.has(token)) {
      particles.push(token);
    } else {
      main.push(token);
    }
  }

  return { main, particles };
}

function nameLengthPenalty(nameA: NormalizedName, nameB: NormalizedName): number {
  const lenA = nameA.normalized.length;
  const lenB = nameB.normalized.length;
  const ratio = Math.min(lenA, lenB) / Math.max(lenA, lenB);
  return ratio;
}

function wordCountPenalty(nameA: NormalizedName, nameB: NormalizedName): number {
  const countA = nameA.tokens.length;
  const countB = nameB.tokens.length;
  const diff = Math.abs(countA - countB);
  if (diff === 0) return 1;
  if (diff === 1) return 0.9;
  if (diff === 2) return 0.75;
  return 0.5;
}

function conflictingTokensPenalty(nameA: NormalizedName, nameB: NormalizedName): number {
  const { main: mainA } = getNameTokens(nameA.normalized);
  const { main: mainB } = getNameTokens(nameB.normalized);

  if (mainA.length === 0 || mainB.length === 0) return 1;

  const setA = new Set(mainA);
  const setB = new Set(mainB);

  let conflicts = 0;
  for (const token of setA) {
    if (!setB.has(token)) {
      const similar = [...setB].some(t => jaroWinkler(token, t) > 0.85);
      if (!similar) conflicts++;
    }
  }

  if (conflicts >= 2) return 0.5;
  if (conflicts === 1) return 0.8;
  return 1;
}

function shortNamePenalty(nameA: NormalizedName, nameB: NormalizedName): number {
  const minTokens = Math.min(nameA.tokens.length, nameB.tokens.length);
  if (minTokens <= 2) return 0.85;
  return 1;
}

export function calculateSimilarity(
  normalizedA: NormalizedName,
  normalizedB: NormalizedName
): number {
  const exactMatch = normalizedA.normalized === normalizedB.normalized;
  if (exactMatch) return 100;

  const jaro = jaroWinkler(normalizedA.normalized, normalizedB.normalized) * 100;
  const levenshtein = (1 - levenshteinDistance(normalizedA.normalized, normalizedB.normalized) / Math.max(normalizedA.normalized.length, normalizedB.normalized.length)) * 100;
  const tokenSet = tokenSetSimilarity(normalizedA.tokens, normalizedB.tokens) * 100;
  const tokenOrder = tokenOrderSimilarity(normalizedA.tokens, normalizedB.tokens) * 100;
  const firstNameSim = firstNameSimilarity(normalizedA, normalizedB) * 100;
  const lastNameSim = lastNameSimilarity(normalizedA, normalizedB) * 100;
  const mainTokenSim = mainTokenSimilarity(normalizedA, normalizedB) * 100;

  let score = 0;
  score += jaro * 0.20;
  score += levenshtein * 0.15;
  score += tokenSet * 0.20;
  score += tokenOrder * 0.10;
  score += firstNameSim * 0.15;
  score += lastNameSim * 0.10;
  score += mainTokenSim * 0.10;

  const lengthPenalty = nameLengthPenalty(normalizedA, normalizedB);
  const wordPenalty = wordCountPenalty(normalizedA, normalizedB);
  const conflictPenalty = conflictingTokensPenalty(normalizedA, normalizedB);
  const shortPenalty = shortNamePenalty(normalizedA, normalizedB);

  score *= lengthPenalty * wordPenalty * conflictPenalty * shortPenalty;

  if (normalizedA.firstName !== normalizedB.firstName && normalizedA.firstName && normalizedB.firstName) {
    score *= 0.6;
  }

  if (normalizedA.lastName !== normalizedB.lastName && normalizedA.lastName && normalizedB.lastName) {
    score *= 0.7;
  }

  if (normalizedA.tokens.length <= 2 || normalizedB.tokens.length <= 2) {
    score *= 0.9;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyMatch(score: number): 'MATCHED' | 'REVIEW' | 'DIFFERENT' {
  const { MATCH_THRESHOLD, REVIEW_THRESHOLD } = env;
  if (score >= MATCH_THRESHOLD) return 'MATCHED';
  if (score >= REVIEW_THRESHOLD) return 'REVIEW';
  return 'DIFFERENT';
}