import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.vendorId ? { vendorId: user.vendorId } : {}),
  };
}

router.post('/register', async (req, res) => {
  try {
    const body = req.body || {};
    const { name, email, password, phone, locality } = body;
    const role = body.role || 'customer';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (typeof name !== 'string' || !name.trim() || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must contain at least 8 characters.' });
    }

    if (!['customer', 'vendor'].includes(role)) {
      return res.status(400).json({ message: 'Role must be customer or vendor.' });
    }

    if (role === 'vendor' && (typeof body.biz !== 'string' || !body.biz.trim() || typeof locality !== 'string' || !locality.trim())) {
      return res.status(400).json({ message: 'Vendor registration requires a business name and locality.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
      role,
      phone: typeof phone === 'string' ? phone.trim() : undefined,
      locality: typeof locality === 'string' ? locality.trim() : undefined,
    });

    if (role === 'vendor') {
      try {
        const vendor = await Vendor.create({
          name: body.biz.trim(),
          locality: locality.trim(),
          cat: typeof body.cat === 'string' ? (body.cat.trim() || 'Vegetables') : 'Vegetables',
          status: 'Pending',
          desc: typeof body.desc === 'string' ? body.desc.trim() : '',
          phone: typeof phone === 'string' ? phone.trim() : undefined,
          address: typeof body.addr === 'string' ? (body.addr.trim() || locality.trim()) : locality.trim(),
          owner: user._id,
        });

        user.vendorId = vendor._id;
        await user.save();
      } catch (error) {
        await User.findByIdAndDelete(user._id);
        throw error;
      }
    }

    return res.status(201).json({ message: 'Registration successful.', user: safeUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    console.error('Registration failed:', error.message);
    return res.status(500).json({ message: 'Unable to register user.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('Login unavailable: JWT_SECRET is not configured.');
      return res.status(500).json({ message: 'Authentication is not configured on the server.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { sub: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    return res.json({ token, user: safeUser(user) });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ message: 'Unable to log in.' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  return res.json({ user: safeUser(req.user) });
});

export default router;
