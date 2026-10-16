import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  locality: { type: String, required: true, trim: true },
  cat: { type: String, required: true, trim: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  dist: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  desc: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  radius: { type: Number, min: 0, default: 5 },
  hours: { type: String, trim: true },
  submitted: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Vendor', vendorSchema);
