import { PrismaClient } from '@prisma/client';

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

async function main() {
  console.log('🌱 Iniciando seed de parceiras...');

  let created = 0;
  let skipped = 0;

  for (const name of initialPartners) {
    const slug = generateSlug(name);

    const existing = await prisma.partner.findUnique({
      where: { slug },
    });

    if (existing) {
      console.log(`⏭  ${name} (slug: ${slug}) - já existe`);
      skipped++;
      continue;
    }

    await prisma.partner.create({
      data: {
        name,
        slug,
        active: true,
      },
    });

    console.log(`✅ ${name} (slug: ${slug}) - criada`);
    created++;
  }

  console.log(`\n📊 Seed finalizado: ${created} criadas, ${skipped} já existentes`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });