import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const port = process.env.PORT || 5000;

try {
  await connectDB();
  app.listen(port, () => {
    console.log(`LocalKart backend is running on port ${port}.`);
  });
} catch {
  process.exitCode = 1;
}
