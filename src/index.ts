import express from 'express';
import { PrismaClient } from '@prisma/client';
import { SorobanIngestor } from './ingestor/soroban-ingestor';
import { DetectorEngineImpl } from './core/detector-engine';
import { RiskScoringEngine } from './core/risk-engine';
import { WebhookService } from './alerts/webhook-service';
import { PluginLoader } from './plugins/plugin-loader';
import { WhaleTransferDetector } from './detectors/whale-transfer.detector';
import { FailedTransactionDetector } from './detectors/failed-transaction.detector';
import { createDashboardAPI } from './dashboard/api';
import logger from './core/logger';
import dotenv from 'dotenv';

dotenv.config();

class StellarGuardian {
  private prisma: PrismaClient;
  private ingestor: SorobanIngestor;
  private detectorEngine: DetectorEngineImpl;
  private riskEngine: RiskScoringEngine;
  private webhookService: WebhookService;
  private pluginLoader: PluginLoader;
  private app: express.Application;

  constructor() {
    this.prisma = new PrismaClient();
    this.ingestor = new SorobanIngestor(
      process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
    );
    this.detectorEngine = new DetectorEngineImpl(this.prisma);
    this.riskEngine = new RiskScoringEngine(this.prisma);
    this.webhookService = new WebhookService(this.prisma);
    this.pluginLoader = new PluginLoader('./plugins');
    this.app = express();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Stellar Guardian...');

    this.app.use(express.json());
    this.app.use('/api', createDashboardAPI(this.prisma, this.riskEngine));

    await this.loadBuiltInDetectors();
    await this.loadPluginDetectors();
    this.setupEventListeners();

    logger.info('Stellar Guardian initialized');
  }

  private async loadBuiltInDetectors(): Promise<void> {
    logger.info('Loading built-in detectors...');
    
    const whaleDetector = new WhaleTransferDetector();
    const failedTxDetector = new FailedTransactionDetector();
    
    this.detectorEngine.addDetector(whaleDetector);
    this.detectorEngine.addDetector(failedTxDetector);
    
    logger.info('Built-in detectors loaded');
  }

  private async loadPluginDetectors(): Promise<void> {
    logger.info('Loading plugin detectors...');
    
    try {
      const pluginDetectors = await this.pluginLoader.loadAllPlugins();
      
      for (const detector of pluginDetectors) {
        this.detectorEngine.addDetector(detector);
      }
      
      logger.info(`Loaded ${pluginDetectors.length} plugin detectors`);
    } catch (error) {
      logger.error('Failed to load plugin detectors:', error);
    }
  }

  private setupEventListeners(): void {
    this.ingestor.on('contractEvent', async (event) => {
      try {
        const results = await this.detectorEngine.processEvent(event);
        
        for (const result of results) {
          if (result.isMatch) {
            await this.sendWebhookAlert(result, event);
          }
        }
      } catch (error) {
        logger.error('Error processing contract event:', error);
      }
    });

    this.ingestor.on('error', (error) => {
      logger.error('Ingestor error:', error);
    });

    this.ingestor.on('ledgerProcessed', (ledgerNumber) => {
      logger.info(`Processed ledger: ${ledgerNumber}`);
    });
  }

  private async sendWebhookAlert(result: any, event: any): Promise<void> {
    try {
      const payload = {
        alertId: `alert-${Date.now()}`,
        severity: result.severity,
        alertType: this.extractAlertType(result.title),
        title: result.title,
        description: result.description,
        contractId: event.contractId,
        timestamp: new Date().toISOString(),
        metadata: result.metadata
      };

      await this.webhookService.sendAlert(payload.alertId, payload);
    } catch (error) {
      logger.error('Failed to send webhook alert:', error);
    }
  }

  private extractAlertType(title: string): string {
    if (title.toLowerCase().includes('whale')) return 'whale_transfer';
    if (title.toLowerCase().includes('failed')) return 'failed_transaction';
    return 'general';
  }

  async start(): Promise<void> {
    await this.initialize();
    
    await this.ingestor.start();
    
    const port = process.env.PORT || 3000;
    this.app.listen(port, () => {
      logger.info(`API server running on port ${port}`);
    });

    logger.info('Stellar Guardian monitoring Stellar network');
  }

  async stop(): Promise<void> {
    logger.info('Stopping Stellar Guardian...');
    
    await this.ingestor.stop();
    await this.prisma.$disconnect();
    
    logger.info('Stellar Guardian stopped');
  }
}

if (require.main === module) {
  const guardian = new StellarGuardian();
  
  guardian.start().catch((error) => {
    logger.error('Failed to start Stellar Guardian:', error);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    await guardian.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await guardian.stop();
    process.exit(0);
  });
}

export default StellarGuardian;