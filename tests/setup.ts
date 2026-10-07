process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.MATCH_THRESHOLD = process.env.MATCH_THRESHOLD || '95';
process.env.REVIEW_THRESHOLD = process.env.REVIEW_THRESHOLD || '85';
process.env.MAX_UPLOAD_MB = process.env.MAX_UPLOAD_MB || '15';
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true, configurable: true });
}