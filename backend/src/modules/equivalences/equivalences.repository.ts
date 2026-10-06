import { prisma } from '../../lib/prisma.js';

export async function findEquivalence(normalizedA: string, normalizedB: string) {
  return prisma.nameEquivalence.findFirst({
    where: {
      OR: [
        { normalizedA, normalizedB },
        { normalizedA: normalizedB, normalizedB: normalizedA },
      ],
    },
  });
}

export async function createEquivalence(
  normalizedA: string,
  normalizedB: string,
  isSame: boolean,
  originalA?: string,
  originalB?: string
) {
  return prisma.nameEquivalence.create({
    data: {
      normalizedA,
      normalizedB,
      isSame,
      originalA,
      originalB,
    },
  });
}

export async function upsertEquivalence(
  normalizedA: string,
  normalizedB: string,
  isSame: boolean,
  originalA?: string,
  originalB?: string
) {
  const existing = await findEquivalence(normalizedA, normalizedB);
  if (existing) {
    return prisma.nameEquivalence.update({
      where: { id: existing.id },
      data: {
        isSame,
        originalA: originalA ?? existing.originalA,
        originalB: originalB ?? existing.originalB,
      },
    });
  }
  return createEquivalence(normalizedA, normalizedB, isSame, originalA, originalB);
}

export async function getEquivalencesForName(normalizedName: string) {
  return prisma.nameEquivalence.findMany({
    where: {
      OR: [
        { normalizedA: normalizedName },
        { normalizedB: normalizedName },
      ],
    },
  });
}