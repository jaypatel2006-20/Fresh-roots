import { Router } from 'express';
import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import Order from '../models/Order.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', authenticateToken, authorizeRoles('customer'), async (req, res) => {
  const { orderId, issue } = req.body || {};
  if (!mongoose.isValidObjectId(orderId)) return res.status(400).json({ message: 'A valid order ID is required.' });
  if (typeof issue !== 'string' || !issue.trim()) return res.status(400).json({ message: 'Describe the issue before submitting.' });
  if (issue.trim().length > 2000) return res.status(400).json({ message: 'Issue description must be 2000 characters or fewer.' });

  try {
    const order = await Order.findOne({ _id: orderId, customerId: req.user._id }).select('vendorId');
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const complaint = await Complaint.create({
      uid: req.user._id,
      vendorId: order.vendorId,
      issue: issue.trim(),
      priority: 'Medium',
      status: 'Pending',
    });
    return res.status(201).json({ message: 'Issue submitted successfully.', complaint });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to submit your issue.' });
  }
});

export default router;
