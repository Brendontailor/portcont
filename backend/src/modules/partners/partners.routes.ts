import { Router } from 'express';
import * as service from './partners.service.js';
import { z } from 'zod';

const router = Router();

const createPartnerSchema = z.object({ name: z.string().min(2).max(100) });
const updatePartnerSchema = z.object({ name: z.string().min(2).max(100).optional(), active: z.boolean().optional() });

router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const partners = await service.listPartners(activeOnly);
    res.json(partners);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const partner = await service.getPartnerById(req.params.id);
    res.json(partner);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = createPartnerSchema.parse(req.body);
    const partner = await service.createPartner(data.name);
    res.status(201).json(partner);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = updatePartnerSchema.parse(req.body);
    const partner = await service.updatePartner(req.params.id, data.name, data.active);
    res.json(partner);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await service.deletePartner(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
