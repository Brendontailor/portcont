import { env } from '../../config/env.js';

const NAME_PARTICLES = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);

const PREFIXES_TO_REMOVE = [
  /^RGSUL\s*-\s*/i,
  /^REDE\s+RGSUL\s*-\s*/i,
  /^RGSUL\s*-/i,
  /^REDE\s+RGSUL\s*-/i,
];

function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeHyphens(text: string): string {
  return text.replace(/[\u2010-\u2015\u2212]/g, '-');
}

function removeInvisibleChars(text: string): string {
  return text.replace(/[\u200B-\u200F\uFEFF]/g, '');
}

function removePrefixes(name: string): string {
  let result = name;
  for (const prefix of PREFIXES_TO_REMOVE) {
    result = result.replace(prefix, '');
  }
  return result.trim();
}

function normalizePunctuation(text: string): string {
  return text.replace(/[.,;:!?()\[\]{}"']/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeName(rawName: string): string {
  let name = rawName.trim();
  name = removeInvisibleChars(name);
  name = normalizeHyphens(name);
  name = removePrefixes(name);
  name = normalizePunctuation(name);
  name = removeAccents(name);
  name = name.toUpperCase();
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

export function tokenizeName(normalizedName: string): string[] {
  return normalizedName.split(/\s+/).filter(token => token.length > 0);
}

export function extractNameParts(normalizedName: string): { firstName: string; lastName: string } {
  const tokens = tokenizeName(normalizedName);
  if (tokens.length === 0) return { firstName: '', lastName: '' };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: '' };

  let lastNameIndex = tokens.length - 1;
  while (lastNameIndex > 0 && NAME_PARTICLES.has(tokens[lastNameIndex])) {
    lastNameIndex--;
  }

  const firstName = tokens[0];
  const lastName = tokens[lastNameIndex] || '';

  return { firstName, lastName };
}

export function getNameTokens(normalizedName: string): { main: string[]; particles: string[] } {
  const tokens = tokenizeName(normalizedName);
  const main: string[] = [];
  const particles: string[] = [];

  for (const token of tokens) {
    if (NAME_PARTICLES.has(token)) {
      particles.push(token);
    } else {
      main.push(token);
    }
  }

  return { main, particles };
}

export function createNormalizedName(original: string): {
  original: string;
  normalized: string;
  tokens: string[];
  firstName: string;
  lastName: string;
} {
  const normalized = normalizeName(original);
  const tokens = tokenizeName(normalized);
  const { firstName, lastName } = extractNameParts(normalized);

  return {
    original,
    normalized,
    tokens,
    firstName,
    lastName,
  };
}