import { Server, Horizon } from '@stellar/stellar-sdk';
import { StellarEvent, SorobanRPCResponse } from '../core/types';
import { EventEmitter } from 'events';

export class SorobanIngestor extends EventEmitter {
  private server: Server;
  private rpcUrl: string;
  private isRunning: boolean = false;
  private currentLedger: number = 0;

  constructor(horizonUrl: string, rpcUrl: string) {
    super();
    this.server = new Server(horizonUrl);
    this.rpcUrl = rpcUrl;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Ingestor already running');
    }

    this.isRunning = true;
    console.log('Starting Soroban ingestor...');

    try {
      this.currentLedger = await this.getCurrentLedger();
      console.log(`Starting from ledger: ${this.currentLedger}`);

      await this.startLedgerStream();
      
    } catch (error) {
      console.error('Failed to start ingestor:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('Soroban ingestor stopped');
  }

  private async getCurrentLedger(): Promise<number> {
    try {
      const response = await fetch(`${this.rpcUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestLedger'
        })
      });

      const data: SorobanRPCResponse = await response.json();
      return data.result?.sequence || 0;
    } catch (error) {
      console.error('Failed to get current ledger:', error);
      return 0;
    }
  }

  private async startLedgerStream(): Promise<void> {
    const ledgerStream = this.server.ledgers()
      .cursor('now')
      .stream({
        onmessage: (ledger) => this.processLedger(ledger),
        onerror: (error) => {
          console.error('Ledger stream error:', error);
          this.emit('error', error);
        }
      });
  }

  private async processLedger(ledger: any): Promise<void> {
    try {
      console.log(`Processing ledger ${ledger.sequence}`);
      
      const transactions = await this.getLedgerTransactions(ledger.sequence);
      
      for (const tx of transactions) {
        await this.processTransaction(tx, ledger);
      }
      
      this.currentLedger = ledger.sequence;
      this.emit('ledgerProcessed', ledger.sequence);
      
    } catch (error) {
      console.error(`Error processing ledger ${ledger.sequence}:`, error);
      this.emit('error', error);
    }
  }

  private async getLedgerTransactions(ledgerSequence: number): Promise<any[]> {
    try {
      const transactions = await this.server.transactions()
        .forLedger(ledgerSequence)
        .call();
      
      return transactions.records;
    } catch (error) {
      console.error(`Failed to get transactions for ledger ${ledgerSequence}:`, error);
      return [];
    }
  }

  private async processTransaction(transaction: any, ledger: any): Promise<void> {
    try {
      if (!this.hasContractOperations(transaction)) {
        return;
      }

      const events = await this.extractContractEvents(transaction, ledger);
      
      for (const event of events) {
        this.emit('contractEvent', event);
      }
      
    } catch (error) {
      console.error(`Error processing transaction ${transaction.id}:`, error);
    }
  }

  private hasContractOperations(transaction: any): boolean {
    return transaction.operation_count > 0;
  }

  private async extractContractEvents(transaction: any, ledger: any): Promise<StellarEvent[]> {
    const events: StellarEvent[] = [];
    
    try {
      const operations = await this.server.operations()
        .forTransaction(transaction.id)
        .call();

      for (const operation of operations.records) {
        if (this.isContractOperation(operation)) {
          const contractEvents = await this.parseContractOperation(operation, transaction, ledger);
          events.push(...contractEvents);
        }
      }
      
    } catch (error) {
      console.error(`Failed to extract events from transaction ${transaction.id}:`, error);
    }
    
    return events;
  }

  private isContractOperation(operation: any): boolean {
    return operation.type === 'invoke_host_function' || 
           operation.type === 'create_contract';
  }

  private async parseContractOperation(operation: any, transaction: any, ledger: any): Promise<StellarEvent[]> {
    const events: StellarEvent[] = [];
    
    try {
      if (operation.type === 'invoke_host_function') {
        const contractEvent = await this.parseContractInvocation(operation, transaction, ledger);
        if (contractEvent) {
          events.push(contractEvent);
        }
      }
      
      if (operation.type === 'create_contract') {
        const contractEvent = await this.parseContractCreation(operation, transaction, ledger);
        if (contractEvent) {
          events.push(contractEvent);
        }
      }
      
    } catch (error) {
      console.error(`Failed to parse contract operation:`, error);
    }
    
    return events;
  }

  private async parseContractInvocation(operation: any, transaction: any, ledger: any): Promise<StellarEvent | null> {
    try {
      const contractId = operation.contract || 'unknown';
      const functionName = operation.function || 'unknown';
      
      return {
        id: `${transaction.id}-${operation.id}`,
        contractId,
        eventType: 'contract_invocation',
        eventData: {
          function: functionName,
          parameters: operation.parameters || [],
          result: operation.result,
          status: transaction.successful ? 'success' : 'failed',
          gas_used: operation.gas_used,
          error_code: operation.error_code,
          error_message: operation.error_message
        },
        transactionId: transaction.id,
        ledgerNumber: ledger.sequence,
        timestamp: new Date(transaction.created_at),
        blockHash: ledger.hash
      };
    } catch (error) {
      console.error('Failed to parse contract invocation:', error);
      return null;
    }
  }

  private async parseContractCreation(operation: any, transaction: any, ledger: any): Promise<StellarEvent | null> {
    try {
      const contractId = operation.contract_id || 'unknown';
      
      return {
        id: `${transaction.id}-${operation.id}`,
        contractId,
        eventType: 'contract_created',
        eventData: {
          creator: operation.source_account,
          wasm_hash: operation.wasm_hash,
          salt: operation.salt
        },
        transactionId: transaction.id,
        ledgerNumber: ledger.sequence,
        timestamp: new Date(transaction.created_at),
        blockHash: ledger.hash
      };
    } catch (error) {
      console.error('Failed to parse contract creation:', error);
      return null;
    }
  }

  getCurrentLedgerNumber(): number {
    return this.currentLedger;
  }

  isRunning(): boolean {
    return this.isRunning;
  }

  // TODO: implement historical event querying
  async getContractEvents(contractId: string, fromLedger?: number, toLedger?: number): Promise<StellarEvent[]> {
    return [];
  }
}