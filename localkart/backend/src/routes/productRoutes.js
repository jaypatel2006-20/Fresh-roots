import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Vendor from '../models/Vendor.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();
const vendorPublicFields = 'name locality cat rating dist desc phone address radius hours status';
const isId = (value) => mongoose.isValidObjectId(value);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function getOwnVendor(user) {
  // User.vendorId is set during registration. The owner lookup supports existing
  // profiles whose reverse relationship exists but whose user reference is absent.
  let vendor = user.vendorId ? await Vendor.findOne({ _id: user.vendorId, owner: user._id }) : null;
  if (!vendor) vendor = await Vendor.findOne({ owner: user._id });
  return vendor;
}

function publicProductFilter() {
  return { active: true, approved: true };
}

router.get('/', async (req, res) => {
  try {
    const query = { ...publicProductFilter() };
    const verifiedVendors = await Vendor.find({ status: 'Verified' }).select('_id locality');
    query.vendorId = { $in: verifiedVendors.map((vendor) => vendor._id) };
    if (req.query.q) query.name = { $regex: escapeRegex(String(req.query.q).trim()), $options: 'i' };
    const category = req.query.category || req.query.cat;
    if (category) query.category = String(category);
    if (req.query.vendorId) {
      if (!isId(req.query.vendorId)) return res.status(400).json({ message: 'Invalid vendor ID.' });
      query.vendorId = { $in: verifiedVendors.some((v) => v._id.toString() === req.query.vendorId) ? [req.query.vendorId] : [] };
    }
    if (req.query.locality) {
      const localityIds = verifiedVendors.filter((v) => v.locality.toLowerCase() === String(req.query.locality).toLowerCase()).map((v) => v._id);
      query.vendorId = { $in: localityIds };
      if (req.query.vendorId) query.vendorId.$in = query.vendorId.$in.filter((id) => id.toString() === req.query.vendorId);
    }
    if (req.query.maxPrice !== undefined) {
      const maxPrice = Number(req.query.maxPrice);
      if (!Number.isFinite(maxPrice) || maxPrice < 0) return res.status(400).json({ message: 'maxPrice must be a non-negative number.' });
      query.price = { ...query.price, $lte: maxPrice };
    }
    if (req.query.minRating !== undefined) {
      const minRating = Number(req.query.minRating);
      if (!Number.isFinite(minRating) || minRating < 0 || minRating > 5) return res.status(400).json({ message: 'minRating must be between 0 and 5.' });
      query.rating = { $gte: minRating };
    }
    if (String(req.query.inStock).toLowerCase() === 'true') query.stock = { $gt: 0 };

    const sortOptions = { priceAsc: { price: 1 }, priceDesc: { price: -1 }, ratingDesc: { rating: -1 } };
    const sort = sortOptions[req.query.sort] || {};
    const products = await Product.find(query).sort(sort).populate('vendorId', vendorPublicFields);
    return res.json({ products });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve products.' });
  }
});

router.get('/mine', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  try {
    const vendor = await getOwnVendor(req.user);
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found.' });
    const products = await Product.find({ vendorId: vendor._id });
    return res.json({ products });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve your products.' });
  }
});

router.post('/', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  try {
    const vendor = await getOwnVendor(req.user);
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found.' });
    const body = req.body || {};
    const desc = body.description ?? body.desc;
    if ([body.name, body.category, body.unit].some((value) => typeof value !== 'string' || !value.trim()) || body.price === undefined || body.stock === undefined) {
      return res.status(400).json({ message: 'Name, category, price, unit, and stock are required.' });
    }
    const price = Number(body.price);
    const stock = Number(body.stock);
    const min = body.min === undefined ? 0 : Number(body.min);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(min) || min < 0) {
      return res.status(400).json({ message: 'Price must be positive and stock/min must be non-negative numbers.' });
    }
    if (desc !== undefined && typeof desc !== 'string') return res.status(400).json({ message: 'Description must be text.' });

    const product = await Product.create({
      name: body.name.trim(), category: body.category.trim(), price, unit: body.unit.trim(),
      stock, min, desc: desc?.trim() || '', vendorId: vendor._id,
      rating: 0, active: true, approved: false,
    });
    return res.status(201).json({ product });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to create product.' });
  }
});

router.get('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ message: 'Product not found.' });
  try {
    const product = await Product.findOne({ _id: req.params.id, ...publicProductFilter() }).populate({
      path: 'vendorId', select: vendorPublicFields, match: { status: 'Verified' },
    });
    if (!product || !product.vendorId) return res.status(404).json({ message: 'Product not found.' });
    return res.json({ product });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve product.' });
  }
});

router.put('/:id', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ message: 'Product not found.' });
  try {
    const vendor = await getOwnVendor(req.user);
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found.' });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    if (product.vendorId.toString() !== vendor._id.toString()) return res.status(403).json({ message: 'You can only update your own products.' });

    const body = req.body || {};
    const fields = ['name', 'category', 'price', 'unit', 'stock', 'min', 'active'];
    for (const field of fields) {
      if (body[field] === undefined) continue;
      if (['name', 'category', 'unit'].includes(field)) {
        if (typeof body[field] !== 'string' || !body[field].trim()) return res.status(400).json({ message: `${field} must be non-empty text.` });
        product[field] = body[field].trim();
      } else if (field === 'active') {
        if (typeof body[field] !== 'boolean') return res.status(400).json({ message: 'active must be a boolean.' });
        product.active = body.active;
      } else {
        const value = Number(body[field]);
        if (!Number.isFinite(value) || (field === 'price' ? value <= 0 : value < 0)) return res.status(400).json({ message: `${field} has an invalid value.` });
        product[field] = value;
      }
    }
    const desc = body.description ?? body.desc;
    if (desc !== undefined) {
      if (typeof desc !== 'string') return res.status(400).json({ message: 'Description must be text.' });
      product.desc = desc.trim();
    }
    await product.save();
    return res.json({ product });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to update product.' });
  }
});

router.delete('/:id', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ message: 'Product not found.' });
  try {
    const vendor = await getOwnVendor(req.user);
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found.' });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    if (product.vendorId.toString() !== vendor._id.toString()) return res.status(403).json({ message: 'You can only delete your own products.' });
    await product.deleteOne();
    return res.json({ message: 'Product deleted successfully.' });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to delete product.' });
  }
});

export default router;
