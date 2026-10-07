import { prisma } from '../../lib/prisma.js';
import { uploadFile } from '../storage/storage.service.js';
import { parseFile, getSupportedMimeTypes } from '../parsers/index.js';
import { compareBases, saveComparison } from '../matching/comparisonEngine.service.js';
import { recordEquivalence } from '../equivalences/equivalences.service.js';
import * as repo from './comparisons.repository.js';
import { AppError } from '../../middlewares/error.middleware.js';
import type { ComparisonResult, ParsedClient } from '../matching/matching.types.js';

export async function processComparison(
  periodId: string,
  title: string | undefined,
  fileA: Express.Multer.File,
  fileB: Express.Multer.File
) {
  const period = await prisma.partnerPeriod.findUnique({
    where: { id: periodId },
    include: { partner: true },
  });
  if (!period) throw new AppError(404, 'Competência não encontrada');
  if (!period.partner.active) throw new AppError(400, 'Parceira está inativa');

  const [parseResultA, parseResultB] = await Promise.all([
    parseFile(fileA.buffer, { fileName: fileA.originalname, mimeType: fileA.mimetype }),
    parseFile(fileB.buffer, { fileName: fileB.originalname, mimeType: fileB.mimetype }),
  ]);

  const allWarnings = [...parseResultA.warnings, ...parseResultB.warnings];

  if (parseResultA.clients.length === 0 || parseResultB.clients.length === 0) {
    if (parseResultA.clients.length === 0 && parseResultB.clients.length === 0) {
      throw new AppError(400, 'Não foi possível identificar clientes nos dois arquivos enviados.');
    }
    throw new AppError(400, parseResultA.clients.length === 0
      ? 'Não foi possível identificar clientes no arquivo A.'
      : 'Não foi possível identificar clientes no arquivo B.');
  }

  const [uploadA, uploadB] = await Promise.all([
    uploadFile(fileA.buffer, fileA.originalname, fileA.mimetype),
    uploadFile(fileB.buffer, fileB.originalname, fileB.mimetype),
  ]);

  const result = await compareBases(parseResultA.clients, parseResultB.clients);

  const comparison = await saveComparison(
    periodId,
    title,
    fileA.originalname,
    fileB.originalname,
    result,
    parseResultA.declaredRecords,
    parseResultB.declaredRecords,
    parseResultA.possiblyIncomplete,
    parseResultB.possiblyIncomplete,
    [
      { side: 'A', originalName: fileA.originalname, storageKey: uploadA?.key, storageUrl: uploadA?.url, mimeType: fileA.mimetype, size: fileA.size, declaredRecords: parseResultA.declaredRecords, extractedRecords: parseResultA.extractedRecords },
      { side: 'B', originalName: fileB.originalname, storageKey: uploadB?.key, storageUrl: uploadB?.url, mimeType: fileB.mimetype, size: fileB.size, declaredRecords: parseResultB.declaredRecords, extractedRecords: parseResultB.extractedRecords },
    ],
    parseResultA.clients,
    parseResultB.clients
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
