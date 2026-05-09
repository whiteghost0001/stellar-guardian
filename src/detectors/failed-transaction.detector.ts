import { BaseDetector } from '../core/detector.interface';
import { StellarEvent, DetectionResult, DetectorConfig } from '../core/types';

export class FailedTransactionDetector extends BaseDetector {
  constructor(config?: Partial<DetectorConfig>) {
    super({
      id: 'failed-transaction-detector',
      name: 'Failed Transaction Detector',
      description: 'Detects failed transactions and contract calls',
      enabled: true,
      parameters: {
        alertOnConsecutiveFailures: 3,
        monitorSpecificContracts: [],
        ...config?.parameters
      },
      ...config
    });
  }

  async detect(event: StellarEvent): Promise<DetectionResult | null> {
    try {
      if (event.eventType !== 'transaction_failed' && 
          !this.isContractInvocationFailure(event)) {
        return null;
      }

      const severity = this.calculateSeverity(event);
      
      return {
        isMatch: true,
        severity,
        title: 'Failed Transaction',
        description: this.generateDescription(event),
        metadata: {
          contractId: event.contractId,
          transactionId: event.transactionId,
          errorCode: event.eventData?.error_code,
          errorMessage: event.eventData?.error_message,
          gasUsed: event.eventData?.gas_used,
          timestamp: event.timestamp
        }
      };
    } catch (error) {
      console.error(`Error processing event: ${error}`);
      return null;
    }
  }

  private isContractInvocationFailure(event: StellarEvent): boolean {
    return event.eventType === 'contract_invocation' && 
           event.eventData?.status === 'failed';
  }

  private calculateSeverity(event: StellarEvent): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const errorCode = event.eventData?.error_code;
    const gasUsed = event.eventData?.gas_used || 0;
    
    // TODO: add more sophisticated error classification
    if (errorCode === 'OUT_OF_GAS' || errorCode?.startsWith('SYSTEM_')) {
      return 'CRITICAL';
    }
    
    if (errorCode === 'CONTRACT_PANIC' || errorCode === 'RUNTIME_ERROR') {
      return 'HIGH';
    }
    
    if (gasUsed > 1000000) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }

  private generateDescription(event: StellarEvent): string {
    const errorCode = event.eventData?.error_code || 'UNKNOWN';
    const errorMessage = event.eventData?.error_message || 'No error message';
    
    return `Transaction ${event.transactionId} failed: ${errorCode} - ${errorMessage}`;
  }

  getName(): string {
    return this.config.name;
  }

  getDescription(): string {
    return this.config.description;
  }

  getVersion(): string {
    return '1.0.0';
  }
}