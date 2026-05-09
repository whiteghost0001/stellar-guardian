import express from 'express';
import { PrismaClient } from '@prisma/client';
import { RiskScoringEngine } from '../core/risk-engine';

const router = express.Router();

export function createDashboardAPI(prisma: PrismaClient, riskEngine: RiskScoringEngine) {
  
  router.get('/alerts', async (req, res) => {
    try {
      const { page = 1, limit = 20, severity, status } = req.query;
      
      const where: any = {};
      if (severity) where.severity = severity;
      if (status) where.status = status;

      const alerts = await prisma.securityAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          contractEvent: true
        }
      });

      const total = await prisma.securityAlert.count({ where });

      res.json({
        alerts,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  router.get('/alerts/:id', async (req, res) => {
    try {
      const alert = await prisma.securityAlert.findUnique({
        where: { id: req.params.id },
        include: {
          contractEvent: true,
          riskScore: true
        }
      });

      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch alert' });
    }
  });

  router.patch('/alerts/:id', async (req, res) => {
    try {
      const { status } = req.body;
      
      const alert = await prisma.securityAlert.update({
        where: { id: req.params.id },
        data: { status }
      });

      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update alert' });
    }
  });

  router.get('/events', async (req, res) => {
    try {
      const { page = 1, limit = 20, contractId, eventType } = req.query;
      
      const where: any = {};
      if (contractId) where.contractId = contractId;
      if (eventType) where.eventType = eventType;

      const events = await prisma.contractEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      });

      const total = await prisma.contractEvent.count({ where });

      res.json({
        events,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  router.get('/contracts', async (req, res) => {
    try {
      const contracts = await prisma.watchedContract.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      res.json(contracts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  router.post('/contracts', async (req, res) => {
    try {
      const { contractId, name, description, tags, alertThresholds } = req.body;
      
      const contract = await prisma.watchedContract.create({
        data: {
          contractId,
          name,
          description,
          tags: tags || [],
          alertThresholds: alertThresholds || {}
        }
      });

      res.status(201).json(contract);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add contract' });
    }
  });

  router.get('/risk-scores', async (req, res) => {
    try {
      const { entityType, limit = 10 } = req.query;
      
      const riskScores = await riskEngine.getTopRiskyEntities(
        entityType as 'CONTRACT' | 'ACCOUNT',
        Number(limit)
      );

      res.json(riskScores);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch risk scores' });
    }
  });

  // TODO: add more comprehensive stats
  router.get('/stats', async (req, res) => {
    try {
      const [
        totalAlerts,
        activeAlerts,
        totalContracts,
        totalEvents
      ] = await Promise.all([
        prisma.securityAlert.count(),
        prisma.securityAlert.count({ where: { status: 'ACTIVE' } }),
        prisma.watchedContract.count({ where: { isActive: true } }),
        prisma.contractEvent.count()
      ]);

      res.json({
        totalAlerts,
        activeAlerts,
        totalContracts,
        totalEvents
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  return router;
}