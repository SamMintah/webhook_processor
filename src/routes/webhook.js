import express from 'express';
const router = express.Router();
import validateJson from '../middleware/validateJson.js';

import queue from '../services/queue.js';

/**
 * POST /
 * Receives a webhook payload and enqueues for processing.
 * Metrics are tracked by the queue service.
 */
router.post('/', validateJson, async (req, res) => {
  try {
    // Attempt to enqueue the webhook payload
    // The queue handles metrics tracking internally
    await queue.enqueue(req.body);
    
    // Accepted for processing
    return res.status(202).json({ status: 'Accepted' });
  } catch (error) {
    // Queue service already tracks overload metrics
    if (error.message === 'Queue overloaded') {
      return res.status(429).json({ error: 'Too Many Requests' });
    }
    // Handle other errors
    return res.status(500).json({ error: 'Internal server error' });
  }
});


export default router;
