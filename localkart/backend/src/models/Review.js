import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  pid: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, required: true, trim: true },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Review', reviewSchema);
