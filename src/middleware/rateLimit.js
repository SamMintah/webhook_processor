import config from '../config.js';
import { incTooMany } from '../utils/metrics.js';
 
let hitCount = 0;
 
export default function rateLimitMiddleware(req, res, next) {
  hitCount += 1;
  if (hitCount > config.OVERLOAD_THRESHOLD) {
    incTooMany();
    return res.status(429).json({ error: 'Too Many Requests' });
  }
  next();
}
