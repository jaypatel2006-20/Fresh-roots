import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  pid: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  qty: { type: Number, required: true, min: 1 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  items: { type: [orderItemSchema], required: true, validate: [(items) => items.length > 0, 'Order must contain at least one item.'] },
  total: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'], default: 'Placed' },
  address: { type: String, required: true, trim: true },
  delivery: { type: String, default: 'Standard', trim: true },
  pay: { type: String, default: 'Cash on Delivery', trim: true },
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
