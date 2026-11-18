import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
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

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);
