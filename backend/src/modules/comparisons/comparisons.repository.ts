import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middlewares/error.middleware.js';
import type { ComparisonResult, ParsedClient } from '../matching/matching.types.js';

export async function createComparison(
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
  return prisma.comparison.create({
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
            status: 'MATCHED' as const,
          })),
          ...result.review.map(m => ({
            originalA: m.clientA.originalName,
            normalizedA: m.clientA.normalizedName,
            originalB: m.clientB.originalName,
            normalizedB: m.clientB.normalizedName,
            occurrencesA: m.clientA.occurrences,
            occurrencesB: m.clientB.occurrences,
            similarity: m.similarity,
            status: 'REVIEW' as const,
          })),
          ...result.onlyA.map(c => ({
            originalA: c.originalName,
            normalizedA: c.normalizedName,
            occurrencesA: c.occurrences,
            status: 'ONLY_A' as const,
          })),
          ...result.onlyB.map(c => ({
            originalB: c.originalName,
            normalizedB: c.normalizedName,
            occurrencesB: c.occurrences,
            status: 'ONLY_B' as const,
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
}

export async function getComparisonById(id: string) {
  const comparison = await prisma.comparison.findUnique({
    where: { id },
    include: {
      entries: { orderBy: { createdAt: 'asc' } },
      sourceFiles: true,
      clients: { orderBy: { originalName: 'asc' } },
      period: { include: { partner: true } },
    },
  });
  if (!comparison) throw new AppError(404, 'Comparação não encontrada');
  return comparison;
}

export async function listComparisons(periodId?: string, page = 1, limit = 20) {
  const where = periodId ? { periodId } : {};
  const [items, total] = await Promise.all([
    prisma.comparison.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { period: { include: { partner: true } } },
    }),
    prisma.comparison.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateEntryStatus(entryId: string, status: 'MATCHED' | 'ONLY_A' | 'ONLY_B' | 'REVIEW') {
  return prisma.comparisonEntry.update({
    where: { id: entryId },
    data: { status },
  });
}

export async function deleteComparison(id: string) {
  return prisma.comparison.delete({ where: { id } });
}