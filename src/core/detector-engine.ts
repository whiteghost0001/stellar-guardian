import logger from './logger';
import { BaseDetector, DetectorRegistry, DetectorEngine } from './detector.interface';
import { StellarEvent, DetectionResult, MonitoringMetrics } from './types';
import { PrismaClient } from '@prisma/client';

export class DetectorRegistryImpl implements DetectorRegistry {
  private detectors: Map<string, BaseDetector> = new Map();

  register(detector: BaseDetector): void {
    this.detectors.set(detector.getName(), detector);
    logger.info(`Registered detector: ${detector.getName()}`);
  }

  unregister(detectorId: string): void {
    this.detectors.delete(detectorId);
    logger.info(`Unregistered detector: ${detectorId}`);
  }

  getDetector(detectorId: string): BaseDetector | undefined {
    return this.detectors.get(detectorId);
  }

  getAllDetectors(): BaseDetector[] {
    return Array.from(this.detectors.values());
  }

  getEnabledDetectors(): BaseDetector[] {
    return Array.from(this.detectors.values()).filter(d => d.isEnabled());
  }
}

export class DetectorEngineImpl implements DetectorEngine {
  private registry: DetectorRegistry;
  private prisma: PrismaClient;
  private metrics: MonitoringMetrics;

  constructor(prisma: PrismaClient) {
    this.registry = new DetectorRegistryImpl();
    this.prisma = prisma;
    this.metrics = {
      eventsProcessed: 0,
      alertsGenerated: 0,
      detectorsActive: 0,
      avgProcessingTime: 0,
      errorRate: 0
    };
  }

  async processEvent(event: StellarEvent): Promise<DetectionResult[]> {
    const startTime = Date.now();
    const results: DetectionResult[] = [];
    const enabledDetectors = this.registry.getEnabledDetectors();
    
    this.metrics.detectorsActive = enabledDetectors.length;
    
    const detectionPromises = enabledDetectors.map(async (detector) => {
      try {
        const detectorStartTime = Date.now();
        const result = await detector.detect(event);
        const executionTime = Date.now() - detectorStartTime;
        
        // Log detector execution
        await this.logDetectorExecution(detector.getName(), 'SUCCESS', executionTime);
        
        return result;
      } catch (error) {
        logger.error(`Detector ${detector.getName()} failed:`, error);
        await this.logDetectorExecution(detector.getName(), 'ERROR', 0, error);
        return null;
      }
    });

    const detectionResults = await Promise.allSettled(detectionPromises);
    
    for (const result of detectionResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
        
        // Store alert in database
        await this.storeAlert(result.value, event);
        this.metrics.alertsGenerated++;
      }
    }

    // Update metrics
    this.metrics.eventsProcessed++;
    const processingTime = Date.now() - startTime;
    this.metrics.avgProcessingTime = 
      (this.metrics.avgProcessingTime + processingTime) / 2;

    return results;
  }

  addDetector(detector: BaseDetector): void {
    this.registry.register(detector);
  }

  removeDetector(detectorId: string): void {
    this.registry.unregister(detectorId);
  }

  async getMetrics(): Promise<MonitoringMetrics> {
    return { ...this.metrics };
  }

  private async logDetectorExecution(
    detectorId: string, 
    status: 'SUCCESS' | 'ERROR' | 'TIMEOUT', 
    executionTime: number,
    error?: any
  ): Promise<void> {
    try {
      await this.prisma.detectorLog.create({
        data: {
          detectorId,
          status,
          executionTime,
          message: error ? error.message : undefined,
          errorDetails: error ? { stack: error.stack, name: error.name } : undefined
        }
      });
    } catch (logError) {
      logger.error('Failed to log detector execution:', logError);
    }
  }

  private async storeAlert(result: DetectionResult, event: StellarEvent): Promise<void> {
    try {
      await this.prisma.securityAlert.create({
        data: {
          severity: result.severity,
          alertType: this.extractAlertType(result.title),
          title: result.title,
          description: result.description,
          metadata: result.metadata || {},
          contractEventId: await this.getOrCreateContractEvent(event)
        }
      });
    } catch (error) {
      logger.error('Failed to store alert:', error);
    }
  }

  private extractAlertType(title: string): string {
    if (title.toLowerCase().includes('whale')) return 'whale_transfer';
    if (title.toLowerCase().includes('failed')) return 'failed_transaction';
    if (title.toLowerCase().includes('suspicious')) return 'suspicious_activity';
    return 'general';
  }

  private async getOrCreateContractEvent(event: StellarEvent): Promise<string> {
    try {
      // Check if event already exists
      let contractEvent = await this.prisma.contractEvent.findFirst({
        where: {
          transactionId: event.transactionId,
          contractId: event.contractId,
          eventType: event.eventType
        }
      });

      if (!contractEvent) {
        contractEvent = await this.prisma.contractEvent.create({
          data: {
            contractId: event.contractId,
            eventType: event.eventType,
            eventData: event.eventData,
            transactionId: event.transactionId,
            ledgerNumber: event.ledgerNumber,
            timestamp: event.timestamp,
            blockHash: event.blockHash
          }
        });
      }

      return contractEvent.id;
    } catch (error) {
      logger.error('Failed to create contract event:', error);
      throw error;
    }
  }

  getRegistry(): DetectorRegistry {
    return this.registry;
  }
}