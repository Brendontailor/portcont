import { prisma } from '../../lib/prisma.js';
import { uploadFile } from '../storage/storage.service.js';
import { parseFile, getSupportedMimeTypes } from '../parsers/index.js';
import { compareBases, saveComparison } from '../matching/comparisonEngine.service.js';
import { recordEquivalence } from '../equivalences/equivalences.service.js';
import * as repo from './comparisons.repository.js';
import { AppError } from '../../middlewares/error.middleware.js';
import type { ComparisonResult, ParsedClient } from '../matching/matching.types.js';

async function parseAndMergeFiles(files: Express.Multer.File[], sideLabel: string) {
  const allClients: ParsedClient[] = [];
  let totalDeclaredRecords = 0;
  let totalExtractedRecords = 0;
  let possiblyIncomplete = false;
  const allWarnings: string[] = [];
  const sourceFiles: { originalName: string; mimeType: string; size: number; buffer: Buffer; declaredRecords: number | undefined; extractedRecords: number }[] = [];

  for (const file of files) {
    const parseResult = await parseFile(file.buffer, { fileName: file.originalname, mimeType: file.mimetype });
    allWarnings.push(...parseResult.warnings.map(w => `[${file.originalname}] ${w}`));
    
    if (parseResult.clients.length === 0) {
      throw new AppError(400, `Não foi possível identificar clientes no arquivo ${file.originalname} (lado ${sideLabel}).`);
    }

    allClients.push(...parseResult.clients);
    totalDeclaredRecords += parseResult.declaredRecords ?? 0;
    totalExtractedRecords += parseResult.extractedRecords;
    possiblyIncomplete = possiblyIncomplete || parseResult.possiblyIncomplete;
    sourceFiles.push({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      declaredRecords: parseResult.declaredRecords,
      extractedRecords: parseResult.extractedRecords,
    });
  }

  // Deduplicar clientes consolidados por normalizedName
  const mergedMap = new Map<string, ParsedClient>();
  for (const client of allClients) {
    const existing = mergedMap.get(client.normalizedName);
    if (existing) {
      existing.occurrences += client.occurrences;
    } else {
      mergedMap.set(client.normalizedName, { ...client });
    }
  }

  return {
    clients: Array.from(mergedMap.values()),
    warnings: allWarnings,
    declaredRecords: totalDeclaredRecords || undefined,
    extractedRecords: totalExtractedRecords,
    possiblyIncomplete,
    sourceFiles,
  };
}

export async function processComparison(
  periodId: string,
  title: string | undefined,
  filesA: Express.Multer.File[],
  filesB: Express.Multer.File[]
) {
  const period = await prisma.partnerPeriod.findUnique({
    where: { id: periodId },
    include: { partner: true },
  });
  if (!period) throw new AppError(404, 'Competência não encontrada');
  if (!period.partner.active) throw new AppError(400, 'Parceira está inativa');

  const [mergeA, mergeB] = await Promise.all([
    parseAndMergeFiles(filesA, 'A'),
    parseAndMergeFiles(filesB, 'B'),
  ]);

  const allWarnings = [...mergeA.warnings, ...mergeB.warnings];

  const [uploadAResults, uploadBResults] = await Promise.all([
    Promise.all(mergeA.sourceFiles.map(f => uploadFile(f.buffer, f.originalName, f.mimeType))),
    Promise.all(mergeB.sourceFiles.map(f => uploadFile(f.buffer, f.originalName, f.mimeType))),
  ]);

  const result = await compareBases(mergeA.clients, mergeB.clients);

  const comparison = await saveComparison(
    periodId,
    title,
    mergeA.sourceFiles.map(f => f.originalName).join(', '),
    mergeB.sourceFiles.map(f => f.originalName).join(', '),
    result,
    mergeA.declaredRecords,
    mergeB.declaredRecords,
    mergeA.possiblyIncomplete,
    mergeB.possiblyIncomplete,
    [
      ...mergeA.sourceFiles.map((f, i) => ({
        side: 'A' as const,
        originalName: f.originalName,
        storageKey: uploadAResults[i]?.key,
        storageUrl: uploadAResults[i]?.url,
        mimeType: f.mimeType,
        size: f.size,
        declaredRecords: f.declaredRecords,
        extractedRecords: f.extractedRecords,
      })),
      ...mergeB.sourceFiles.map((f, i) => ({
        side: 'B' as const,
        originalName: f.originalName,
        storageKey: uploadBResults[i]?.key,
        storageUrl: uploadBResults[i]?.url,
        mimeType: f.mimeType,
        size: f.size,
        declaredRecords: f.declaredRecords,
        extractedRecords: f.extractedRecords,
      })),
    ],
    mergeA.clients,
    mergeB.clients
  );

  return { comparison, warnings: allWarnings };
}

export async function reviewEntry(comparisonId: string, entryId: string, samePerson: boolean) {
  const entry = await prisma.comparisonEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new AppError(404, 'Entrada não encontrada');
  if (entry.comparisonId !== comparisonId) throw new AppError(400, 'Entrada não pertence a esta comparação');

  const hasBothSides = Boolean(entry.originalA && entry.originalB);

  if (entry.normalizedA && entry.normalizedB) {
    await recordEquivalence(entry.normalizedA, entry.normalizedB, samePerson, entry.originalA ?? undefined, entry.originalB ?? undefined);
  }

  if (samePerson) {
    const occurrencesA = entry.occurrencesA ?? 1;
    const occurrencesB = entry.occurrencesB ?? 1;
    const matchedOccurrences = Math.min(occurrencesA, occurrencesB);
    await prisma.comparisonEntry.update({
      where: { id: entryId },
      data: { status: 'MATCHED', occurrencesA: matchedOccurrences, occurrencesB: matchedOccurrences },
    });
    if (occurrencesA > matchedOccurrences) {
      await prisma.comparisonEntry.create({
        data: {
          comparisonId,
          originalA: entry.originalA,
          normalizedA: entry.normalizedA,
          occurrencesA: occurrencesA - matchedOccurrences,
          status: 'ONLY_A',
        },
      });
    }
    if (occurrencesB > matchedOccurrences) {
      await prisma.comparisonEntry.create({
        data: {
          comparisonId,
          originalB: entry.originalB,
          normalizedB: entry.normalizedB,
          occurrencesB: occurrencesB - matchedOccurrences,
          status: 'ONLY_B',
        },
      });
    }
  } else if (hasBothSides) {
    await prisma.comparisonEntry.update({
      where: { id: entryId },
      data: { status: 'ONLY_A', originalB: null, normalizedB: null, occurrencesB: null },
    });
    await prisma.comparisonEntry.create({
      data: {
        comparisonId,
        originalB: entry.originalB,
        normalizedB: entry.normalizedB,
        occurrencesB: entry.occurrencesB,
        status: 'ONLY_B',
      },
    });
  } else if (entry.originalA) {
    await repo.updateEntryStatus(entryId, 'ONLY_A');
  } else {
    await repo.updateEntryStatus(entryId, 'ONLY_B');
  }

  const entries = await prisma.comparisonEntry.findMany({ where: { comparisonId } });
  const comparison = await prisma.comparison.findUnique({ where: { id: comparisonId } });
  if (comparison) {
    const countSide = (side: 'A' | 'B', status?: string) => entries.reduce((total, item) => {
      if (status && item.status !== status) return total;
      const name = side === 'A' ? item.originalA : item.originalB;
      const occurrences = side === 'A' ? item.occurrencesA : item.occurrencesB;
      return total + (name ? occurrences ?? 1 : 0);
    }, 0);
    const countStatus = (status: string) => entries.reduce((total, item) => {
      if (item.status !== status) return total;
      if (status === 'REVIEW') return total + Math.min(item.occurrencesA ?? 1, item.occurrencesB ?? 1);
      return total + (item.occurrencesA ?? item.occurrencesB ?? 1);
    }, 0);
    await prisma.comparison.update({
      where: { id: comparisonId },
      data: {
        totalA: countSide('A'),
        totalB: countSide('B'),
        matchedCount: countStatus('MATCHED'),
        onlyACount: countStatus('ONLY_A'),
        onlyBCount: countStatus('ONLY_B'),
        reviewCount: countStatus('REVIEW'),
      },
    });
  }

  return repo.getComparisonById(comparisonId);
}

export const getComparisonById = repo.getComparisonById;
export const listComparisons = repo.listComparisons;
export const deleteComparison = repo.deleteComparison;

export function getSupportedMimeTypesList() {
  return getSupportedMimeTypes();
}
