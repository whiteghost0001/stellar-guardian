import logger from './logger';
import { PrismaClient } from '@prisma/client';
import { RiskFactor } from './types';

export class RiskScoringEngine {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculateRiskScore(
    entityId: string, 
    entityType: 'CONTRACT' | 'ACCOUNT',
    factors: RiskFactor[]
  ): Promise<number> {
    let totalScore = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      const weightedScore = factor.value * factor.weight;
      totalScore += weightedScore;
      totalWeight += factor.weight;
    }

    const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    const finalScore = Math.min(Math.max(normalizedScore, 0), 100);

    await this.updateRiskScore(entityId, entityType, finalScore, factors);
    return finalScore;
  }

  async updateRiskScore(
    entityId: string,
    entityType: 'CONTRACT' | 'ACCOUNT',
    score: number,
    factors: RiskFactor[]
  ): Promise<void> {
    await this.prisma.riskScore.upsert({
      where: {
        entityId_entityType: {
          entityId,
          entityType
        }
      },
      update: {
        score,
        factors: factors as any,
        lastUpdated: new Date()
      },
      create: {
        entityId,
        entityType,
        score,
        factors: factors as any,
        lastUpdated: new Date()
      }
    });
  }

  async getRiskScore(entityId: string, entityType: 'CONTRACT' | 'ACCOUNT'): Promise<number | null> {
    const riskScore = await this.prisma.riskScore.findUnique({
      where: {
        entityId_entityType: {
          entityId,
          entityType
        }
      }
    });

    return riskScore?.score || null;
  }

  // TODO: make this more sophisticated
  generateContractRiskFactors(contractData: any): RiskFactor[] {
    const factors: RiskFactor[] = [];

    if (contractData.createdAt) {
      const ageInDays = (Date.now() - new Date(contractData.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const ageFactor = Math.max(0, 1 - (ageInDays / 365));
      factors.push({
        type: 'contract_age',
        weight: 0.2,
        value: ageFactor,
        description: `Contract age: ${ageInDays.toFixed(0)} days`
      });
    }

    if (contractData.transactionCount) {
      const volumeFactor = Math.min(contractData.transactionCount / 10000, 1);
      factors.push({
        type: 'transaction_volume',
        weight: 0.15,
        value: 1 - volumeFactor,
        description: `Transaction count: ${contractData.transactionCount}`
      });
    }

    if (contractData.failedTransactionRatio) {
      factors.push({
        type: 'failure_rate',
        weight: 0.3,
        value: contractData.failedTransactionRatio,
        description: `Failed transaction ratio: ${(contractData.failedTransactionRatio * 100).toFixed(1)}%`
      });
    }

    // TODO: implement actual code complexity analysis
    factors.push({
      type: 'code_complexity',
      weight: 0.1,
      value: 0.5,
      description: 'Code complexity analysis pending'
    });

    if (contractData.largeTransferCount !== undefined && contractData.totalTransfers) {
      const freq = contractData.largeTransferCount / contractData.totalTransfers;
      factors.push({
        type: 'large_transfer_frequency',
        weight: 0.25,
        value: freq,
        description: `Large transfer frequency: ${(freq * 100).toFixed(1)}%`
      });
    }

    return factors;
  }

  generateAccountRiskFactors(accountData: any): RiskFactor[] {
    const factors: RiskFactor[] = [];

    if (accountData.createdAt) {
      const ageInDays = (Date.now() - new Date(accountData.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const ageFactor = Math.max(0, 1 - (ageInDays / 180));
      factors.push({
        type: 'account_age',
        weight: 0.3,
        value: ageFactor,
        description: `Account age: ${ageInDays.toFixed(0)} days`
      });
    }

    if (accountData.dailyTransactionCount) {
      const frequencyFactor = Math.min(accountData.dailyTransactionCount / 100, 1);
      factors.push({
        type: 'transaction_frequency',
        weight: 0.2,
        value: frequencyFactor,
        description: `Daily transactions: ${accountData.dailyTransactionCount}`
      });
    }

    if (accountData.balanceVolatility !== undefined) {
      factors.push({
        type: 'balance_volatility',
        weight: 0.25,
        value: accountData.balanceVolatility,
        description: `Balance volatility: ${(accountData.balanceVolatility * 100).toFixed(1)}%`
      });
    }

    if (accountData.riskyContractInteractions !== undefined && accountData.totalInteractions) {
      const ratio = accountData.riskyContractInteractions / accountData.totalInteractions;
      factors.push({
        type: 'risky_interactions',
        weight: 0.25,
        value: ratio,
        description: `Risky contract interactions: ${(ratio * 100).toFixed(1)}%`
      });
    }

    return factors;
  }

  async getTopRiskyEntities(entityType: 'CONTRACT' | 'ACCOUNT', limit: number = 10) {
    return await this.prisma.riskScore.findMany({
      where: { entityType },
      orderBy: { score: 'desc' },
      take: limit
    });
  }
}