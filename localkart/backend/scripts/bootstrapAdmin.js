import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

try {
  const name = typeof ADMIN_NAME === 'string' ? ADMIN_NAME.trim() : '';
  const email = typeof ADMIN_EMAIL === 'string' ? ADMIN_EMAIL.trim().toLowerCase() : '';
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (!name || !email || typeof ADMIN_PASSWORD !== 'string') throw new Error('ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required.');
  if (!emailPattern.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address.');
  if (ADMIN_PASSWORD.length < 8) throw new Error('ADMIN_PASSWORD must contain at least 8 characters.');

  await mongoose.connect(process.env.MONGODB_URI);
  if (await User.exists({ role: 'admin' })) throw new Error('An administrator already exists. Bootstrap is a one-time operation.');
  if (await User.exists({ email })) throw new Error('That email already belongs to another account. No changes were made.');

  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({ name, email, password, role: 'admin', status: 'Active' });
  console.log(`Administrator account created for ${email}.`);
} catch (error) {
  console.error(`Admin bootstrap failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
