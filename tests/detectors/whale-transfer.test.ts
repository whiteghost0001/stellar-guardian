import { WhaleTransferDetector } from '../../src/detectors/whale-transfer.detector';
import { StellarEvent } from '../../src/core/types';

describe('WhaleTransferDetector', () => {
  let detector: WhaleTransferDetector;

  beforeEach(() => {
    detector = new WhaleTransferDetector({
      parameters: {
        xlmThreshold: 1000000,
        usdcThreshold: 100000,
        customTokenThresholds: {
          'TEST': 50000
        }
      }
    });
  });

  describe('detect', () => {
    test('should detect large XLM transfer', async () => {
      const event: StellarEvent = {
        id: 'test-1',
        contractId: 'CTEST123',
        eventType: 'transfer',
        eventData: {
          from: 'GTEST1',
          to: 'GTEST2',
          amount: '2000000',
          asset: 'XLM'
        },
        transactionId: 'tx123',
        ledgerNumber: 12345,
        timestamp: new Date(),
        blockHash: 'hash123'
      };

      const result = await detector.detect(event);

      expect(result).toBeTruthy();
      expect(result?.isMatch).toBe(true);
      expect(result?.severity).toBe('MEDIUM');
      expect(result?.title).toContain('Large Transfer');
    });

    test('should detect large USDC transfer with HIGH severity', async () => {
      const event: StellarEvent = {
        id: 'test-2',
        contractId: 'CTEST123',
        eventType: 'contract_transfer',
        eventData: {
          from: 'GTEST1',
          to: 'GTEST2',
          amount: '500000',
          asset: 'USDC'
        },
        transactionId: 'tx124',
        ledgerNumber: 12346,
        timestamp: new Date(),
        blockHash: 'hash124'
      };

      const result = await detector.detect(event);

      expect(result).toBeTruthy();
      expect(result?.severity).toBe('HIGH');
    });

    test('should not detect small transfers', async () => {
      const event: StellarEvent = {
        id: 'test-3',
        contractId: 'CTEST123',
        eventType: 'transfer',
        eventData: {
          from: 'GTEST1',
          to: 'GTEST2',
          amount: '1000',
          asset: 'XLM'
        },
        transactionId: 'tx125',
        ledgerNumber: 12347,
        timestamp: new Date(),
        blockHash: 'hash125'
      };

      const result = await detector.detect(event);
      expect(result).toBeNull();
    });

    test('should handle custom token thresholds', async () => {
      const event: StellarEvent = {
        id: 'test-4',
        contractId: 'CTEST123',
        eventType: 'transfer',
        eventData: {
          from: 'GTEST1',
          to: 'GTEST2',
          amount: '75000',
          asset: 'TEST'
        },
        transactionId: 'tx126',
        ledgerNumber: 12348,
        timestamp: new Date(),
        blockHash: 'hash126'
      };

      const result = await detector.detect(event);

      expect(result).toBeTruthy();
      expect(result?.isMatch).toBe(true);
    });

    test('should ignore non-transfer events', async () => {
      const event: StellarEvent = {
        id: 'test-5',
        contractId: 'CTEST123',
        eventType: 'contract_created',
        eventData: {
          creator: 'GTEST1'
        },
        transactionId: 'tx127',
        ledgerNumber: 12349,
        timestamp: new Date(),
        blockHash: 'hash127'
      };

      const result = await detector.detect(event);
      expect(result).toBeNull();
    });
  });
});