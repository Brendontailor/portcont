import { Router } from 'express';
import * as service from './periods.service.js';
import { z } from 'zod';

const router = Router();

router.get('/:partnerId', async (req, res, next) => {
  try {
    const periods = await service.listPeriods(req.params.partnerId);
    res.json(periods);
  } catch (err) { next(err); }
});

router.get('/:partnerId/:year/:month', async (req, res, next) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const period = await service.getPeriod(req.params.partnerId, year, month);
    if (!period) return res.status(404).json({ error: 'Período não encontrado' });
    res.json(period);
  } catch (err) { next(err); }
});

router.post('/:partnerId/:year/:month', async (req, res, next) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const period = await service.getOrCreatePeriod(req.params.partnerId, year, month);
    res.status(201).json(period);
  } catch (err) { next(err); }
});

export default router;