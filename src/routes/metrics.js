import express from 'express';
const router = express.Router();

import { register } from '../utils/metrics.js';

/**
 * GET /
 * Returns Prometheus-formatted metrics
 * Mounted at /metrics in server.js
 */
router.get('/', async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
