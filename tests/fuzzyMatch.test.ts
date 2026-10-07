import { describe, it, expect } from 'vitest';
import { calculateSimilarity } from '../backend/src/modules/matching/fuzzyMatch.service.js';
import { createNormalizedName } from '../backend/src/modules/matching/normalizeName.service.js';

function testSimilarity(nameA: string, nameB: string): number {
  const normA = createNormalizedName(nameA);
  const normB = createNormalizedName(nameB);
  return calculateSimilarity(normA, normB);
}

describe('calculateSimilarity', () => {
  it('should give 100 for identical names', () => {
    expect(testSimilarity('JOAO DA SILVA', 'JOAO DA SILVA')).toBe(100);
  });

  it('should match with accent differences', () => {
    const score = testSimilarity('JOAO DA SILVA', 'JOÃO DA SILVA');
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it('should give high score for Artur/Arthur', () => {
    const score = testSimilarity('ARTUR COELHO RODRIGUES', 'ARTHUR COELHO RODRIGUES');
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('should give high score for Ferreira/Fereira', () => {
    const score = testSimilarity('FERNANDO FERREIRA', 'FERNANDO FEREIRA');
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('should give high score for APARECIDA/APARESIDA', () => {
    const score = testSimilarity('MARIA APARECIDA SANTOS', 'MARIA APARESIDA SANTOS');
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('should give high score for DE SOUZA/SOUZA', () => {
    const score = testSimilarity('ANA PAULA DE SOUZA', 'ANA PAULA SOUZA');
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('should NOT match different last names', () => {
    const score = testSimilarity('JOAO CARLOS SILVA', 'JOAO CARLOS SOUZA');
    expect(score).toBeLessThan(85);
  });

  it('should NOT match Ana Silva vs Ana Souza', () => {
    const score = testSimilarity('ANA SILVA', 'ANA SOUZA');
    expect(score).toBeLessThan(85);
  });

  it('should handle inverted names', () => {
    const score = testSimilarity('JOSE CARLOS SILVA', 'CARLOS JOSE SILVA');
    expect(score).toBeGreaterThan(60);
  });
});