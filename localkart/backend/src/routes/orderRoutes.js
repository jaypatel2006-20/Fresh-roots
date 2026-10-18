import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Vendor from '../models/Vendor.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();
const validId = (value) => mongoose.isValidObjectId(value);
const vendorFields = 'name locality cat status';
const workflow = ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];

async function getOwnVendor(user) {
  let vendor = user.vendorId
    ? await Vendor.findOne({ _id: user.vendorId, owner: user._id })
    : null;
  if (!vendor) vendor = await Vendor.findOne({ owner: user._id });
  return vendor;
}

function populatedOrder(query) {
  return query
    .populate('vendorId', vendorFields)
    .populate('customerId', 'name email');
}

router.post('/', authenticateToken, authorizeRoles('customer'), async (req, res) => {
  const { items, deliveryAddress } = req.body || {};
  const deliveryMethod = req.body?.deliveryMethod ?? req.body?.delivery ?? 'Standard';
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Cart must contain at least one item.' });
  }
  if (typeof deliveryAddress !== 'string' || !deliveryAddress.trim()) {
    return res.status(400).json({ message: 'A delivery address is required.' });
  }
  if (!['Standard', 'Same-day'].includes(deliveryMethod)) {
    return res.status(400).json({ message: 'Delivery method must be Standard or Same-day.' });
  }

  const quantities = new Map();
  for (const item of items) {
    const productId = item?.productId ?? item?.pid ?? item?.id;
    if (!validId(productId)) return res.status(400).json({ message: 'Each item must contain a valid product ID.' });
    if (!Number.isInteger(item.quantity ?? item.qty) || (item.quantity ?? item.qty) <= 0) {
      return res.status(400).json({ message: 'Each item quantity must be a positive integer.' });
    }
    const key = String(productId);
    quantities.set(key, (quantities.get(key) || 0) + (item.quantity ?? item.qty));
  }

  const reserved = [];
  const created = [];
  try {
    const productIds = [...quantities.keys()];
    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(400).json({ message: 'One or more products could not be found.' });
    }
    const vendorIds = [...new Set(products.map((p) => p.vendorId.toString()))];
    const verified = await Vendor.find({ _id: { $in: vendorIds }, status: 'Verified' }).select('_id');
    const verifiedIds = new Set(verified.map((v) => v._id.toString()));
    const byVendor = new Map();

    for (const product of products) {
      const quantity = quantities.get(product._id.toString());
      if (!product.active || !product.approved || !verifiedIds.has(product.vendorId.toString())) {
        return res.status(400).json({ message: `Product ${product.name} is not available for ordering.` });
      }
      if (product.stock < quantity) {
        return res.status(409).json({ message: `Insufficient stock for ${product.name}.` });
      }
      const vendorKey = product.vendorId.toString();
      if (!byVendor.has(vendorKey)) byVendor.set(vendorKey, []);
      byVendor.get(vendorKey).push({ product, quantity });
    }

    // Conditional updates reserve stock atomically, even when checkouts race.
    for (const [vendorId, vendorItems] of byVendor) {
      for (const { product, quantity } of vendorItems) {
        const result = await Product.updateOne({
          _id: product._id, vendorId, active: true, approved: true, stock: { $gte: quantity },
        }, { $inc: { stock: -quantity } });
        if (result.modifiedCount !== 1) {
          const error = new Error(`Insufficient stock or product unavailable for ${product.name}.`);
          error.status = 409;
          throw error;
        }
        reserved.push({ id: product._id, quantity });
      }
    }

    for (const [vendorId, vendorItems] of byVendor) {
      const subtotal = vendorItems.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
      const deliveryFee = deliveryMethod === 'Same-day' ? 25 : 0;
      const order = await Order.create({
        customerId: req.user._id,
        vendorId,
        items: vendorItems.map(({ product, quantity }) => ({
          pid: product._id, name: product.name, price: product.price, qty: quantity,
        })),
        total: subtotal + deliveryFee,
        address: deliveryAddress.trim(),
        delivery: deliveryMethod,
        pay: 'Cash on Delivery',
        status: 'Placed',
      });
      created.push(order);
    }

    const responseOrders = await Promise.all(created.map((order) => populatedOrder(Order.findById(order._id))));
    return res.status(201).json({
      message: 'Order placed successfully.',
      orders: responseOrders,
    });
  } catch (error) {
    // Standalone MongoDB deployments do not support transactions. Undo all
    // reservations and any already-created vendor orders if checkout fails.
    try {
      if (created.length) await Order.deleteMany({ _id: { $in: created.map((order) => order._id) } });
      for (const reservation of reserved.reverse()) {
        await Product.updateOne({ _id: reservation.id }, { $inc: { stock: reservation.quantity } });
      }
    } catch (_rollbackError) {
      return res.status(500).json({ message: 'Checkout failed and inventory rollback needs attention.' });
    }
    if (error.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: 'Unable to place order.' });
  }
});

router.get('/my-orders', authenticateToken, authorizeRoles('customer'), async (req, res) => {
  try {
    const orders = await populatedOrder(Order.find({ customerId: req.user._id }).sort({ date: -1, createdAt: -1 }));
    return res.json({ orders });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve your orders.' });
  }
});

router.get('/vendor-orders', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  try {
    const vendor = await getOwnVendor(req.user);
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found.' });
    const orders = await populatedOrder(Order.find({ vendorId: vendor._id }).sort({ date: -1, createdAt: -1 }));
    return res.json({ orders });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve vendor orders.' });
  }
});

router.patch('/:id/status', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
  const { status } = req.body || {};
  if (!workflow.includes(status)) return res.status(400).json({ message: 'Invalid order status.' });
  try {
    const vendor = await getOwnVendor(req.user);
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found.' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.vendorId.toString() !== vendor._id.toString()) {
      return res.status(403).json({ message: 'You can only update your own orders.' });
    }
    const current = workflow.indexOf(order.status);
    const next = workflow.indexOf(status);
    if (next !== current + 1) {
      return res.status(400).json({ message: `Order can only move from ${order.status} to ${workflow[current + 1] || 'no further status'}.` });
    }
    order.status = status;
    await order.save();
    return res.json({ order });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to update order status.' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
  try {
    const order = await populatedOrder(Order.findById(req.params.id));
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const ownsAsCustomer = req.user.role === 'customer' && order.customerId._id.toString() === req.user._id.toString();
    let ownsAsVendor = false;
    if (req.user.role === 'vendor') {
      const vendor = await getOwnVendor(req.user);
      ownsAsVendor = Boolean(vendor && order.vendorId._id.toString() === vendor._id.toString());
    }
    if (!ownsAsCustomer && !ownsAsVendor) return res.status(403).json({ message: 'You do not have access to this order.' });
    return res.json({ order });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve order.' });
  }
});

export default router;
