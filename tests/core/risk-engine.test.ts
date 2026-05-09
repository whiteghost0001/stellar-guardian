import { RiskScoringEngine } from '../../src/core/risk-engine';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client');

describe('RiskScoringEngine', () => {
  let riskEngine: RiskScoringEngine;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      riskScore: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn()
      }
    } as any;

    riskEngine = new RiskScoringEngine(mockPrisma);
  });

  describe('calculateRiskScore', () => {
    test('should calculate risk score correctly', async () => {
      const factors = [
        { type: 'age', weight: 0.3, value: 0.8, description: 'New contract' },
        { type: 'volume', weight: 0.4, value: 0.2, description: 'Low volume' },
        { type: 'failures', weight: 0.3, value: 0.5, description: 'Some failures' }
      ];

      mockPrisma.riskScore.upsert.mockResolvedValue({
        id: 'risk1',
        entityId: 'CONTRACT123',
        entityType: 'CONTRACT',
        score: 46,
        factors: factors,
        lastUpdated: new Date()
      });

      const score = await riskEngine.calculateRiskScore('CONTRACT123', 'CONTRACT', factors);

      // Expected: (0.8*0.3 + 0.2*0.4 + 0.5*0.3) * 100 = 46
      expect(score).toBe(46);
      expect(mockPrisma.riskScore.upsert).toHaveBeenCalledWith({
        where: {
          entityId_entityType: {
            entityId: 'CONTRACT123',
            entityType: 'CONTRACT'
          }
        },
        update: {
          score: 46,
          factors: factors,
          lastUpdated: expect.any(Date)
        },
        create: {
          entityId: 'CONTRACT123',
          entityType: 'CONTRACT',
          score: 46,
          factors: factors,
          lastUpdated: expect.any(Date)
        }
      });
    });

    test('should handle empty factors', async () => {
      mockPrisma.riskScore.upsert.mockResolvedValue({
        id: 'risk2',
        entityId: 'CONTRACT456',
        entityType: 'CONTRACT',
        score: 0,
        factors: [],
        lastUpdated: new Date()
      });

      const score = await riskEngine.calculateRiskScore('CONTRACT456', 'CONTRACT', []);
      expect(score).toBe(0);
    });

    test('should cap score at 100', async () => {
      const factors = [
        { type: 'high_risk', weight: 1.0, value: 2.0, description: 'Very high risk' }
      ];

      mockPrisma.riskScore.upsert.mockResolvedValue({
        id: 'risk3',
        entityId: 'CONTRACT789',
        entityType: 'CONTRACT',
        score: 100,
        factors: factors,
        lastUpdated: new Date()
      });

      const score = await riskEngine.calculateRiskScore('CONTRACT789', 'CONTRACT', factors);
      expect(score).toBe(100);
    });
  });

  describe('generateContractRiskFactors', () => {
    test('should generate risk factors for new contract', () => {
      const contractData = {
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        transactionCount: 100,
        failedTransactionRatio: 0.1,
        largeTransferCount: 5,
        totalTransfers: 50
      };

      const factors = riskEngine.generateContractRiskFactors(contractData);

      expect(factors).toHaveLength(5);
      expect(factors.find(f => f.type === 'contract_age')).toBeTruthy();
      expect(factors.find(f => f.type === 'transaction_volume')).toBeTruthy();
      expect(factors.find(f => f.type === 'failure_rate')).toBeTruthy();
      expect(factors.find(f => f.type === 'large_transfer_frequency')).toBeTruthy();
      expect(factors.find(f => f.type === 'code_complexity')).toBeTruthy();
    });
  });

  describe('generateAccountRiskFactors', () => {
    test('should generate risk factors for account', () => {
      const accountData = {
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        dailyTransactionCount: 50,
        balanceVolatility: 0.3,
        riskyContractInteractions: 10,
        totalInteractions: 100
      };

      const factors = riskEngine.generateAccountRiskFactors(accountData);

      expect(factors).toHaveLength(4);
      expect(factors.find(f => f.type === 'account_age')).toBeTruthy();
      expect(factors.find(f => f.type === 'transaction_frequency')).toBeTruthy();
      expect(factors.find(f => f.type === 'balance_volatility')).toBeTruthy();
      expect(factors.find(f => f.type === 'risky_interactions')).toBeTruthy();
    });
  });
});