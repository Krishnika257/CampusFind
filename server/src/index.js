import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const port = Number(process.env.PORT) || 4000;
const jwtSecret = process.env.JWT_SECRET;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

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

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);

function requireAuth(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ message: 'Please sign in to continue.' });
  try {
    request.userId = jwt.verify(token, jwtSecret).sub;
    next();
  } catch {
    return response.status(401).json({ message: 'Your session expired. Please sign in again.' });
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'campusfind-api', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const { name, email, password } = request.body;
    if (!name?.trim() || !email?.trim() || !password) return response.status(400).json({ message: 'Name, email, and password are required.' });
    if (password.length < 8) return response.status(400).json({ message: 'Password must be at least 8 characters.' });
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return response.status(409).json({ message: 'An account with that email already exists.' });
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12) });
    const token = jwt.sign({}, jwtSecret, { subject: user.id, expiresIn: '7d' });
    return response.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) { return next(error); }
});

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const user = await User.findOne({ email: request.body.email?.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(request.body.password || '', user.passwordHash))) return response.status(401).json({ message: 'Email or password is incorrect.' });
    const token = jwt.sign({}, jwtSecret, { subject: user.id, expiresIn: '7d' });
    return response.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) { return next(error); }
});

app.get('/api/items', async (request, response, next) => {
  try {
    const filter = { status: 'open' };
    if (['lost', 'found'].includes(request.query.type)) filter.type = request.query.type;
    const items = await Item.find(filter).sort({ createdAt: -1 }).limit(100).populate('owner', 'name');
    return response.json({ items });
  } catch (error) { return next(error); }
});

app.post('/api/items', requireAuth, async (request, response, next) => {
  try {
    const { title, description, category, location, type } = request.body;
    const item = await Item.create({ title, description, category, location, type, owner: request.userId });
    return response.status(201).json({ item });
  } catch (error) { return next(error); }
});

app.use((error, _request, response, _next) => {
  if (error?.name === 'ValidationError') return response.status(400).json({ message: 'Please check the item details and try again.' });
  if (error?.code === 11000) return response.status(409).json({ message: 'That email is already registered.' });
  console.error(error);
  return response.status(500).json({ message: 'Something went wrong. Please try again.' });
});

async function start() {
  if (!jwtSecret) throw new Error('JWT_SECRET is missing. Copy server/.env.example to server/.env and set a secret.');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusfind');
  app.listen(port, () => console.log(`CampusFind API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error(`Could not start CampusFind API: ${error.message}`);
  process.exit(1);
});
