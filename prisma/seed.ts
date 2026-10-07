import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

const initialPartners = [
  'ALLTEC',
  'CASCATANET PEL+MBO+MRE',
  'CHIP7',
  'CLICKNET',
  'CONECTA MAIS PELOTAS',
  'CONECTA MAIS MRE',
  'EVOLUTION',
  'FORTELECOM',
  'HOLZNET',
  'INFINITY',
  'KONECT PEL+MBO+MRE',
  'LEVOONET',
  'MAMUTE',
  'NAVEGARNET',
  'NET 24',
  'RADIX',
  'REDESUL NET',
  'STS',
  'TELEPEL',
  'TURBO FIBRA',
  'VENTOSUL CANGUCU',
  'VN3',
  'WORDNET',
  'VEELL',
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

async function seedPartners() {
  console.log('Iniciando seed de parceiras...');

  let created = 0;
  let skipped = 0;

  for (const name of initialPartners) {
    const slug = generateSlug(name);
    const existing = await prisma.partner.findUnique({ where: { slug } });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.partner.create({ data: { name, slug, active: true } });
    created++;
  }

  console.log(`Parceiras: ${created} criadas, ${skipped} já existentes.`);
}

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username && !password) {
    console.warn('ADMIN_USERNAME/ADMIN_PASSWORD não definidos. Usuário inicial não foi criado.');
    return;
  }

  if (!username || !password) {
    throw new Error('Defina ADMIN_USERNAME e ADMIN_PASSWORD juntos para criar o usuário inicial.');
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD deve ter pelo menos 8 caracteres.');
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Usuário administrador "${username}" já existe; senha não foi alterada.`);
    return;
  }

  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0) {
    console.warn('Já existe um usuário no PortCont. O seed não criará uma segunda conta.');
    return;
  }

  await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      active: true,
    },
  });
  console.log(`Usuário administrador "${username}" criado.`);
}

async function main() {
  await seedPartners();
  await seedAdmin();
  console.log('Seed finalizado.');
}

main()
  .catch((error) => {
    console.error('Erro no seed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
