// src/middleware/validateJson.js

export default function validateJson(req, res, next) {
  const isJson = req.is('application/json');
  const hasBodyObject = typeof req.body === 'object';

  if (!isJson || !hasBodyObject) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  next();
}
