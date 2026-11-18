import cors from 'cors';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Item as defaultItem, User as defaultUser } from './models.js';

export function createApp({ User = defaultUser, Item = defaultItem, jwtSecret = process.env.JWT_SECRET } = {}) {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));

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
      const { q, category, location, from, to } = request.query;
      if (category) filter.category = category;
      if (location?.trim()) filter.location = { $regex: escapeRegex(location.trim().slice(0, 80)), $options: 'i' };
      if (q?.trim()) {
        const expression = { $regex: escapeRegex(q.trim().slice(0, 100)), $options: 'i' };
        filter.$or = [{ title: expression }, { description: expression }];
      }
      if (from || to) {
        const createdAt = {};
        if (from) {
          const start = parseDate(from);
          if (!start) return response.status(400).json({ message: 'Start date is invalid.' });
          createdAt.$gte = start;
        }
        if (to) {
          const end = parseDate(to);
          if (!end) return response.status(400).json({ message: 'End date is invalid.' });
          end.setUTCDate(end.getUTCDate() + 1);
          createdAt.$lt = end;
        }
        if (createdAt.$gte && createdAt.$lt && createdAt.$gte >= createdAt.$lt) return response.status(400).json({ message: 'Start date must be on or before end date.' });
        filter.createdAt = createdAt;
      }
      const items = await Item.find(filter).sort({ createdAt: -1 }).limit(100).populate('owner', 'name');
      return response.json({ items });
    } catch (error) { return next(error); }
  });

  app.get('/api/items/:id', async (request, response, next) => {
    try {
      const item = await Item.findById(request.params.id).populate('owner', 'name');
      if (!item) return response.status(404).json({ message: 'Listing not found.' });
      return response.json({ item });
    } catch (error) { return next(error); }
  });

  app.post('/api/items', requireAuth, async (request, response, next) => {
    try {
      const { title, description, category, location, type } = request.body;
      const item = await Item.create({ title, description, category, location, type, owner: request.userId });
      return response.status(201).json({ item });
    } catch (error) { return next(error); }
  });

  app.patch('/api/items/:id', requireAuth, async (request, response, next) => {
    try {
      const item = await Item.findById(request.params.id);
      if (!item) return response.status(404).json({ message: 'Listing not found.' });
      if (item.owner?.toString() !== request.userId) return response.status(403).json({ message: 'You can only edit your own listings.' });
      const updates = {};
      for (const field of ['title', 'description', 'category', 'location', 'type']) {
        if (Object.hasOwn(request.body, field)) updates[field] = request.body[field];
      }
      if (!Object.keys(updates).length) return response.status(400).json({ message: 'Provide at least one listing field to update.' });
      Object.assign(item, updates);
      await item.save();
      return response.json({ item });
    } catch (error) { return next(error); }
  });

  app.delete('/api/items/:id', requireAuth, async (request, response, next) => {
    try {
      const item = await Item.findById(request.params.id);
      if (!item) return response.status(404).json({ message: 'Listing not found.' });
      if (item.owner?.toString() !== request.userId) return response.status(403).json({ message: 'You can only delete your own listings.' });
      await item.deleteOne();
      return response.status(204).end();
    } catch (error) { return next(error); }
  });

  app.use((error, _request, response, _next) => {
    if (error?.name === 'CastError') return response.status(404).json({ message: 'Listing not found.' });
    if (error?.name === 'ValidationError') return response.status(400).json({ message: 'Please check the item details and try again.' });
    if (error?.code === 11000) return response.status(409).json({ message: 'That email is already registered.' });
    console.error(error);
    return response.status(500).json({ message: 'Something went wrong. Please try again.' });
  });
  return app;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
}
