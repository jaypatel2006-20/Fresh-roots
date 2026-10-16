import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'vendor', 'admin'], default: 'customer' },
  phone: { type: String, trim: true },
  locality: { type: String, trim: true },
  status: { type: String, default: 'Active' },
  joined: { type: Date, default: Date.now },
  addresses: [{ type: String, trim: true }],
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
