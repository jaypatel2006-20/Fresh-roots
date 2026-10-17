import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Complaint from '../models/Complaint.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();
const objectId = (value) => mongoose.isValidObjectId(value);
const userStatuses = ['Active', 'Suspended'];
const vendorStatuses = ['Pending', 'Verified', 'Rejected'];
const orderStatuses = ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
const complaintStatuses = ['Pending', 'Resolved'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const adminOnly = [authenticateToken, authorizeRoles('admin')];

router.get('/dashboard', ...adminOnly, async (_req, res) => {
  try {
    const activeStatuses = ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery'];
    const [totalUsers, totalVendors, pendingVendors, verifiedVendors, totalProducts, pendingProducts, totalOrders, activeOrders, unresolvedComplaints, revenue, userGrowth, ordersByStatus, vendorsByStatus] = await Promise.all([
      User.countDocuments(),
      Vendor.countDocuments(),
      Vendor.countDocuments({ status: 'Pending' }),
      Vendor.countDocuments({ status: 'Verified' }),
      Product.countDocuments(),
      Product.countDocuments({ approved: false }),
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: activeStatuses } }),
      Complaint.countDocuments({ status: 'Pending' }),
      Order.aggregate([{ $match: { status: 'Delivered' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      User.aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m', date: '$joined' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Vendor.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    return res.json({
      stats: {
        totalUsers, totalVendors, pendingVendors, verifiedVendors, totalProducts, pendingProducts,
        totalOrders, activeOrders, unresolvedComplaints, totalRevenue: revenue[0]?.total || 0,
      },
      userGrowth: userGrowth.map(({ _id, count }) => ({ month: _id, count })),
      ordersByStatus: ordersByStatus.map(({ _id, count }) => ({ status: _id, count })),
      vendorsByStatus: vendorsByStatus.map(({ _id, count }) => ({ status: _id, count })),
    });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve admin dashboard statistics.' });
  }
});

router.get('/users', ...adminOnly, async (req, res) => {
  const { q, role, status } = req.query;
  if (role && !['customer', 'vendor', 'admin'].includes(String(role))) return res.status(400).json({ message: 'Invalid user role filter.' });
  if (status && !userStatuses.includes(String(status))) return res.status(400).json({ message: 'Invalid user status filter.' });
  try {
    const query = {};
    if (role) query.role = String(role);
    if (status) query.status = String(status);
    if (q) {
      const search = new RegExp(escapeRegex(String(q).trim()), 'i');
      query.$or = [{ name: search }, { email: search }];
    }
    const users = await User.find(query).select('name email phone locality role status joined').sort({ joined: -1, _id: 1 }).lean();
    const ids = users.map((user) => user._id);
    const orderCounts = ids.length ? await Order.aggregate([{ $match: { customerId: { $in: ids } } }, { $group: { _id: '$customerId', count: { $sum: 1 } } }]) : [];
    const counts = new Map(orderCounts.map((item) => [item._id.toString(), item.count]));
    return res.json({ users: users.map((user) => ({
      id: user._id.toString(), name: user.name, email: user.email, phone: user.phone || '',
      locality: user.locality || '', role: user.role, status: user.status, joined: user.joined,
      orderCount: counts.get(user._id.toString()) || 0,
    })) });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve users.' });
  }
});

router.patch('/users/:id/status', ...adminOnly, async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' });
  const { status } = req.body || {};
  if (!userStatuses.includes(status)) return res.status(400).json({ message: 'User status must be Active or Suspended.' });
  if (new mongoose.Types.ObjectId(req.params.id).equals(req.user._id)) return res.status(400).json({ message: 'You cannot change your own account status.' });
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true, runValidators: true })
      .select('name email phone locality role status joined');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user: {
      id: user._id.toString(), name: user.name, email: user.email, phone: user.phone || '',
      locality: user.locality || '', role: user.role, status: user.status, joined: user.joined,
    } });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to update user status.' });
  }
});

router.get('/vendors', ...adminOnly, async (req, res) => {
  const { status } = req.query;
  if (status && !vendorStatuses.includes(String(status))) return res.status(400).json({ message: 'Invalid vendor status filter.' });
  try {
    const query = status ? { status: String(status) } : {};
    const vendors = await Vendor.find(query).select('name locality cat rating dist status desc phone address radius hours submitted owner').populate('owner', 'name email').sort({ submitted: -1, _id: 1 }).lean();
    return res.json({ vendors: vendors.map((vendor) => ({ ...vendor, id: vendor._id.toString(), owner: vendor.owner ? { id: vendor.owner._id.toString(), name: vendor.owner.name, email: vendor.owner.email } : null })) });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve vendors.' });
  }
});

router.patch('/vendors/:id/status', ...adminOnly, async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: 'Invalid vendor ID.' });
  const { status } = req.body || {};
  if (!['Verified', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Vendor status must be Verified or Rejected.' });
  try {
    const vendor = await Vendor.findOneAndUpdate({ _id: req.params.id, status: 'Pending' }, { $set: { status } }, { new: true, runValidators: true })
      .select('name locality cat rating dist status desc phone address radius hours submitted owner').populate('owner', 'name email');
    if (!vendor) {
      const exists = await Vendor.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({ message: exists ? 'Only pending vendors can be reviewed.' : 'Vendor not found.' });
    }
    return res.json({ vendor });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to update vendor status.' });
  }
});

router.get('/products', ...adminOnly, async (req, res) => {
  const { approved, active, vendorId } = req.query;
  if (approved !== undefined && !['true', 'false'].includes(String(approved))) return res.status(400).json({ message: 'approved must be true or false.' });
  if (active !== undefined && !['true', 'false'].includes(String(active))) return res.status(400).json({ message: 'active must be true or false.' });
  if (vendorId && !objectId(String(vendorId))) return res.status(400).json({ message: 'Invalid vendor ID.' });
  try {
    const query = {};
    if (approved !== undefined) query.approved = String(approved) === 'true';
    if (active !== undefined) query.active = String(active) === 'true';
    if (vendorId) query.vendorId = String(vendorId);
    const products = await Product.find(query).populate('vendorId', 'name locality cat status').sort({ createdAt: -1, _id: 1 });
    return res.json({ products });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve products.' });
  }
});

router.patch('/products/:id/approval', ...adminOnly, async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: 'Invalid product ID.' });
  if (typeof req.body?.approved !== 'boolean') return res.status(400).json({ message: 'approved must be true or false.' });
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: { approved: req.body.approved } }, { new: true, runValidators: true })
      .populate('vendorId', 'name locality cat status');
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.json({ product });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to update product approval.' });
  }
});

router.patch('/products/:id/availability', ...adminOnly, async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: 'Invalid product ID.' });
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ message: 'active must be true or false.' });
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: { active: req.body.active } }, { new: true, runValidators: true })
      .populate('vendorId', 'name locality cat status');
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.json({ product });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to update product availability.' });
  }
});

router.delete('/products/:id', ...adminOnly, async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: 'Invalid product ID.' });
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.json({ message: 'Product removed successfully.' });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to remove product.' });
  }
});

router.get('/orders', ...adminOnly, async (req, res) => {
  const { status, vendorId, customerId, date } = req.query;
  if (status && !orderStatuses.includes(String(status))) return res.status(400).json({ message: 'Invalid order status filter.' });
  if (vendorId && !objectId(String(vendorId))) return res.status(400).json({ message: 'Invalid vendor ID.' });
  if (customerId && !objectId(String(customerId))) return res.status(400).json({ message: 'Invalid customer ID.' });
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ message: 'Date must use YYYY-MM-DD format.' });
  try {
    const query = {};
    if (status) query.status = String(status);
    if (vendorId) query.vendorId = String(vendorId);
    if (customerId) query.customerId = String(customerId);
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Invalid date filter.' });
      const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
      query.date = { $gte: start, $lt: end };
    }
    const orders = await Order.find(query).populate('customerId', 'name email').populate('vendorId', 'name locality cat')
      .sort({ date: -1, createdAt: -1 }).lean();
    return res.json({ orders });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve orders.' });
  }
});

router.get('/complaints', ...adminOnly, async (req, res) => {
  const { status } = req.query;
  if (status && !complaintStatuses.includes(String(status))) return res.status(400).json({ message: 'Complaint status must be Pending or Resolved.' });
  try {
    const complaints = await Complaint.find(status ? { status: String(status) } : {})
      .populate('uid', 'name email').populate('vendorId', 'name locality cat').sort({ date: -1, createdAt: -1 }).lean();
    return res.json({ complaints });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve complaints.' });
  }
});

router.patch('/complaints/:id/status', ...adminOnly, async (req, res) => {
  if (!objectId(req.params.id)) return res.status(400).json({ message: 'Invalid complaint ID.' });
  const { status } = req.body || {};
  if (!complaintStatuses.includes(status)) return res.status(400).json({ message: 'Complaint status must be Pending or Resolved.' });
  try {
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true, runValidators: true })
      .populate('uid', 'name email').populate('vendorId', 'name locality cat');
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    return res.json({ complaint });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to update complaint status.' });
  }
});

export default router;
