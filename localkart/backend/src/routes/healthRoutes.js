import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    status: 'ok',
    mongodb: connected ? 'connected' : 'disconnected',
  });
});

export default router;
