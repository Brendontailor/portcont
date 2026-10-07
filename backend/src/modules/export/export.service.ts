import * as XLSX from 'xlsx';
import { prisma } from '../../lib/prisma.js';
import type { ComparisonResult, ParsedClient } from '../matching/matching.types.js';

interface ExportData {
  comparison: {
    id: string;
    title: string | null;
    fileAName: string;
    fileBName: string;
    createdAt: Date;
    totalA: number;
    totalB: number;
    matchedCount: number;
    onlyACount: number;
    onlyBCount: number;
    reviewCount: number;
    declaredA: number | null;
    declaredB: number | null;
    incompleteA: boolean;
    incompleteB: boolean;
    period: { year: number; month: number; partner: { name: string } };
  };
  entries: {
    originalA: string | null;
    normalizedA: string | null;
    originalB: string | null;
    normalizedB: string | null;
    occurrencesA: number | null;
    occurrencesB: number | null;
    similarity: number | null;
    status: string;
  }[];
  clientsA: { originalName: string; normalizedName: string; occurrences: number }[];
  clientsB: { originalName: string; normalizedName: string; occurrences: number }[];
}

async function getExportData(comparisonId: string): Promise<ExportData | null> {
  const comparison = await prisma.comparison.findUnique({
    where: { id: comparisonId },
    include: {
      entries: true,
      clients: true,
      period: { include: { partner: true } },
    },
  });

  if (!comparison) return null;

  const clientsA = comparison.clients.filter(c => c.side === 'A');
  const clientsB = comparison.clients.filter(c => c.side === 'B');

  return {
    comparison: {
      id: comparison.id,
      period: comparison.period,
      title: comparison.title,
      fileAName: comparison.fileAName,
      fileBName: comparison.fileBName,
      createdAt: comparison.createdAt,
      totalA: comparison.totalA,
      totalB: comparison.totalB,
      matchedCount: comparison.matchedCount,
      onlyACount: comparison.onlyACount,
      onlyBCount: comparison.onlyBCount,
      reviewCount: comparison.reviewCount,
      declaredA: comparison.declaredA,
      declaredB: comparison.declaredB,
      incompleteA: comparison.incompleteA,
      incompleteB: comparison.incompleteB,
    },
    entries: comparison.entries,
    clientsA: clientsA.map(c => ({
      originalName: c.originalName,
      normalizedName: c.normalizedName,
      occurrences: c.occurrences,
    })),
    clientsB: clientsB.map(c => ({
      originalName: c.originalName,
      normalizedName: c.normalizedName,
      occurrences: c.occurrences,
    })),
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export async function generateComparisonXLSX(comparisonId: string): Promise<Buffer | null> {
  const data = await getExportData(comparisonId);
  if (!data) return null;

  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['PORTCONT - Relatório de Comparação'],
    [''],
    ['Parceira', data.comparison.period.partner.name],
    ['Competência', `${String(data.comparison.period.month).padStart(2, '0')}/${data.comparison.period.year}`],
    ['Título', data.comparison.title ?? 'Sem título'],
    ['Identificador', data.comparison.id],
    ['Data da Comparação', formatDateTime(data.comparison.createdAt)],
    [''],
    ['Arquivo A', data.comparison.fileAName],
    ['Arquivo B', data.comparison.fileBName],
    [''],
    ['RESUMO'],
    ['', ''],
    ['Métrica', 'Valor'],
    ['Total Base A (ocorrências)', data.comparison.totalA],
    ['Total Base B (ocorrências)', data.comparison.totalB],
    ['Nomes distintos Base A', data.clientsA.length],
    ['Nomes distintos Base B', data.clientsB.length],
    ['Encontrados nas duas', data.comparison.matchedCount],
    ['Somente A', data.comparison.onlyACount],
    ['Somente B', data.comparison.onlyBCount],
    ['Revisar', data.comparison.reviewCount],
    [''],
    ['Registros Declarados A', data.comparison.declaredA ?? 'N/A'],
    ['Registros Declarados B', data.comparison.declaredB ?? 'N/A'],
    ['Arquivo A Incompleto', data.comparison.incompleteA ? 'Sim' : 'Não'],
    ['Arquivo B Incompleto', data.comparison.incompleteB ? 'Sim' : 'Não'],
    [''],
    ['Gerado em', formatDateTime(new Date())],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  const baseAData = [
    ['Nome', 'Ocorrências'],
    ...data.clientsA.map(c => [c.originalName, c.occurrences]),
  ];
  const wsBaseA = XLSX.utils.aoa_to_sheet(baseAData);
  XLSX.utils.book_append_sheet(wb, wsBaseA, 'Base A');

  const baseBData = [
    ['Nome', 'Ocorrências'],
    ...data.clientsB.map(c => [c.originalName, c.occurrences]),
  ];
  const wsBaseB = XLSX.utils.aoa_to_sheet(baseBData);
  XLSX.utils.book_append_sheet(wb, wsBaseB, 'Base B');

  const matchedEntries = data.entries.filter(e => e.status === 'MATCHED');
  const matchedData = [
    ['Nome A', 'Nome B', 'Similaridade'],
    ...matchedEntries.map(e => [e.originalA ?? '', e.originalB ?? '', `${e.similarity ?? 100}%`]),
  ];
  const wsMatched = XLSX.utils.aoa_to_sheet(matchedData);
  XLSX.utils.book_append_sheet(wb, wsMatched, 'Correspondências');

  const onlyAEntries = data.entries.filter(e => e.status === 'ONLY_A');
  const onlyAData = [
    ['Nome', 'Ocorrências'],
    ...onlyAEntries.map(e => [e.originalA ?? '', e.occurrencesA ?? 1]),
  ];
  const wsOnlyA = XLSX.utils.aoa_to_sheet(onlyAData);
  XLSX.utils.book_append_sheet(wb, wsOnlyA, 'Somente A');

  const onlyBEntries = data.entries.filter(e => e.status === 'ONLY_B');
  const onlyBData = [
    ['Nome', 'Ocorrências'],
    ...onlyBEntries.map(e => [e.originalB ?? '', e.occurrencesB ?? 1]),
  ];
  const wsOnlyB = XLSX.utils.aoa_to_sheet(onlyBData);
  XLSX.utils.book_append_sheet(wb, wsOnlyB, 'Somente B');

  const reviewEntries = data.entries.filter(e => e.status === 'REVIEW');
  const reviewData = [
    ['Nome A', 'Nome B', 'Similaridade'],
    ...reviewEntries.map(e => [e.originalA ?? '', e.originalB ?? '', `${e.similarity ?? 0}%`]),
  ];
  const wsReview = XLSX.utils.aoa_to_sheet(reviewData);
  XLSX.utils.book_append_sheet(wb, wsReview, 'Revisar');

  const labels: Record<string, string> = { MATCHED: 'Nas duas bases', ONLY_A: 'Somente A', ONLY_B: 'Somente B', REVIEW: 'Revisão pendente' };
  const detail = XLSX.utils.aoa_to_sheet([
    ['Situação', 'Nome A', 'Nome B', 'Ocorrências A', 'Ocorrências B', 'Diferença A - B', 'Similaridade (%)', 'Nome normalizado A', 'Nome normalizado B', 'Conferência'],
    ...data.entries.map(e => [labels[e.status] ?? e.status, e.originalA ?? '', e.originalB ?? '', e.occurrencesA ?? '', e.occurrencesB ?? '',
      e.occurrencesA != null && e.occurrencesB != null ? e.occurrencesA - e.occurrencesB : '', e.similarity ?? '', e.normalizedA ?? '', e.normalizedB ?? '',
      e.status === 'REVIEW' ? 'Confirmar se representam o mesmo cliente' : e.status === 'MATCHED' ? (e.occurrencesA !== e.occurrencesB ? 'Ocorrências diferentes' : 'Correspondência registrada') : 'Ausente na outra base']),
  ]);
  XLSX.utils.book_append_sheet(wb, detail, 'Conferência detalhada');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Campo', 'Como interpretar'],
    ['Totais das bases', 'Contam todas as ocorrências do arquivo, inclusive nomes repetidos.'],
    ['Nomes distintos', 'Quantidade de nomes normalizados diferentes em cada base.'],
    ['Ocorrências', 'Quantidade de vezes que o nome aparece no arquivo; cada ocorrência entra nos totais.'],
    ['Similaridade', 'Comparação da escrita dos nomes, não uma probabilidade de identidade.'],
    ['Nas duas bases', 'Inclui correspondências automáticas e confirmadas na revisão.'],
    ['Revisão pendente', 'É necessário confirmar se os nomes representam o mesmo cliente.'],
    ['Arquivo incompleto', 'Confira o arquivo original antes de concluir a conferência.'],
    ['Escopo', 'Todos os registros da comparação, sem aplicar filtros da tela.'],
    ['Datas', 'Horário de Brasília (America/Sao_Paulo).'],
  ]), 'Como interpretar');
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    sheet['!cols'] = Array.from({ length: range.e.c + 1 }, (_, col) => ({ wch: name === 'Como interpretar' && col === 1 ? 95 : name === 'Resumo' ? 45 : col === 0 ? 25 : 34 }));
    if (name !== 'Resumo' && name !== 'Como interpretar') sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1' };
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buffer);
}

export async function generateMonthlyReportXLSX(partnerId: string, year: number, month: number): Promise<Buffer | null> {
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

  if (!period || period.comparisons.length === 0) return null;

  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['PORTCONT - Relatório Mensal'],
    [''],
    ['Parceira', period.partner.name],
    ['Competência', `${month.toString().padStart(2, '0')}/${year}`],
    ['Quantidade de Comparações', period.comparisons.length],
    [''],
    ['Gerado em', formatDateTime(new Date())],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  const historyData = [
    ['Data', 'Título', 'Base A', 'Base B', 'Match', 'Somente A', 'Somente B', 'Revisar'],
    ...period.comparisons.map(c => [
      formatDateTime(c.createdAt),
      c.title ?? 'Sem título',
      c.totalA,
      c.totalB,
      c.matchedCount,
      c.onlyACount,
      c.onlyBCount,
      c.reviewCount,
    ]),
  ];
  const wsHistory = XLSX.utils.aoa_to_sheet(historyData);
  XLSX.utils.book_append_sheet(wb, wsHistory, 'Histórico Mensal');

  const latestComparison = period.comparisons[period.comparisons.length - 1];
  const latestClientsA = latestComparison.clients.filter(c => c.side === 'A');
  const latestClientsB = latestComparison.clients.filter(c => c.side === 'B');
  const latestEntries = latestComparison.entries;

  const latestMatched = latestEntries.filter(e => e.status === 'MATCHED');
  const latestMatchedData = [
    ['Nome A', 'Nome B', 'Similaridade'],
    ...latestMatched.map(e => [e.originalA ?? '', e.originalB ?? '', `${e.similarity ?? 100}%`]),
  ];
  const wsLatestMatched = XLSX.utils.aoa_to_sheet(latestMatchedData);
  XLSX.utils.book_append_sheet(wb, wsLatestMatched, 'Correspondências (Última)');

  const latestOnlyA = latestEntries.filter(e => e.status === 'ONLY_A');
  const latestOnlyAData = [['Nome'], ...latestOnlyA.map(e => [e.originalA ?? ''])];
  const wsLatestOnlyA = XLSX.utils.aoa_to_sheet(latestOnlyAData);
  XLSX.utils.book_append_sheet(wb, wsLatestOnlyA, 'Somente A (Última)');

  const latestOnlyB = latestEntries.filter(e => e.status === 'ONLY_B');
  const latestOnlyBData = [['Nome'], ...latestOnlyB.map(e => [e.originalB ?? ''])];
  const wsLatestOnlyB = XLSX.utils.aoa_to_sheet(latestOnlyBData);
  XLSX.utils.book_append_sheet(wb, wsLatestOnlyB, 'Somente B (Última)');

  const latestReview = latestEntries.filter(e => e.status === 'REVIEW');
  const latestReviewData = [
    ['Nome A', 'Nome B', 'Similaridade'],
    ...latestReview.map(e => [e.originalA ?? '', e.originalB ?? '', `${e.similarity ?? 0}%`]),
  ];
  const wsLatestReview = XLSX.utils.aoa_to_sheet(latestReviewData);
  XLSX.utils.book_append_sheet(wb, wsLatestReview, 'Revisar (Última)');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buffer);
}

export async function generateAnnualReportXLSX(partnerId: string, year: number): Promise<Buffer | null> {
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

  if (periods.length === 0) return null;

  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['PORTCONT - Relatório Anual'],
    [''],
    ['Parceira', periods[0].partner.name],
    ['Ano', year],
    ['Meses Analisados', periods.length],
    [''],
    ['Gerado em', formatDateTime(new Date())],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  const evolutionData = [
    ['Mês', 'Base A', 'Base B', 'Correspondências', 'Somente A', 'Somente B', 'Revisar', 'Comparações'],
    ...periods.map(p => {
      const lastComp = p.comparisons[p.comparisons.length - 1];
      if (!lastComp) return [p.month, 0, 0, 0, 0, 0, 0, 0];
      return [
        p.month,
        lastComp.totalA,
        lastComp.totalB,
        lastComp.matchedCount,
        lastComp.onlyACount,
        lastComp.onlyBCount,
        lastComp.reviewCount,
        p.comparisons.length,
      ];
    }),
  ];
  const wsEvolution = XLSX.utils.aoa_to_sheet(evolutionData);
  XLSX.utils.book_append_sheet(wb, wsEvolution, 'Evolução Mensal');

  for (const period of periods) {
    if (period.comparisons.length === 0) continue;
    const lastComp = period.comparisons[period.comparisons.length - 1];
    const entries = lastComp.entries;

    const monthName = period.month.toString().padStart(2, '0');

    const matched = entries.filter(e => e.status === 'MATCHED');
    const matchedData = [
      ['Nome A', 'Nome B', 'Similaridade'],
      ...matched.map(e => [e.originalA ?? '', e.originalB ?? '', `${e.similarity ?? 100}%`]),
    ];
    const wsMatched = XLSX.utils.aoa_to_sheet(matchedData);
    XLSX.utils.book_append_sheet(wb, wsMatched, `Correspondências ${monthName}`);

    const onlyA = entries.filter(e => e.status === 'ONLY_A');
    const onlyAData = [['Nome'], ...onlyA.map(e => [e.originalA ?? ''])];
    const wsOnlyA = XLSX.utils.aoa_to_sheet(onlyAData);
    XLSX.utils.book_append_sheet(wb, wsOnlyA, `Somente A ${monthName}`);

    const onlyB = entries.filter(e => e.status === 'ONLY_B');
    const onlyBData = [['Nome'], ...onlyB.map(e => [e.originalB ?? ''])];
    const wsOnlyB = XLSX.utils.aoa_to_sheet(onlyBData);
    XLSX.utils.book_append_sheet(wb, wsOnlyB, `Somente B ${monthName}`);
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buffer);
}
