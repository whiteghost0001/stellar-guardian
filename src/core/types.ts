import { ContractEvent, SecurityAlert, RiskScore } from '@prisma/client';

export interface StellarEvent {
  id: string;
  contractId: string;
  eventType: string;
  eventData: any;
  transactionId: string;
  ledgerNumber: number;
  timestamp: Date;
  blockHash: string;
}

export interface DetectionResult {
  isMatch: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface DetectorConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  parameters: Record<string, any>;
}

export interface RiskFactor {
  type: string;
  weight: number;
  value: number;
  description: string;
}

export interface WebhookPayload {
  alertId: string;
  severity: string;
  alertType: string;
  title: string;
  description: string;
  contractId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  detectors: DetectorConfig[];
  dependencies?: string[];
}

export interface MonitoringMetrics {
  eventsProcessed: number;
  alertsGenerated: number;
  detectorsActive: number;
  avgProcessingTime: number;
  errorRate: number;
}

export interface SorobanRPCResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface LedgerEntry {
  ledgerNumber: number;
  transactions: TransactionEntry[];
  timestamp: string;
  hash: string;
}

export interface TransactionEntry {
  id: string;
  operations: OperationEntry[];
  result: string;
  fee: string;
  sourceAccount: string;
}

export interface OperationEntry {
  type: string;
  contractId?: string;
  function?: string;
  parameters?: any[];
  result?: any;
}