import { BaseDetector } from '../core/detector.interface';
import { StellarEvent, DetectionResult, DetectorConfig } from '../core/types';

export class WhaleTransferDetector extends BaseDetector {
  constructor(config?: Partial<DetectorConfig>) {
    super({
      id: 'whale-transfer-detector',
      name: 'Whale Transfer Detector',
      description: 'Detects large value transfers',
      enabled: true,
      parameters: {
        xlmThreshold: 1000000,
        usdcThreshold: 100000,
        customTokenThresholds: {},
        monitoredAssets: ['XLM', 'USDC'],
        ...config?.parameters
      },
      ...config
    });
  }

  async detect(event: StellarEvent): Promise<DetectionResult | null> {
    try {
      if (!this.isTransferEvent(event)) {
        return null;
      }

      const transferData = this.extractTransferData(event);
      if (!transferData) {
        return null;
      }

      const isWhaleTransfer = this.isLargeTransfer(transferData);
      if (!isWhaleTransfer) {
        return null;
      }

      const severity = this.calculateSeverity(transferData);

      return {
        isMatch: true,
        severity,
        title: 'Large Transfer Detected',
        description: this.generateDescription(transferData),
        metadata: {
          ...transferData,
          contractId: event.contractId,
          transactionId: event.transactionId,
          timestamp: event.timestamp
        }
      };
    } catch (error) {
      console.error(`Error processing whale transfer event: ${error}`);
      return null;
    }
  }

  private isTransferEvent(event: StellarEvent): boolean {
    return event.eventType === 'transfer' || 
           event.eventType === 'contract_transfer' ||
           (event.eventType === 'contract_invocation' && 
            event.eventData?.function === 'transfer');
  }

  private extractTransferData(event: StellarEvent): any {
    const data = event.eventData;
    
    return {
      from: data?.from || data?.source,
      to: data?.to || data?.destination,
      amount: this.parseAmount(data?.amount),
      asset: data?.asset || data?.asset_code || 'XLM',
      assetIssuer: data?.asset_issuer,
      decimals: data?.decimals || 7
    };
  }

  private parseAmount(amount: any): number {
    if (typeof amount === 'string') {
      return parseFloat(amount);
    }
    if (typeof amount === 'number') {
      return amount;
    }
    return 0;
  }

  private isLargeTransfer(transferData: any): boolean {
    const { amount, asset } = transferData;
    const thresholds = this.config.parameters;

    switch (asset.toUpperCase()) {
      case 'XLM':
        return amount >= thresholds.xlmThreshold;
      case 'USDC':
        return amount >= thresholds.usdcThreshold;
      default:
        const customThreshold = thresholds.customTokenThresholds[asset];
        return customThreshold ? amount >= customThreshold : false;
    }
  }

  private calculateSeverity(transferData: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const { amount, asset } = transferData;
    const thresholds = this.config.parameters;

    let multiplier = 1;
    switch (asset.toUpperCase()) {
      case 'XLM':
        multiplier = amount / thresholds.xlmThreshold;
        break;
      case 'USDC':
        multiplier = amount / thresholds.usdcThreshold;
        break;
      default:
        const customThreshold = thresholds.customTokenThresholds[asset];
        multiplier = customThreshold ? amount / customThreshold : 1;
    }

    if (multiplier >= 10) return 'CRITICAL';
    if (multiplier >= 5) return 'HIGH';
    if (multiplier >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private generateDescription(transferData: any): string {
    const { from, to, amount, asset } = transferData;
    return `Large ${asset} transfer: ${amount.toLocaleString()} ${asset} from ${from} to ${to}`;
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