import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middlewares/error.middleware.js';

export async function getOrCreatePeriod(partnerId: string, year: number, month: number) {
  if (month < 1 || month > 12) throw new AppError(400, 'Mês inválido');

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AppError(404, 'Parceira não encontrada');

  return prisma.partnerPeriod.upsert({
    where: { partnerId_year_month: { partnerId, year, month } },
    create: { partnerId, year, month },
    update: {},
  });
}

export async function getPeriod(partnerId: string, year: number, month: number) {
  return prisma.partnerPeriod.findUnique({
    where: { partnerId_year_month: { partnerId, year, month } },
    include: {
      comparisons: { orderBy: { createdAt: 'desc' } },
      partner: true,
    },
  });
}

export async function listPeriods(partnerId: string) {
  return prisma.partnerPeriod.findMany({
    where: { partnerId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {
      _count: { select: { comparisons: true } },
      comparisons: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
}