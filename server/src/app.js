import cors from 'cors';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Claim as defaultClaim, Conversation as defaultConversation, Item as defaultItem, Message as defaultMessage, Notification as defaultNotification, User as defaultUser } from './models.js';
import { rankMatches } from './matching.js';

export function createApp({ User = defaultUser, Item = defaultItem, Claim = defaultClaim, Conversation = defaultConversation, Message = defaultMessage, Notification = defaultNotification, jwtSecret = process.env.JWT_SECRET } = {}) {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));

  function requireAuth(request, response, next) {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return response.status(401).json({ message: 'Please sign in to continue.' });
    try {
      const payload = jwt.verify(token, jwtSecret);
      request.userId = payload.sub;
      request.userRole = payload.role || 'student';
      next();
    } catch {
      return response.status(401).json({ message: 'Your session expired. Please sign in again.' });
    }
  }

  function requireAdmin(request, response, next) {
    if (request.userRole !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' });
    next();
  }

  async function safelyCreateNotification(fields) {
    try { await Notification.create(fields); }
    catch (error) { console.error(`Could not create a ${fields.type} notification: ${error.message}`); }
  }

  async function notifyPotentialMatches(source) {
    const oppositeType = source.type === 'lost' ? 'found' : 'lost';
    const candidates = await Item.find({ status: 'open', type: oppositeType, owner: { $ne: source.owner } })
      .sort({ createdAt: -1 }).limit(300).populate('owner', 'name');
    const matches = rankMatches(source, candidates);
    await Promise.all(matches.map(({ item: candidate }) => {
      const recipient = source.type === 'found' ? candidate.owner : source.owner;
      const relatedItem = source.type === 'found' ? source : candidate;
      const itemName = source.type === 'found' ? source.title : candidate.title;
      return safelyCreateNotification({
        user: recipient?._id || recipient?.id || recipient,
        type: 'match',
        title: 'Possible item match',
        message: `A ${source.type === 'found' ? 'found' : 'lost'} listing may match your item: “${itemName}”.`,
        item: relatedItem._id || relatedItem.id,
      });
    }));
  }

  async function handleClaimReview(request, response, next) {
    try {
      const { status, adminNotes = '', verificationMethod } = request.body || {};
      if (!['approved', 'rejected'].includes(status)) return response.status(400).json({ message: 'Decision must be approved or rejected.' });
      if (typeof adminNotes !== 'string' || adminNotes.trim().length > 500) return response.status(400).json({ message: 'Review notes must be 500 characters or fewer.' });
      const validVerificationMethods = ['private-detail', 'finder-confirmation', 'in-person-id'];
      if (status === 'approved' && !validVerificationMethods.includes(verificationMethod)) return response.status(400).json({ message: 'Choose how ownership was verified before approving this claim.' });

      const claim = await Claim.findById(request.params.id);
      if (!claim) return response.status(404).json({ message: 'Claim not found.' });
      const item = await Item.findById(claim.item.toString());
      if (!item) return response.status(404).json({ message: 'Listing not found.' });
      const isAdmin = request.userRole === 'admin';
      const isListingOwner = item.owner?.toString() === request.userId;
      if (!isAdmin && !isListingOwner) return response.status(403).json({ message: 'Only the person who posted this listing or an admin can review its claims.' });
      if (claim.status !== 'pending') return response.status(409).json({ message: 'This claim has already been reviewed.' });

      if (status === 'approved') {
        if (item.type !== 'found' || item.status !== 'open') return response.status(409).json({ message: 'The listing is no longer available.' });
        item.status = 'claimed';
        await item.save();
      }
      claim.status = status;
      claim.adminNotes = adminNotes.trim();
      claim.verificationMethod = status === 'approved' ? verificationMethod : undefined;
      claim.reviewedBy = request.userId;
      claim.reviewedAt = new Date();
      await claim.save();
      const relatedItem = await Item.findById(claim.item.toString());
      await safelyCreateNotification({
        user: claim.claimant,
        type: status === 'approved' ? 'claim-approved' : 'claim-rejected',
        title: status === 'approved' ? 'Claim approved' : 'Claim update',
        message: `Your claim for “${relatedItem?.title || 'a campus item'}” was ${status}.`,
        item: relatedItem?._id || relatedItem?.id,
      });
      return response.json({ claim });
    } catch (error) { return next(error); }
  }

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'campusfind-api', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
  });

  app.post('/api/auth/register', async (request, response, next) => {
    try {
      const { name, email, password } = request.body || {};
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!normalizedName || !normalizedEmail || typeof password !== 'string' || !password) return response.status(400).json({ message: 'Name, email, and password are required.' });
      if (normalizedName.length > 80) return response.status(400).json({ message: 'Name must be 80 characters or fewer.' });
      if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return response.status(400).json({ message: 'Enter a valid email address.' });
      if (password.length < 8) return response.status(400).json({ message: 'Password must be at least 8 characters.' });
      if (Buffer.byteLength(password, 'utf8') > 72) return response.status(400).json({ message: 'Password must be no longer than 72 bytes.' });
      if (await User.exists({ email: normalizedEmail })) return response.status(409).json({ message: 'An account with that email already exists.' });
      const role = 'student';
      const user = await User.create({ name: normalizedName, email: normalizedEmail, role, passwordHash: await bcrypt.hash(password, 12) });
      const token = jwt.sign({ role: user.role }, jwtSecret, { subject: user.id, expiresIn: '7d' });
      return response.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) { return next(error); }
  });

  app.post('/api/auth/login', async (request, response, next) => {
    try {
      const { email, password } = request.body || {};
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const validPassword = typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72;
      const user = await User.findOne({ email: normalizedEmail });
      if (!user || !validPassword || !(await bcrypt.compare(password, user.passwordHash))) return response.status(401).json({ message: 'Email or password is incorrect.' });
      const role = user.role || 'student';
      const token = jwt.sign({ role }, jwtSecret, { subject: user.id, expiresIn: '7d' });
      return response.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
    } catch (error) { return next(error); }
  });

  app.get('/api/items', async (request, response, next) => {
    try {
      const requestedPage = Number.parseInt(request.query.page, 10);
      const requestedLimit = Number.parseInt(request.query.limit, 10);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 12;
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
      const [items, total] = await Promise.all([
        Item.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('owner', 'name'),
        Item.countDocuments(filter),
      ]);
      return response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) { return next(error); }
  });

  app.get('/api/my/items', requireAuth, async (request, response, next) => {
    try {
      const requestedPage = Number.parseInt(request.query.page, 10);
      const requestedLimit = Number.parseInt(request.query.limit, 10);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 12;
      const filter = { owner: request.userId };
      const [items, total] = await Promise.all([
        Item.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('owner', 'name'),
        Item.countDocuments(filter),
      ]);
      return response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) { return next(error); }
  });

  app.get('/api/items/:id', async (request, response, next) => {
    try {
      const item = await Item.findById(request.params.id).populate('owner', 'name');
      if (!item) return response.status(404).json({ message: 'Listing not found.' });
      return response.json({ item });
    } catch (error) { return next(error); }
  });

  app.get('/api/items/:id/matches', async (request, response, next) => {
    try {
      const source = await Item.findById(request.params.id);
      if (!source) return response.status(404).json({ message: 'Listing not found.' });
      const oppositeType = source.type === 'lost' ? 'found' : 'lost';
      const candidates = await Item.find({ status: 'open', type: oppositeType, _id: { $ne: source._id || source.id } })
        .sort({ createdAt: -1 })
        .limit(300)
        .populate('owner', 'name');
      return response.json({ matches: rankMatches(source, candidates) });
    } catch (error) { return next(error); }
  });

  app.post('/api/items', requireAuth, async (request, response, next) => {
    try {
      const { title, description, category, location, type } = request.body;
      const item = await Item.create({ title, description, category, location, type, owner: request.userId });
      try { await notifyPotentialMatches(item); }
      catch (error) { console.error(`Could not check for matching listings: ${error.message}`); }
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

  app.post('/api/items/:id/claims', requireAuth, async (request, response, next) => {
    try {
      const item = await Item.findById(request.params.id);
      if (!item) return response.status(404).json({ message: 'Listing not found.' });
      if (item.owner?.toString() === request.userId) return response.status(400).json({ message: 'You cannot claim your own listing.' });
      if (item.type !== 'found' || item.status !== 'open') return response.status(400).json({ message: 'Only open found listings can receive claims.' });
      const proof = request.body.proof?.trim();
      if (!proof || proof.length < 20 || proof.length > 1000) return response.status(400).json({ message: 'Please provide 20 to 1000 characters describing proof of ownership.' });
      if (await Claim.findOne({ item: item.id, claimant: request.userId, status: 'pending' })) return response.status(409).json({ message: 'You already have a pending claim for this listing.' });
      const claim = await Claim.create({ item: item.id, claimant: request.userId, proof });
      return response.status(201).json({ claim });
    } catch (error) { return next(error); }
  });

  app.get('/api/items/:id/claims', requireAuth, async (request, response, next) => {
    try {
      const item = await Item.findById(request.params.id);
      if (!item) return response.status(404).json({ message: 'Listing not found.' });
      if (item.owner?.toString() !== request.userId && request.userRole !== 'admin') return response.status(403).json({ message: 'Only the person who posted this listing or an admin can view its claims.' });
      const claims = await Claim.find({ item: item.id || item._id, status: 'pending' }).sort({ createdAt: 1 }).limit(100).populate('claimant', 'name');
      return response.json({ claims });
    } catch (error) { return next(error); }
  });

  app.patch('/api/claims/:id/review', requireAuth, handleClaimReview);

  app.get('/api/my/claims', requireAuth, async (request, response, next) => {
    try {
      const requestedPage = Number.parseInt(request.query.page, 10);
      const requestedLimit = Number.parseInt(request.query.limit, 10);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 12;
      const filter = { claimant: request.userId };
      const [claims, total] = await Promise.all([
        Claim.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate({ path: 'item', select: 'title description type status category location createdAt' }),
        Claim.countDocuments(filter),
      ]);
      return response.json({ claims, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) { return next(error); }
  });

  app.post('/api/items/:id/conversations', requireAuth, async (request, response, next) => {
    try {
      const item = await Item.findById(request.params.id);
      if (!item) return response.status(404).json({ message: 'Listing not found.' });
      const ownerId = item.owner?.toString();
      if (!ownerId) return response.status(409).json({ message: 'This listing has no available contact.' });
      if (ownerId === request.userId) return response.status(400).json({ message: 'You cannot message yourself about your listing.' });
      if (item.status !== 'open') return response.status(409).json({ message: 'This listing is no longer open for messages.' });
      const participantKey = [ownerId, request.userId].sort().join(':');
      let conversation = await Conversation.findOne({ item: item._id || item.id, participantKey });
      if (!conversation) conversation = await Conversation.create({ item: item._id || item.id, participants: [ownerId, request.userId], participantKey });
      return response.status(200).json({ conversation });
    } catch (error) { return next(error); }
  });

  app.get('/api/conversations', requireAuth, async (request, response, next) => {
    try {
      const conversations = await Conversation.find({ participants: request.userId }).sort({ updatedAt: -1 }).limit(50)
        .populate([{ path: 'item', select: 'title type status' }, { path: 'participants', select: 'name' }]);
      return response.json({ conversations });
    } catch (error) { return next(error); }
  });

  app.get('/api/conversations/:id/messages', requireAuth, async (request, response, next) => {
    try {
      const conversation = await Conversation.findById(request.params.id);
      if (!conversation) return response.status(404).json({ message: 'Conversation not found.' });
      if (!conversation.participants.some((participant) => participant.toString() === request.userId)) return response.status(403).json({ message: 'You cannot view this conversation.' });
      const messages = await Message.find({ conversation: conversation.id || conversation._id }).sort({ createdAt: -1 }).limit(200).populate('sender', 'name');
      return response.json({ messages: messages.reverse() });
    } catch (error) { return next(error); }
  });

  app.post('/api/conversations/:id/messages', requireAuth, async (request, response, next) => {
    try {
      const conversation = await Conversation.findById(request.params.id);
      if (!conversation) return response.status(404).json({ message: 'Conversation not found.' });
      if (!conversation.participants.some((participant) => participant.toString() === request.userId)) return response.status(403).json({ message: 'You cannot message this conversation.' });
      const text = typeof request.body.text === 'string' ? request.body.text.trim() : '';
      if (!text || text.length > 1000) return response.status(400).json({ message: 'Messages must contain between 1 and 1000 characters.' });
      const createdAt = new Date();
      const message = await Message.create({ conversation: conversation.id || conversation._id, sender: request.userId, text });
      conversation.lastMessage = text.slice(0, 300);
      conversation.lastMessageAt = createdAt;
      await conversation.save();
      const recipient = conversation.participants.find((participant) => participant.toString() !== request.userId);
      if (recipient) await safelyCreateNotification({
        user: recipient,
        type: 'message',
        title: 'New private message',
        message: 'There is a new message in your conversation about a campus listing.',
        item: conversation.item,
        conversation: conversation.id || conversation._id,
      });
      return response.status(201).json({ message });
    } catch (error) { return next(error); }
  });

  app.get('/api/notifications', requireAuth, async (request, response, next) => {
    try {
      const requestedPage = Number.parseInt(request.query.page, 10);
      const requestedLimit = Number.parseInt(request.query.limit, 10);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 50;
      const filter = { user: request.userId };
      if (request.query.unread === 'true') filter.isRead = false;
      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate([
        { path: 'item', select: 'title type status' },
        { path: 'conversation', select: 'item participants', populate: [{ path: 'item', select: 'title' }, { path: 'participants', select: 'name' }] },
        ]),
        Notification.countDocuments(filter),
        Notification.countDocuments({ user: request.userId, isRead: false }),
      ]);
      return response.json({ notifications, unreadCount, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) { return next(error); }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (request, response, next) => {
    try {
      const notification = await Notification.findById(request.params.id);
      if (!notification) return response.status(404).json({ message: 'Notification not found.' });
      if (notification.user?.toString() !== request.userId) return response.status(403).json({ message: 'You cannot update this notification.' });
      notification.isRead = true;
      await notification.save();
      return response.json({ notification });
    } catch (error) { return next(error); }
  });

  app.patch('/api/notifications/read-all', requireAuth, async (request, response, next) => {
    try {
      const result = await Notification.updateMany({ user: request.userId, isRead: false }, { $set: { isRead: true } });
      return response.json({ modifiedCount: result.modifiedCount || 0 });
    } catch (error) { return next(error); }
  });

  app.get('/api/admin/claims', requireAuth, requireAdmin, async (_request, response, next) => {
    try {
      const claims = await Claim.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(100).populate([{ path: 'item', select: 'title location' }, { path: 'claimant', select: 'name email' }]);
      return response.json({ claims });
    } catch (error) { return next(error); }
  });

  app.get('/api/admin/stats', requireAuth, requireAdmin, async (_request, response, next) => {
    try {
      const [totalItems, openLost, openFound, returnedItems, pendingClaims, totalUsers, approvedClaims, rejectedClaims] = await Promise.all([
        Item.countDocuments({}),
        Item.countDocuments({ type: 'lost', status: 'open' }),
        Item.countDocuments({ type: 'found', status: 'open' }),
        Item.countDocuments({ status: 'claimed' }),
        Claim.countDocuments({ status: 'pending' }),
        User.countDocuments({}),
        Claim.countDocuments({ status: 'approved' }),
        Claim.countDocuments({ status: 'rejected' }),
      ]);
      const reviewedClaims = approvedClaims + rejectedClaims;
      const claimApprovalRate = reviewedClaims ? Math.round((approvedClaims / reviewedClaims) * 100) : 0;
      return response.json({ stats: { totalItems, openLost, openFound, returnedItems, pendingClaims, totalUsers, approvedClaims, rejectedClaims, claimApprovalRate } });
    } catch (error) { return next(error); }
  });

  app.patch('/api/admin/claims/:id', requireAuth, requireAdmin, handleClaimReview);

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
