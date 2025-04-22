import queue, { WebhookQueue } from '../src/services/queue.js';

describe('WebhookQueue Singleton', () => {
  beforeEach(() => {
    // Clear the queue by dequeuing all items
    while (queue.size() > 0) {
      queue.dequeue();
    }
  });

  it('default export is an instance of WebhookQueue', () => {
    expect(queue).toBeInstanceOf(WebhookQueue);
  });

  it('enqueue increments queue size without error when under threshold', async () => {
    await expect(queue.enqueue('test-item')).resolves.toBeUndefined();
    expect(queue.size()).toBe(1);
  });
});