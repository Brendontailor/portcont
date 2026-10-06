import { prisma } from '../../lib/prisma.js';
import { findEquivalence, upsertEquivalence, getEquivalencesForName } from './equivalences.repository.js';

export async function recordEquivalence(
  normalizedA: string,
  normalizedB: string,
  isSame: boolean,
  originalA?: string,
  originalB?: string
) {
  return upsertEquivalence(normalizedA, normalizedB, isSame, originalA, originalB);
}

export async function getEquivalence(normalizedA: string, normalizedB: string) {
  return findEquivalence(normalizedA, normalizedB);
}

export async function getAllEquivalencesForName(normalizedName: string) {
  return getEquivalencesForName(normalizedName);
}

export async function getEquivalencesByComparison(comparisonId: string) {
  const entries = await prisma.comparisonEntry.findMany({
    where: { comparisonId, status: 'REVIEW' },
    select: { normalizedA: true, normalizedB: true, originalA: true, originalB: true },
  });

  const equivalences = new Map<string, boolean>();

  for (const entry of entries) {
    if (entry.normalizedA && entry.normalizedB) {
      const key = `${entry.normalizedA}|${entry.normalizedB}`;
      equivalences.set(key, false);
    }
  }

  return equivalences;
}