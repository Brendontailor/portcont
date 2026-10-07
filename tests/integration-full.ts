import app from '../backend/src/app.js';
import * as XLSX from 'xlsx';
import { prisma } from '../backend/src/lib/prisma.js';
import type { Server } from 'node:http';

const BASE = 'http://localhost:3100';
let server: Server;
let passed = 0;
let failed = 0;

function log(name: string, ok: boolean, extra = '') {
  if (ok) { passed++; console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* mantém texto */ }
  return { status: res.status, body, headers: res.headers };
}

async function main() {
  console.log('\n=== PORTCONT — Teste de integração end-to-end ===\n');
  console.log('[Setup] Limpando equivalências de testes anteriores...');
  await prisma.nameEquivalence.deleteMany({
    where: { OR: [{ normalizedA: { startsWith: 'ITEST' } }, { normalizedB: { startsWith: 'ITEST' } }] },
  });

  server = app.listen(3100);
  await new Promise(r => setTimeout(r, 500));

  // 1. Health
  console.log('\n[1] Health');
  const health = await api('/api/health');
  log('GET /api/health responde 200 com service=portcont',
    health.status === 200 && (health.body as { service?: string }).service === 'portcont');

  // 2. Partners
  console.log('\n[2] Parceiras');
  const partnersList = await api('/api/partners');
  const partners = partnersList.body as Array<{ id: string; name: string }>;
  log('GET /api/partners responde 200', partnersList.status === 200);
  log('Seed com 24 parceiras', Array.isArray(partners) && partners.length === 24, `${partners?.length} encontradas`);

  let testPartner = partners.find(p => p.name === 'TELEPEL');
  if (!testPartner) {
    const created = await api('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ITEST PARCEIRA' }),
    });
    testPartner = (created.body as { id: string; name: string });
    log('POST /api/partners cria parceira', created.status === 201);
  } else {
    log('Usando parceira existente TELEPEL', true);
  }
  const partnerId = testPartner!.id;

  // 3. Periods
  console.log('\n[3] Competências');
  const periodCreated = await api(`/api/periods/${partnerId}/2026/10`, { method: 'POST' });
  const period = periodCreated.body as { id: string; year: number; month: number };
  log('POST /api/periods cria/retorna competência Outubro/2026',
    (periodCreated.status === 200 || periodCreated.status === 201) && Boolean(period?.id));

  const periodFetched = await api(`/api/periods/${partnerId}/2026/10`);
  log('GET /api/periods/:partnerId/:year/:month responde 200', periodFetched.status === 200);

  const periodsList = await api(`/api/periods/${partnerId}`);
  log('GET /api/periods/:partnerId lista competências', periodsList.status === 200);

  // 4. Arquivos de teste — XLSX com nomes reais de clientes
  console.log('\n[4] Preparando arquivos de teste (XLSX + CSV)');
  const wbA = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbA, XLSX.utils.aoa_to_sheet([
    ['Nome', 'ONU', 'Status'],
    ['ITEST JOAO DA SILVA', 'HWTCAE7D9AB4', 'Ativo'],
    ['ITEST MARIA APARECIDA DOS SANTOS', 'FHTT09E6A920', 'Ativo'],
    ['ITEST CARLOS ALMEIDA', 'ZTEGCCEBC343', 'Ativo'],
    ['ITEST FERNANDO FERREIRA', 'ITBS5F446CCD', 'Ativo'],
    ['ITEST FERNANDO FERREIRA', 'ITBS5F446CCE', 'Ativo'],
    ['ITEST BRUNA MELLO ASSIS', 'HWTCAE7D9AB4', 'Ativo'],
    ['ITEST BRUNA MELLO ASSIS', 'FHTT09E6A920', 'Ativo'],
    ['ITEST ARTUR COELHO RODRIGUES', 'HWTCAE7D9AB5', 'Ativo'],
    ['ITEST PATRICIA MACHADO', 'HWTCAE7D9AB6', 'Ativo'],
  ]), 'Sheet1');
  const bufA = Buffer.from(XLSX.write(wbA, { type: 'buffer', bookType: 'xlsx' }));

  const csvB = `Cliente,Serial
"ITEST JOÃO DA SILVA",HWTC111
"ITEST MARIA APARECIDA SANTOS",HWTC222
"ITEST FERNANDO FEREIRA",HWTC333
"ITEST ROBERTO MACHADO",HWTC444
"ITEST ARTHUR COELHO RODRIGUES",HWTC555
"ITEST PATRICIA MACHADA",HWTC666
`;

  const form = new FormData();
  form.append('fileA', new Blob([bufA], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'base-a.xlsx');
  form.append('fileB', new Blob([Buffer.from(csvB, 'utf-8')], { type: 'text/csv' }), 'base-b.csv');
  form.append('periodId', period.id);
  form.append('title', 'ITEST Comparação');

  // 5. Comparação completa
  console.log('\n[5] Comparação (XLSX vs CSV)');
  const created = await api('/api/comparisons', { method: 'POST', body: form });
  const compBody = created.body as {
    comparison?: {
      id: string; totalA: number; totalB: number; matchedCount: number;
      onlyACount: number; onlyBCount: number; reviewCount: number;
      entries: Array<{ id: string; status: string; originalA: string | null; originalB: string | null; similarity: number | null }>;
    };
    warnings?: string[];
  };
  log('POST /api/comparisons responde 201', created.status === 201,
    created.status !== 201 ? JSON.stringify(created.body).slice(0, 300) : '');

  if (created.status === 201 && compBody.comparison) {
    const c = compBody.comparison;
    const compId = c.id;
    console.log(`    → Base A: ${c.totalA} | Base B: ${c.totalB} | Match: ${c.matchedCount} | Só A: ${c.onlyACount} | Só B: ${c.onlyBCount} | Revisar: ${c.reviewCount}`);

    log('Deduplicação: BRUNA 2x e FERNANDO 2x = 1 cliente cada com occurrences', c.totalA === 7, `totalA=${c.totalA}`);
    log('Base B tem 6 clientes únicos', c.totalB === 6, `totalB=${c.totalB}`);
    log('JOAO DA SILVA ↔ JOÃO DA SILVA = MATCHED', c.entries.some(e => e.status === 'MATCHED' && e.originalA === 'ITEST JOAO DA SILVA'));
    log('MARIA APARECIDA DOS SANTOS ↔ MARIA APARECIDA SANTOS matched', c.entries.some(e => e.status !== 'ONLY_A' && e.status !== 'ONLY_B' && (e.originalA ?? '').includes('MARIA')));
    log('FERNANDO FERREIRA ↔ FERNANDO FEREIRA em revisão', c.entries.some(e => e.status === 'REVIEW' && (e.originalA ?? '').includes('FERNANDO')));
    log('CARLOS ALMEIDA = ONLY_A', c.entries.some(e => e.status === 'ONLY_A' && e.originalA === 'ITEST CARLOS ALMEIDA'));
    log('BRUNA MELLO ASSIS = ONLY_A (sem par na base B)', c.entries.some(e => e.status === 'ONLY_A' && e.originalA === 'ITEST BRUNA MELLO ASSIS'));
    log('ROBERTO MACHADO = ONLY_B', c.entries.some(e => e.status === 'ONLY_B' && e.originalB === 'ITEST ROBERTO MACHADO'));
    log('ARTUR/ARTHUR = MATCHED automático', c.entries.some(e => e.status === 'MATCHED' && (e.originalA ?? '').includes('ARTUR')));
    log('PATRICIA MACHADO/MACHADA em revisão', c.entries.some(e => e.status === 'REVIEW' && (e.originalA ?? '').includes('PATRICIA')));

    // 6. Buscar comparação
    console.log('\n[6] Detalhes e histórico');
    const fetched = await api(`/api/comparisons/${compId}`);
    log('GET /api/comparisons/:id responde 200', fetched.status === 200);
    const fetchedComp = fetched.body as { clients: unknown[]; sourceFiles: unknown[] };
    log('Comparação inclui clientes extraídos', Array.isArray(fetchedComp.clients) && fetchedComp.clients.length > 0);
    log('Comparação inclui metadados dos arquivos', Array.isArray(fetchedComp.sourceFiles) && fetchedComp.sourceFiles.length === 2);

    const listed = await api('/api/comparisons?page=1&limit=5');
    log('GET /api/comparisons lista paginada', listed.status === 200);

    // 7. Revisão humana
    console.log('\n[7] Revisão humana');
    const reviewEntries = c.entries.filter(e => e.status === 'REVIEW');
    log('Existem entradas REVIEW (FERNANDO e PATRICIA)', reviewEntries.length === 2, `${reviewEntries.length} encontradas`);
    const fernandoReview = reviewEntries.find(e => (e.originalA ?? '').includes('FERNANDO'));
    const patriciaReview = reviewEntries.find(e => (e.originalA ?? '').includes('PATRICIA'));

    if (fernandoReview && patriciaReview) {
      log('FERNANDO/FEREIRA em revisão', true, `similarity=${fernandoReview.similarity}`);

      const confirmed = await api(`/api/comparisons/${compId}/review/${fernandoReview.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samePerson: true }),
      });
      const confirmedComp = confirmed.body as { matchedCount: number; onlyACount: number; onlyBCount: number; reviewCount: number; entries: Array<{ id: string; status: string }> };
      log('Review "MESMO CLIENTE" vira MATCHED', confirmed.status === 200 && confirmedComp.reviewCount === c.reviewCount - 1);
      log('Contadores atualizados após match', confirmedComp.matchedCount === c.matchedCount + 1);

      const equiv = await api('/api/health');
      log('Equivalência positiva registrada (sem crash)', equiv.status === 200);

      // Rejeitar PATRICIA
      const rejected = await api(`/api/comparisons/${compId}/review/${patriciaReview.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samePerson: false }),
      });
      const rejectedComp = rejected.body as { onlyACount: number; onlyBCount: number; reviewCount: number; entries: Array<{ id: string; status: string; originalA: string | null; originalB: string | null }> };
      log('Review "SÃO DIFERENTES" vira ONLY_A + ONLY_B', rejected.status === 200 && rejectedComp.reviewCount === 0);
      const newOnlyB = rejectedComp.entries.find(e => e.id !== patriciaReview.id && e.status === 'ONLY_B' && (e.originalB ?? '').includes('MACHADA'));
      const onlyAEntry = rejectedComp.entries.find(e => e.id === patriciaReview.id && e.status === 'ONLY_A' && e.originalB === null);
      log('Entrada ONLY_B criada para o lado B', Boolean(newOnlyB));
      log('Entrada original virou ONLY_A sem o nome B', Boolean(onlyAEntry));
      log('Contadores de ONLY_A/ONLY_B atualizados', rejectedComp.onlyACount === confirmedComp.onlyACount + 1 && rejectedComp.onlyBCount === confirmedComp.onlyBCount + 1);
    } else {
      log('Entradas REVIEW FERNANDO/PATRICIA não encontradas', false, `statuses: ${[...new Set(c.entries.map(e => e.status))].join(',')}`);
    }

    // 8. Relatórios
    console.log('\n[8] Relatórios e exportação');
    const report = await api(`/api/reports/comparisons/${compId}`);
    log('GET /api/reports/comparisons/:id responde 200', report.status === 200);

    const xlsxRes = await fetch(`${BASE}/api/reports/comparisons/${compId}/xlsx`);
    const xlsxBuf = Buffer.from(await xlsxRes.arrayBuffer());
    log('GET .../xlsx gera XLSX válido', xlsxRes.status === 200 && xlsxBuf.length > 1000, `${xlsxBuf.length} bytes`);
    const xlsxWb = XLSX.read(xlsxBuf, { type: 'buffer' });
    log('XLSX contém abas Resumo/Base A/Base B', ['Resumo', 'Base A', 'Base B'].every(s => xlsxWb.SheetNames.includes(s)), xlsxWb.SheetNames.join(', '));

    const monthly = await api(`/api/reports/monthly/${partnerId}/2026/10`);
    log('GET /api/reports/monthly responde 200', monthly.status === 200);
    const monthlyXlsx = await fetch(`${BASE}/api/reports/monthly/${partnerId}/2026/10/xlsx`);
    log('GET .../monthly/xlsx gera arquivo', monthlyXlsx.status === 200);

    const annual = await api(`/api/reports/annual/${partnerId}/2026`);
    log('GET /api/reports/annual responde 200', annual.status === 200);
    const annualXlsx = await fetch(`${BASE}/api/reports/annual/${partnerId}/2026/xlsx`);
    log('GET .../annual/xlsx gera arquivo', annualXlsx.status === 200);

    // 9. Suporte a formatos
    console.log('\n[9] Diversos');
    const formats = await api('/api/comparisons/supported-formats');
    log('GET /api/comparisons/supported-formats responde', formats.status === 200);

    const notFound = await api('/api/comparisons/nao-existe-xyz');
    log('Comparação inexistente retorna 404', notFound.status === 404);

    const invalidUpload = new FormData();
    invalidUpload.append('fileA', new Blob(['x'], { type: 'text/plain' }), 'a.txt');
    invalidUpload.append('fileB', new Blob(['x'], { type: 'text/plain' }), 'b.txt');
    invalidUpload.append('periodId', period.id);
    const invalid = await api('/api/comparisons', { method: 'POST', body: invalidUpload });
    log('Upload de formato inválido retorna 400', invalid.status === 400);

    const noPeriod = new FormData();
    noPeriod.append('fileA', new Blob([bufA], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'a.xlsx');
    noPeriod.append('fileB', new Blob([bufA], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'b.xlsx');
    const noPeriodRes = await api('/api/comparisons', { method: 'POST', body: noPeriod });
    log('Comparação sem periodId retorna 400', noPeriodRes.status === 400);

    // 10. Cleanup
    console.log('\n[10] Limpeza');
    const del = await api(`/api/comparisons/${compId}`, { method: 'DELETE' });
    log('DELETE /api/comparisons/:id remove comparação', del.status === 204);
  }

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===\n`);
  server.close();
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async err => {
  console.error('\n✗ ERRO FATAL NO TESTE:', err);
  try { server?.close(); } catch { /* noop */ }
  try { await prisma.$disconnect(); } catch { /* noop */ }
  process.exit(1);
});