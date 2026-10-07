import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../backend/src/lib/prisma.js', () => ({ prisma: { nameEquivalence: { findMany: vi.fn() } } }));
import { prisma } from '../backend/src/lib/prisma.js';
import { compareBases } from '../backend/src/modules/matching/comparisonEngine.service';
import { normalizeName } from '../backend/src/modules/matching/normalizeName.service';
const clients = (...names: string[]) => names.map(originalName => ({ originalName, normalizedName: normalizeName(originalName), occurrences: 1 }));
beforeEach(() => vi.mocked(prisma.nameEquivalence.findMany).mockResolvedValue([]));
describe('Conferência por nomes', () => {
  it('separa nomes nas duas bases e exclusivos de cada base', async () => {
    const result = await compareBases(clients('João da Silva', 'Ana Costa'), clients('JOAO DA SILVA', 'Pedro Santos'));
    expect(result.stats).toEqual({ totalA: 2, totalB: 2, matchedCount: 1, onlyACount: 1, onlyBCount: 1, reviewCount: 0 });
  });
  it('considera pequenas diferenças sem listar os pares como ausentes', async () => {
    const result = await compareBases(clients('Fernando Ferreira'), clients('Fernando Fereira'));
    expect(result.review).toHaveLength(1);
    expect(result.matched).toHaveLength(0);
    expect(result.onlyA).toHaveLength(0);
    expect(result.onlyB).toHaveLength(0);
  });
  it('encontra candidatos com erro no início de ambos os nomes', async () => {
    const result = await compareBases(clients('Alexandrino Fernandes'), clients('Alixandrino Farnandes'));
    expect(result.matched.length + result.review.length).toBe(1);
    expect(result.onlyA).toHaveLength(0);
    expect(result.onlyB).toHaveLength(0);
  });
  it('respeita uma decisão anterior de clientes diferentes nos dois sentidos', async () => {
    vi.mocked(prisma.nameEquivalence.findMany).mockResolvedValue([{ normalizedA: 'FERNANDO FERREIRA', normalizedB: 'FERNANDO FEREIRA', isSame: false }] as never);
    for (const names of [['Fernando Ferreira', 'Fernando Fereira'], ['Fernando Fereira', 'Fernando Ferreira']]) {
      const result = await compareBases(clients(names[0]), clients(names[1]));
      expect(result.onlyA).toHaveLength(1);
      expect(result.onlyB).toHaveLength(1);
      expect(result.review).toHaveLength(0);
      expect(result.matched).toHaveLength(0);
    }
  });
  it('leva uma equivalência confirmada para nas duas bases', async () => {
    vi.mocked(prisma.nameEquivalence.findMany).mockResolvedValue([{ normalizedA: 'JOSE C SILVA', normalizedB: 'JOSE CARLOS SILVA', isSame: true }] as never);
    const result = await compareBases(clients('Jose C Silva'), clients('Jose Carlos Silva'));
    expect(result.matched).toHaveLength(1);
    expect(result.review).toHaveLength(0);
  });
  it('não utiliza o mesmo nome da base B para dois clientes da A', async () => {
    const result = await compareBases(clients('Fernando Ferreira', 'Fernando Fereira'), clients('Fernando Ferreira'));
    expect(result.matched).toHaveLength(1);
    expect(result.onlyA).toHaveLength(1);
    expect(result.matched[0].clientA.originalName).toBe('Fernando Ferreira');
  });
});
