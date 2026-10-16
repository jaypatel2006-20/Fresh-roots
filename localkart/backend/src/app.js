import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

export default app;
