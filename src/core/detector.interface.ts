import { StellarEvent, DetectionResult, DetectorConfig } from './types';

export abstract class BaseDetector {
  protected config: DetectorConfig;

  constructor(config: DetectorConfig) {
    this.config = config;
  }

  abstract detect(event: StellarEvent): Promise<DetectionResult | null>;
  abstract getName(): string;
  abstract getDescription(): string;
  abstract getVersion(): string;

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): DetectorConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<DetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export interface DetectorRegistry {
  register(detector: BaseDetector): void;
  unregister(detectorId: string): void;
  getDetector(detectorId: string): BaseDetector | undefined;
  getAllDetectors(): BaseDetector[];
  getEnabledDetectors(): BaseDetector[];
}

export interface DetectorEngine {
  processEvent(event: StellarEvent): Promise<DetectionResult[]>;
  addDetector(detector: BaseDetector): void;
  removeDetector(detectorId: string): void;
  getMetrics(): Promise<any>;
}