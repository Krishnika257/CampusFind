import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  category: { type: String, required: true, enum: ['Electronics', 'Books', 'Clothing', 'Accessories', 'Other'] },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, required: true, enum: ['lost', 'found'] },
  status: { type: String, enum: ['open', 'claimed'], default: 'open' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const claimSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proof: { type: String, required: true, trim: true, minlength: 20, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNotes: { type: String, trim: true, maxlength: 500, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);
export const Claim = mongoose.models.Claim || mongoose.model('Claim', claimSchema);
