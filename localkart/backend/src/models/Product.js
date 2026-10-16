import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  min: { type: Number, min: 0, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  active: { type: Boolean, default: true },
  approved: { type: Boolean, default: false },
  desc: { type: String, trim: true, default: '' },
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
