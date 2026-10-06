import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middlewares/error.middleware.js';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function listPartners(activeOnly = true) {
  return prisma.partner.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { periods: true } },
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 1,
        include: {
          _count: { select: { comparisons: true } },
          comparisons: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });
}

export async function getPartnerById(id: string) {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: {
          _count: { select: { comparisons: true } },
          comparisons: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      },
    },
  });
  if (!partner) throw new AppError(404, 'Parceira não encontrada');
  return partner;
}

export async function getPartnerBySlug(slug: string) {
  const partner = await prisma.partner.findUnique({
    where: { slug },
    include: {
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: {
          _count: { select: { comparisons: true } },
        },
      },
    },
  });
  if (!partner) throw new AppError(404, 'Parceira não encontrada');
  return partner;
}

export async function createPartner(name: string) {
  const slug = generateSlug(name);
  const existing = await prisma.partner.findUnique({ where: { slug } });
  if (existing) throw new AppError(409, 'Já existe uma parceira com nome similar');
  return prisma.partner.create({ data: { name, slug } });
}

export async function updatePartner(id: string, name: string, active?: boolean) {
  const slug = generateSlug(name);
  const existing = await prisma.partner.findFirst({ where: { slug, NOT: { id } } });
  if (existing) throw new AppError(409, 'Já existe uma parceira com nome similar');
  return prisma.partner.update({
    where: { id },
    data: { name, slug, ...(active !== undefined ? { active } : {}) },
  });
}

export async function deletePartner(id: string) {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: { _count: { select: { periods: true } } },
  });
  if (!partner) throw new AppError(404, 'Parceira não encontrada');
  if (partner._count.periods > 0) {
    throw new AppError(400, 'Não é possível excluir parceira com histórico. Desative-a.');
  }
  return prisma.partner.delete({ where: { id } });
}