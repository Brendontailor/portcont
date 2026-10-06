import { Router } from 'express';
import * as service from './reports.service.js';

const router = Router();

router.get('/comparisons/:id', async (req, res, next) => {
  try {
    const report = await service.getComparisonReport(req.params.id);
    res.json(report);
  } catch (err) { next(err); }
});

router.get('/comparisons/:id/xlsx', async (req, res, next) => {
  try {
    const buffer = await service.exportComparisonXLSX(req.params.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="portcont-comparacao-${req.params.id}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/monthly/:partnerId/:year/:month', async (req, res, next) => {
  try {
    const partnerId = req.params.partnerId;
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const report = await service.getMonthlyReportData(partnerId, year, month);
    res.json(report);
  } catch (err) { next(err); }
});

router.get('/monthly/:partnerId/:year/:month/xlsx', async (req, res, next) => {
  try {
    const partnerId = req.params.partnerId;
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const buffer = await service.exportMonthlyReportXLSX(partnerId, year, month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="portcont-mensal-${partnerId}-${year}-${month}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/annual/:partnerId/:year', async (req, res, next) => {
  try {
    const partnerId = req.params.partnerId;
    const year = parseInt(req.params.year, 10);
    const report = await service.getAnnualReportData(partnerId, year);
    res.json(report);
  } catch (err) { next(err); }
});

router.get('/annual/:partnerId/:year/xlsx', async (req, res, next) => {
  try {
    const partnerId = req.params.partnerId;
    const year = parseInt(req.params.year, 10);
    const buffer = await service.exportAnnualReportXLSX(partnerId, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="portcont-anual-${partnerId}-${year}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

export default router;