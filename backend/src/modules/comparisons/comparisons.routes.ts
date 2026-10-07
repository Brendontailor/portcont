import { Router } from 'express';
import { uploadComparison } from '../../middlewares/upload.middleware.js';
import * as service from './comparisons.service.js';
import { z } from 'zod';
import { AppError } from '../../middlewares/error.middleware.js';

const router = Router();

router.get('/supported-formats', (_req, res) => {
  res.json({ mimeTypes: service.getSupportedMimeTypesList() });
});

router.get('/', async (req, res, next) => {
  try {
    const periodId = req.query.periodId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await service.listComparisons(periodId, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const comparison = await service.getComparisonById(req.params.id);
    res.json(comparison);
  } catch (err) { next(err); }
});

router.post('/', uploadComparison, async (req, res, next) => {
  try {
    const files = req.files as { fileA?: Express.Multer.File[]; fileB?: Express.Multer.File[] } | undefined;
    if (!files?.fileA?.[0] || !files?.fileB?.[0]) {
      throw new AppError(400, 'É necessário enviar exatamente 2 arquivos (fileA e fileB)');
    }

    const periodId = req.body.periodId;
    const title = req.body.title;

    if (!periodId) {
      throw new AppError(400, 'Selecione a parceira e a competência antes de comparar');
    }

    const { comparison, warnings } = await service.processComparison(
      periodId,
      typeof title === 'string' && title.trim() ? title.trim() : undefined,
      files.fileA[0],
      files.fileB[0]
    );

    res.status(201).json({ comparison, warnings });
  } catch (err) { next(err); }
});

router.post('/:comparisonId/review/:entryId', async (req, res, next) => {
  try {
    const { samePerson } = z.object({ samePerson: z.boolean() }).parse(req.body);
    const updated = await service.reviewEntry(req.params.comparisonId, req.params.entryId, samePerson);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await service.deleteComparison(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;