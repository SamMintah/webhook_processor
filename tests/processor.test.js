import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { processWithRetry } from '../src/services/processor.js';
import { logger } from '../src/utils/logger.js';

describe('processWithRetry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should delay between 100 and 300 ms on success first attempt', async () => {
    const randomMock = jest.spyOn(Math, 'random')
      .mockImplementationOnce(() => 0.5) // delay ~200ms
      .mockImplementationOnce(() => 0.5); // first attempt success

    const start = Date.now();
    await processWithRetry({ foo: 'bar' });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThanOrEqual(300);
    expect(randomMock).toHaveBeenCalledTimes(2);
  });

  test('should retry once on failure then succeed', async () => {
    const randomMock = jest.spyOn(Math, 'random')
      .mockImplementationOnce(() => 0.5)   // delay1 ~200ms
      .mockImplementationOnce(() => 0.05)  // first attempt fails
      .mockImplementationOnce(() => 0.5)   // delay2 ~200ms
      .mockImplementationOnce(() => 0.5);  // retry succeeds

    const infoSpy = jest.spyOn(logger, 'info');
    const warnSpy = jest.spyOn(logger, 'warn');
    const errorSpy = jest.spyOn(logger, 'error');

    await expect(processWithRetry({ foo: 'bar' })).resolves.toEqual({ success: true, item: { foo: 'bar' } });

    expect(warnSpy).toHaveBeenCalledWith(
      { item: { foo: 'bar' }, error: 'Processing failed' },
      'Item processing failed'
    );
    expect(infoSpy).toHaveBeenCalledWith(
      { item: { foo: 'bar' } },
      'Retrying item processing'
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(randomMock).toHaveBeenCalledTimes(4);
  });

  test('should retry once on failure then fail', async () => {
    const randomMock = jest.spyOn(Math, 'random')
      .mockImplementationOnce(() => 0.5)   // delay1 ~200ms
      .mockImplementationOnce(() => 0.05)  // first attempt fails
      .mockImplementationOnce(() => 0.5)   // delay2 ~200ms
      .mockImplementationOnce(() => 0.05); // retry fails

    const infoSpy = jest.spyOn(logger, 'info');
    const errorSpy = jest.spyOn(logger, 'error');

    await expect(processWithRetry({ foo: 'bar' })).rejects.toThrow('Processing failed');

    expect(infoSpy).toHaveBeenCalledWith(
      { item: { foo: 'bar' } },
      'Retrying item processing'
    );
    expect(errorSpy).toHaveBeenCalledWith(
      { item: { foo: 'bar' }, error: 'Processing failed' },
      'Item processing failed after retry'
    );
    expect(randomMock).toHaveBeenCalledTimes(4);
  });
});
