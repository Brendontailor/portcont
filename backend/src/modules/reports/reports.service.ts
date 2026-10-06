import { prisma } from '../../lib/prisma.js';
import { generateComparisonXLSX, generateMonthlyReportXLSX, generateAnnualReportXLSX } from '../export/export.service.js';
import { AppError } from '../../middlewares/error.middleware.js';

export async function getComparisonReport(comparisonId: string) {
  const comparison = await prisma.comparison.findUnique({
    where: { id: comparisonId },
    include: {
      entries: { orderBy: { createdAt: 'asc' } },
      clients: { orderBy: { originalName: 'asc' } },
      sourceFiles: true,
      period: { include: { partner: true } },
    },
  });
  if (!comparison) throw new AppError(404, 'Comparação não encontrada');

  const clientsA = comparison.clients.filter(c => c.side === 'A');
  const clientsB = comparison.clients.filter(c => c.side === 'B');

  return {
    comparison,
    clientsA,
    clientsB,
  };
}

export async function exportComparisonXLSX(comparisonId: string) {
  const buffer = await generateComparisonXLSX(comparisonId);
  if (!buffer) throw new AppError(404, 'Comparação não encontrada');
  return buffer;
}

export async function exportMonthlyReportXLSX(partnerId: string, year: number, month: number) {
  const buffer = await generateMonthlyReportXLSX(partnerId, year, month);
  if (!buffer) throw new AppError(404, 'Nenhum dado para este período');
  return buffer;
}

export async function exportAnnualReportXLSX(partnerId: string, year: number) {
  const buffer = await generateAnnualReportXLSX(partnerId, year);
  if (!buffer) throw new AppError(404, 'Nenhum dado para este ano');
  return buffer;
}

export async function getMonthlyReportData(partnerId: string, year: number, month: number) {
  const period = await prisma.partnerPeriod.findUnique({
    where: { partnerId_year_month: { partnerId, year, month } },
    include: {
      comparisons: {
        include: { entries: true, clients: true },
        orderBy: { createdAt: 'asc' },
      },
      partner: true,
    },
  });
  if (!period) throw new AppError(404, 'Período não encontrado');
  return period;
}

export async function getAnnualReportData(partnerId: string, year: number) {
  const periods = await prisma.partnerPeriod.findMany({
    where: { partnerId, year },
    include: {
      comparisons: {
        include: { entries: true },
        orderBy: { createdAt: 'asc' },
      },
      partner: true,
    },
    orderBy: { month: 'asc' },
  });
  if (periods.length === 0) throw new AppError(404, 'Nenhum dado para este ano');
  return periods;
}