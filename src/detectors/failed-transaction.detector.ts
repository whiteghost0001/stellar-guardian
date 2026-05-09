import logger from '../core/logger';
import { BaseDetector } from '../core/detector.interface';
import { StellarEvent, DetectionResult, DetectorConfig } from '../core/types';

export class FailedTransactionDetector extends BaseDetector {
  private consecutiveFailures: Map<string, number> = new Map();

  constructor(config?: Partial<DetectorConfig>) {
    super({
      id: 'failed-transaction-detector',
      name: 'Failed Transaction Detector',
      description: 'Detects failed transactions and contract calls',
      enabled: true,
      parameters: {
        alertOnConsecutiveFailures: Number(process.env.FAILED_TX_CONSECUTIVE_THRESHOLD) || 3,
        monitorSpecificContracts: [],
        ...config?.parameters
      },
      ...config
    });
  }

  async detect(event: StellarEvent): Promise<DetectionResult | null> {
    try {
      const isFailed =
        event.eventType === 'transaction_failed' ||
        this.isContractInvocationFailure(event);

      if (!isFailed) {
        // Reset consecutive counter on success
        if (
          event.eventType === 'contract_invocation' &&
          event.eventData?.status === 'success'
        ) {
          this.consecutiveFailures.set(event.contractId, 0);
        }
        return null;
      }

      const count = (this.consecutiveFailures.get(event.contractId) ?? 0) + 1;
      this.consecutiveFailures.set(event.contractId, count);

      const threshold = this.config.parameters.alertOnConsecutiveFailures;
      if (count < threshold) return null;

      // Reset after alerting
      this.consecutiveFailures.set(event.contractId, 0);

      return {
        isMatch: true,
        severity: this.calculateSeverity(event),
        title: 'Failed Transaction',
        description: this.generateDescription(event, count),
        metadata: {
          contractId: event.contractId,
          transactionId: event.transactionId,
          consecutiveFailures: count,
          errorCode: event.eventData?.error_code,
          errorMessage: event.eventData?.error_message,
          gasUsed: event.eventData?.gas_used,
          timestamp: event.timestamp
        }
      };
    } catch (error) {
      logger.error(`Error processing event: ${error}`);
      return null;
    }
  }

  private isContractInvocationFailure(event: StellarEvent): boolean {
    return (
      event.eventType === 'contract_invocation' &&
      event.eventData?.status === 'failed'
    );
  }

  private calculateSeverity(event: StellarEvent): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const errorCode = event.eventData?.error_code;
    const gasUsed = event.eventData?.gas_used || 0;

    if (errorCode === 'OUT_OF_GAS' || errorCode?.startsWith('SYSTEM_')) return 'CRITICAL';
    if (errorCode === 'CONTRACT_PANIC' || errorCode === 'RUNTIME_ERROR') return 'HIGH';
    if (gasUsed > 1000000) return 'MEDIUM';
    return 'LOW';
  }

  private generateDescription(event: StellarEvent, count: number): string {
    const errorCode = event.eventData?.error_code || 'UNKNOWN';
    const errorMessage = event.eventData?.error_message || 'No error message';
    return `Transaction ${event.transactionId} failed (${count} consecutive): ${errorCode} - ${errorMessage}`;
  }

  getName(): string { return this.config.name; }
  getDescription(): string { return this.config.description; }
  getVersion(): string { return '1.0.0'; }
}
