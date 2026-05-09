import { FailedTransactionDetector } from '../../src/detectors/failed-transaction.detector';
import { StellarEvent } from '../../src/core/types';

const makeEvent = (overrides: Partial<StellarEvent> = {}): StellarEvent => ({
  id: 'test-1',
  contractId: 'CTEST123',
  eventType: 'contract_invocation',
  eventData: { status: 'failed', error_code: 'RUNTIME_ERROR', error_message: 'panic' },
  transactionId: 'tx1',
  ledgerNumber: 1,
  timestamp: new Date(),
  blockHash: 'hash1',
  ...overrides
});

describe('FailedTransactionDetector', () => {
  let detector: FailedTransactionDetector;

  beforeEach(() => {
    detector = new FailedTransactionDetector({
      parameters: { alertOnConsecutiveFailures: 3 }
    });
  });

  test('should not alert before threshold is reached', async () => {
    const event = makeEvent();
    expect(await detector.detect(event)).toBeNull();
    expect(await detector.detect(event)).toBeNull();
  });

  test('should alert on reaching consecutive failure threshold', async () => {
    const event = makeEvent();
    await detector.detect(event);
    await detector.detect(event);
    const result = await detector.detect(event);

    expect(result).toBeTruthy();
    expect(result?.isMatch).toBe(true);
    expect(result?.title).toBe('Failed Transaction');
    expect(result?.metadata?.consecutiveFailures).toBe(3);
  });

  test('should reset counter after alerting', async () => {
    const event = makeEvent();
    await detector.detect(event);
    await detector.detect(event);
    await detector.detect(event); // triggers alert + reset
    expect(await detector.detect(event)).toBeNull(); // counter reset to 1
  });

  test('should reset counter on successful invocation', async () => {
    const event = makeEvent();
    await detector.detect(event);
    await detector.detect(event);
    // success resets
    await detector.detect(makeEvent({ eventData: { status: 'success' } }));
    expect(await detector.detect(event)).toBeNull();
  });

  test('should not alert on non-failure events', async () => {
    const event = makeEvent({ eventType: 'contract_created', eventData: {} });
    expect(await detector.detect(event)).toBeNull();
  });

  test('should assign CRITICAL severity for OUT_OF_GAS', async () => {
    const event = makeEvent({ eventData: { status: 'failed', error_code: 'OUT_OF_GAS' } });
    await detector.detect(event);
    await detector.detect(event);
    const result = await detector.detect(event);
    expect(result?.severity).toBe('CRITICAL');
  });

  test('should track failures independently per contract', async () => {
    const eventA = makeEvent({ contractId: 'CA' });
    const eventB = makeEvent({ contractId: 'CB' });
    await detector.detect(eventA);
    await detector.detect(eventA);
    // B only has 1 failure - should not alert
    expect(await detector.detect(eventB)).toBeNull();
    // A reaches threshold
    const result = await detector.detect(eventA);
    expect(result?.isMatch).toBe(true);
  });
});
