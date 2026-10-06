import { describe, it, expect } from 'vitest';
import { normalizeName, tokenizeName, extractNameParts, createNormalizedName } from '../backend/src/modules/matching/normalizeName.service.js';

describe('normalizeName', () => {
  it('should normalize simple name', () => {
    expect(normalizeName('João da Silva')).toBe('JOAO DA SILVA');
  });

  it('should trim and collapse spaces', () => {
    expect(normalizeName('  João   da   Silva  ')).toBe('JOAO DA SILVA');
  });

  it('should remove RGSUL prefix', () => {
    expect(normalizeName('RGSUL - João da Silva')).toBe('JOAO DA SILVA');
  });

  it('should remove REDE RGSUL prefix', () => {
    expect(normalizeName('REDE RGSUL - Julio Rosa Porto')).toBe('JULIO ROSA PORTO');
  });

  it('should remove accents', () => {
    expect(normalizeName('MARIA APARÉCIDA SANTOS')).toBe('MARIA APARECIDA SANTOS');
  });

  it('should convert to uppercase', () => {
    expect(normalizeName('joão da silva')).toBe('JOAO DA SILVA');
  });

  it('should remove punctuation', () => {
    expect(normalizeName('JOÃO, DA SILVA.')).toBe('JOAO DA SILVA');
  });
});

describe('tokenizeName', () => {
  it('should split into tokens', () => {
    expect(tokenizeName('JOAO DA SILVA')).toEqual(['JOAO', 'DA', 'SILVA']);
  });

  it('should handle multiple spaces', () => {
    expect(tokenizeName('JOAO  DA   SILVA')).toEqual(['JOAO', 'DA', 'SILVA']);
  });
});

describe('extractNameParts', () => {
  it('should extract first and last name', () => {
    expect(extractNameParts('JOAO DA SILVA')).toEqual({ firstName: 'JOAO', lastName: 'SILVA' });
  });

  it('should handle particles in last name', () => {
    expect(extractNameParts('MARIA APARECIDA DOS SANTOS')).toEqual({ firstName: 'MARIA', lastName: 'SANTOS' });
  });

  it('should handle single name', () => {
    expect(extractNameParts('MADONNA')).toEqual({ firstName: 'MADONNA', lastName: '' });
  });
});

describe('createNormalizedName', () => {
  it('should create complete normalized name object', () => {
    const result = createNormalizedName('RGSUL - João da Silva');
    expect(result.original).toBe('RGSUL - João da Silva');
    expect(result.normalized).toBe('JOAO DA SILVA');
    expect(result.tokens).toEqual(['JOAO', 'DA', 'SILVA']);
    expect(result.firstName).toBe('JOAO');
    expect(result.lastName).toBe('SILVA');
  });
});