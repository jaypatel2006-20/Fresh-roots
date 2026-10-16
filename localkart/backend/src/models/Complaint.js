import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema({
  uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  issue: { type: String, required: true, trim: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'Resolved'], default: 'Pending' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Complaint', complaintSchema);
