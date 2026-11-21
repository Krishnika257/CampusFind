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
  verificationMethod: { type: String, enum: ['private-detail', 'finder-confirmation', 'in-person-id'] },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  participantKey: { type: String, required: true },
  lastMessage: { type: String, trim: true, maxlength: 300, default: '' },
  lastMessageAt: { type: Date },
}, { timestamps: true });
conversationSchema.index({ item: 1, participantKey: 1 }, { unique: true });

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true });

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['match', 'message', 'claim-approved', 'claim-rejected'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 300 },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);
export const Claim = mongoose.models.Claim || mongoose.model('Claim', claimSchema);
export const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
