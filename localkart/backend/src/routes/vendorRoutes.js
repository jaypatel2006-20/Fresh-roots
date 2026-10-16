import { Router } from 'express';
import mongoose from 'mongoose';
import Vendor from '../models/Vendor.js';

const router = Router();
const publicFields = 'name locality cat rating dist desc phone address radius hours status';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (req, res) => {
  try {
    const query = { status: 'Verified' };
    if (req.query.locality) query.locality = { $regex: `^${escapeRegex(String(req.query.locality).trim())}$`, $options: 'i' };
    const category = req.query.category || req.query.cat;
    if (category) query.cat = String(category);
    if (req.query.q) query.name = { $regex: escapeRegex(String(req.query.q).trim()), $options: 'i' };
    const vendors = await Vendor.find(query).select(publicFields);
    return res.json({ vendors });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve vendors.' });
  }
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Vendor not found.' });
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, status: 'Verified' }).select(publicFields);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found.' });
    return res.json({ vendor });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve vendor.' });
  }
});

export default router;
