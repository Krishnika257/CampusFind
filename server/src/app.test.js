import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from './app.js';

const secret = 'test-only-campusfind-secret';

function createModels() {
  const users = [];
  const claims = [];
  const conversations = [];
  const messages = [];
  const items = [];
  const notifications = [];
  const itemModel = {
    lastFilter: null,
    find(filter) {
      this.lastFilter = filter;
      let offset = 0;
      let pageSize = 12;
      let matches = items.filter((item) => Object.entries(filter).every(([key, value]) => item[key] === value));
      return {
        sort() { matches = matches.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); return this; },
        skip(value) { offset = value; return this; },
        limit(value) { pageSize = value; return this; },
        async populate() { return matches.slice(offset, offset + pageSize); },
      };
    },
    async create(fields) { const item = { id: `item-${items.length + 1}`, ...fields }; items.push(item); return item; },
    async countDocuments(filter) { return items.filter((item) => Object.entries(filter).every(([key, value]) => item[key] === value)).length; },
  };
  const userModel = {
    async exists(filter) { return users.some((user) => user.email === filter.email); },
    async create(fields) {
      const user = { id: `user-${users.length + 1}`, ...fields };
      users.push(user);
      return user;
    },
    async findOne(filter) { return users.find((user) => user.email === filter.email) || null; },
    async countDocuments() { return users.length; },
  };
  const claimModel = {
    async findOne(filter) { return claims.find((claim) => claim.item === filter.item && claim.claimant === filter.claimant && claim.status === filter.status) || null; },
    async create(fields) {
      const claim = { id: `claim-${claims.length + 1}`, status: 'pending', ...fields, async save() { return this; } };
      claims.push(claim);
      return claim;
    },
    find() { return { sort() { return this; }, limit() { return this; }, async populate() { return claims; } }; },
    async findById(id) { return claims.find((claim) => claim.id === id) || null; },
    async countDocuments(filter) { return claims.filter((claim) => Object.entries(filter).every(([key, value]) => claim[key] === value)).length; },
  };
  const conversationModel = {
    async findOne(filter) { return conversations.find((entry) => entry.item === filter.item && entry.participantKey === filter.participantKey) || null; },
    async create(fields) {
      const conversation = { id: `conversation-${conversations.length + 1}`, lastMessage: '', ...fields, async save() { return this; } };
      conversations.push(conversation);
      return conversation;
    },
    find(filter) { return { sort() { return this; }, limit() { return this; }, async populate() { return conversations.filter((entry) => entry.participants.includes(filter.participants)); } }; },
    async findById(id) { return conversations.find((entry) => entry.id === id) || null; },
  };
  const messageModel = {
    find(filter) { return { sort() { return this; }, limit() { return this; }, async populate() { return messages.filter((entry) => entry.conversation === filter.conversation); } }; },
    async create(fields) {
      const message = { id: `message-${messages.length + 1}`, ...fields, createdAt: new Date() };
      messages.push(message);
      return message;
    },
  };
  const notificationModel = {
    async create(fields) {
      const notification = { id: `notification-${notifications.length + 1}`, isRead: false, createdAt: new Date(Date.now() + notifications.length), ...fields, async save() { return this; } };
      notifications.push(notification);
      return notification;
    },
    find(filter) {
      let results = [];
      let offset = 0;
      let pageSize = 50;
      return {
        sort() { results = notifications.filter((entry) => Object.entries(filter).every(([key, value]) => entry[key] === value)).sort((a, b) => b.createdAt - a.createdAt); return this; },
        skip(value) { offset = value; return this; },
        limit(value) { pageSize = value; return this; },
        async populate() { return results.slice(offset, offset + pageSize); },
      };
    },
    async findById(id) { return notifications.find((entry) => entry.id === id) || null; },
    async countDocuments(filter) { return notifications.filter((entry) => Object.entries(filter).every(([key, value]) => entry[key] === value)).length; },
    async updateMany(filter) {
      const unread = notifications.filter((entry) => entry.user === filter.user && entry.isRead === filter.isRead);
      unread.forEach((entry) => { entry.isRead = true; });
      return { modifiedCount: unread.length };
    },
  };
  return { users, claims, conversations, messages, items, notifications, User: userModel, Item: itemModel, Claim: claimModel, Conversation: conversationModel, Message: messageModel, Notification: notificationModel };
}

describe('CampusFind API', () => {
  let models;
  let app;

  beforeEach(() => {
    models = createModels();
    app = createApp({ ...models, jwtSecret: secret });
  });

  afterEach(() => vi.restoreAllMocks());

  it('registers users with a normalized email and a hashed password', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: '  Riley  ', email: ' RILEY@JIIT.AC.IN ', password: 'campus-pass-123' });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ name: 'Riley', email: 'riley@jiit.ac.in' });
    expect(response.body.token).toBeTruthy();
    expect(models.users[0].passwordHash).not.toBe('campus-pass-123');
    expect(await bcrypt.compare('campus-pass-123', models.users[0].passwordHash)).toBe(true);
  });

  it('rejects registration with a short password', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: 'Riley', email: 'riley@jiit.ac.in', password: 'short' });
    expect(response.status).toBe(400);
    expect(models.users).toHaveLength(0);
  });

  it.each([
    ['malformed email', { name: 'Riley', email: 'not-an-email', password: 'campus-pass-123' }],
    ['overlong name', { name: 'R'.repeat(81), email: 'riley@jiit.ac.in', password: 'campus-pass-123' }],
    ['password over bcrypt byte limit', { name: 'Riley', email: 'riley@jiit.ac.in', password: 'a'.repeat(73) }],
    ['non-string credentials', { name: 'Riley', email: 'riley@jiit.ac.in', password: { value: 'campus-pass-123' } }],
  ])('rejects registration with %s', async (_description, body) => {
    const response = await request(app).post('/api/auth/register').send(body);
    expect(response.status).toBe(400);
    expect(models.users).toHaveLength(0);
  });

  it('logs in with the normalized email and rejects an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('campus-pass-123', 4);
    models.users.push({ id: 'user-1', name: 'Riley', email: 'riley@jiit.ac.in', passwordHash });

    const success = await request(app).post('/api/auth/login').send({ email: ' RILEY@JIIT.AC.IN ', password: 'campus-pass-123' });
    const failure = await request(app).post('/api/auth/login').send({ email: 'riley@jiit.ac.in', password: 'wrong-pass' });
    const oversizedPassword = await request(app).post('/api/auth/login').send({ email: 'riley@jiit.ac.in', password: `${'campus-pass-123'}${'x'.repeat(60)}` });
    expect(success.status).toBe(200);
    expect(jwt.verify(success.body.token, secret).sub).toBe('user-1');
    expect(failure.status).toBe(401);
    expect(oversizedPassword.status).toBe(401);
  });

  it('requires a valid JWT before accepting an item post', async () => {
    const response = await request(app).post('/api/items').send({ title: 'Keys', description: 'Blue keychain', category: 'Other', location: 'Library', type: 'lost' });
    expect(response.status).toBe(401);
  });

  it('creates an item for the authenticated user', async () => {
    const token = jwt.sign({}, secret, { subject: 'user-7', expiresIn: '1h' });
    const response = await request(app).post('/api/items').set('Authorization', `Bearer ${token}`).send({ title: 'Keys', description: 'Blue keychain', category: 'Other', location: 'Library', type: 'lost' });
    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({ title: 'Keys', owner: 'user-7' });
  });

  it('combines search, category, location, type, and date filters safely', async () => {
    const response = await request(app).get('/api/items').query({ q: 'pen.*', category: 'Books', location: 'Block A', type: 'found', from: '2026-11-01', to: '2026-11-03' });
    const filter = models.Item.lastFilter;
    expect(response.status).toBe(200);
    expect(filter).toMatchObject({ status: 'open', category: 'Books', type: 'found' });
    expect(filter.location).toMatchObject({ $regex: 'Block A', $options: 'i' });
    expect(filter.$or[0].title.$regex).toBe('pen\\.\\*');
    expect(filter.createdAt.$gte.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(filter.createdAt.$lt.toISOString()).toBe('2026-11-04T00:00:00.000Z');
  });

  it('paginates open listing results and caps the requested page size', async () => {
    models.items.push(
      { id: 'item-1', status: 'open', title: 'Newest', createdAt: new Date('2026-11-03') },
      { id: 'item-2', status: 'open', title: 'Older', createdAt: new Date('2026-11-02') },
      { id: 'item-3', status: 'open', title: 'Oldest', createdAt: new Date('2026-11-01') },
      { id: 'item-4', status: 'claimed', title: 'Already claimed', createdAt: new Date('2026-11-04') },
    );
    const response = await request(app).get('/api/items').query({ page: 2, limit: 2 });
    expect(response.status).toBe(200);
    expect(response.body.items.map((item) => item.title)).toEqual(['Oldest']);
    expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 3, pages: 2 });
    const capped = await request(app).get('/api/items').query({ page: 1, limit: 500 });
    expect(capped.body.pagination.limit).toBe(50);
  });

  it('requires sign-in and returns a user’s listings across statuses', async () => {
    models.items.push(
      { id: 'mine-open', owner: 'user-7', status: 'open', title: 'Open keys', createdAt: new Date('2026-11-03') },
      { id: 'mine-claimed', owner: 'user-7', status: 'claimed', title: 'Returned wallet', createdAt: new Date('2026-11-02') },
      { id: 'someone-elses', owner: 'user-8', status: 'open', title: 'Other phone', createdAt: new Date('2026-11-04') },
    );
    const unauthorized = await request(app).get('/api/my/items');
    const token = jwt.sign({}, secret, { subject: 'user-7', expiresIn: '1h' });
    const response = await request(app).get('/api/my/items').set('Authorization', `Bearer ${token}`);
    expect(unauthorized.status).toBe(401);
    expect(response.status).toBe(200);
    expect(response.body.items.map((item) => item.title)).toEqual(['Open keys', 'Returned wallet']);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 12, total: 2, pages: 1 });
    expect(models.Item.lastFilter).toEqual({ owner: 'user-7' });
  });

  it('rejects impossible date ranges and malformed dates', async () => {
    const reversed = await request(app).get('/api/items').query({ from: '2026-11-05', to: '2026-11-01' });
    const malformed = await request(app).get('/api/items').query({ from: '2026-02-30' });
    expect(reversed.status).toBe(400);
    expect(malformed.status).toBe(400);
  });

  it('returns item details for a listing id', async () => {
    const item = { id: 'item-1', title: 'Blue bottle', owner: { name: 'Riley' } };
    models.Item.findById = vi.fn(() => ({ populate: async () => item }));
    const response = await request(app).get('/api/items/item-1');
    expect(response.status).toBe(200);
    expect(response.body.item.title).toBe('Blue bottle');
  });

  it('returns ranked open listings of the opposite type as match suggestions', async () => {
    const source = { id: 'lost-1', type: 'lost', title: 'Blue Samsung phone', description: 'Has a cracked case', category: 'Electronics', location: 'Central Library' };
    const candidate = { id: 'found-1', type: 'found', title: 'Samsung phone with blue case', description: 'Found by library steps', category: 'Electronics', location: 'Library entrance' };
    models.Item.findById = vi.fn().mockResolvedValue(source);
    models.Item.find = vi.fn((filter) => ({
      sort() { return this; },
      limit() { return this; },
      async populate() { this.filter = filter; return [candidate]; },
    }));

    const response = await request(app).get('/api/items/lost-1/matches');

    expect(response.status).toBe(200);
    expect(models.Item.find).toHaveBeenCalledWith({ status: 'open', type: 'found', _id: { $ne: 'lost-1' } });
    expect(response.body.matches[0]).toMatchObject({ item: { title: candidate.title }, score: expect.any(Number) });
    expect(response.body.matches[0].reasons).toContain('Same category');
  });

  it('creates private item conversations and allows only participants to read or send messages', async () => {
    const item = { id: 'item-1', owner: { toString: () => 'owner-1' }, status: 'open' };
    models.Item.findById = vi.fn().mockResolvedValue(item);
    const studentToken = jwt.sign({}, secret, { subject: 'student-1', expiresIn: '1h' });
    const ownerToken = jwt.sign({}, secret, { subject: 'owner-1', expiresIn: '1h' });
    const strangerToken = jwt.sign({}, secret, { subject: 'stranger-1', expiresIn: '1h' });

    const created = await request(app).post('/api/items/item-1/conversations').set('Authorization', `Bearer ${studentToken}`);
    const duplicate = await request(app).post('/api/items/item-1/conversations').set('Authorization', `Bearer ${studentToken}`);
    expect(created.status).toBe(200);
    expect(duplicate.body.conversation.id).toBe(created.body.conversation.id);
    const conversationId = created.body.conversation.id;

    const denied = await request(app).get(`/api/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${strangerToken}`);
    expect(denied.status).toBe(403);
    const sent = await request(app).post(`/api/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${studentToken}`).send({ text: 'I think this might be my water bottle.' });
    const visibleToOwner = await request(app).get(`/api/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${ownerToken}`);
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ sender: 'student-1', text: 'I think this might be my water bottle.' });
    expect(visibleToOwner.body.messages).toHaveLength(1);
    expect(models.notifications[0]).toMatchObject({ user: 'owner-1', type: 'message', conversation: 'conversation-1' });
  });

  it('notifies the owner when a newly posted item is a likely match', async () => {
    const foundItem = { id: 'found-1', title: 'Blue Samsung phone', description: 'Cracked case', category: 'Electronics', location: 'Library', type: 'found', owner: 'finder-1' };
    models.Item.find = vi.fn(() => ({ sort() { return this; }, limit() { return this; }, async populate() { return [foundItem]; } }));
    const token = jwt.sign({}, secret, { subject: 'lost-owner-1', expiresIn: '1h' });

    const response = await request(app).post('/api/items').set('Authorization', `Bearer ${token}`).send({ title: 'Blue Samsung phone', description: 'Cracked case', category: 'Electronics', location: 'Library', type: 'lost' });

    expect(response.status).toBe(201);
    expect(models.notifications).toHaveLength(1);
    expect(models.notifications[0]).toMatchObject({ user: 'lost-owner-1', type: 'match', item: 'found-1' });
  });

  it('only lets a notification owner mark it as read', async () => {
    const notification = await models.Notification.create({ user: 'user-1', type: 'match', title: 'Possible item match', message: 'A likely match was found.' });
    const ownerToken = jwt.sign({}, secret, { subject: 'user-1', expiresIn: '1h' });
    const strangerToken = jwt.sign({}, secret, { subject: 'user-2', expiresIn: '1h' });

    const forbidden = await request(app).patch(`/api/notifications/${notification.id}/read`).set('Authorization', `Bearer ${strangerToken}`);
    const read = await request(app).patch(`/api/notifications/${notification.id}/read`).set('Authorization', `Bearer ${ownerToken}`);

    expect(forbidden.status).toBe(403);
    expect(read.status).toBe(200);
    expect(read.body.notification.isRead).toBe(true);
  });

  it('paginates notification history and can filter to unread notifications', async () => {
    await models.Notification.create({ user: 'user-1', type: 'match', title: 'Older alert', message: 'An older match.' });
    await models.Notification.create({ user: 'user-1', type: 'message', title: 'Newer alert', message: 'A newer message.' });
    const read = await models.Notification.create({ user: 'user-1', type: 'claim-approved', title: 'Read alert', message: 'Already read.' });
    read.isRead = true;
    await models.Notification.create({ user: 'user-2', type: 'match', title: 'Private alert', message: 'Another user’s alert.' });
    const token = jwt.sign({}, secret, { subject: 'user-1', expiresIn: '1h' });

    const secondPage = await request(app).get('/api/notifications').query({ page: 2, limit: 1, unread: 'true' }).set('Authorization', `Bearer ${token}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.notifications[0].title).toBe('Older alert');
    expect(secondPage.body.pagination).toMatchObject({ page: 2, limit: 1, total: 2, pages: 2 });
    expect(secondPage.body.unreadCount).toBe(2);
  });

  it('restricts dashboard statistics to admins and reports project counts', async () => {
    models.items.push(
      { type: 'lost', status: 'open' },
      { type: 'found', status: 'open' },
      { type: 'found', status: 'claimed' },
    );
    models.claims.push({ status: 'pending' }, { status: 'approved' }, { status: 'rejected' });
    models.users.push({ id: 'student-1' }, { id: 'admin-1' });
    const studentToken = jwt.sign({ role: 'student' }, secret, { subject: 'student-1', expiresIn: '1h' });
    const adminToken = jwt.sign({ role: 'admin' }, secret, { subject: 'admin-1', expiresIn: '1h' });

    const forbidden = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${studentToken}`);
    const allowed = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);

    expect(forbidden.status).toBe(403);
    expect(allowed.body.stats).toEqual({ totalItems: 3, openLost: 1, openFound: 1, returnedItems: 1, pendingClaims: 1, totalUsers: 2, approvedClaims: 1, rejectedClaims: 1, claimApprovalRate: 50 });
  });

  it('only allows the owner to edit a listing', async () => {
    const item = { id: 'item-1', owner: { toString: () => 'user-7' }, title: 'Old title', async save() { return this; } };
    models.Item.findById = vi.fn().mockResolvedValue(item);
    const otherUserToken = jwt.sign({}, secret, { subject: 'user-8', expiresIn: '1h' });
    const ownerToken = jwt.sign({}, secret, { subject: 'user-7', expiresIn: '1h' });

    const forbidden = await request(app).patch('/api/items/item-1').set('Authorization', `Bearer ${otherUserToken}`).send({ title: 'Changed title' });
    const updated = await request(app).patch('/api/items/item-1').set('Authorization', `Bearer ${ownerToken}`).send({ title: 'Changed title' });
    expect(forbidden.status).toBe(403);
    expect(updated.status).toBe(200);
    expect(updated.body.item.title).toBe('Changed title');
  });

  it('only allows the owner to delete a listing', async () => {
    const item = { id: 'item-1', owner: { toString: () => 'user-7' }, async deleteOne() { this.deleted = true; } };
    models.Item.findById = vi.fn().mockResolvedValue(item);
    const otherUserToken = jwt.sign({}, secret, { subject: 'user-8', expiresIn: '1h' });
    const ownerToken = jwt.sign({}, secret, { subject: 'user-7', expiresIn: '1h' });

    const forbidden = await request(app).delete('/api/items/item-1').set('Authorization', `Bearer ${otherUserToken}`);
    const deleted = await request(app).delete('/api/items/item-1').set('Authorization', `Bearer ${ownerToken}`);
    expect(forbidden.status).toBe(403);
    expect(deleted.status).toBe(204);
    expect(item.deleted).toBe(true);
  });

  it('allows signed-in users to submit proof for another person’s found item', async () => {
    const item = { id: 'item-1', owner: { toString: () => 'owner-1' }, type: 'found', status: 'open' };
    models.Item.findById = vi.fn().mockResolvedValue(item);
    const token = jwt.sign({ role: 'student' }, secret, { subject: 'user-2', expiresIn: '1h' });
    const response = await request(app).post('/api/items/item-1/claims').set('Authorization', `Bearer ${token}`).send({ proof: 'There is a small scratch on the left side.' });
    expect(response.status).toBe(201);
    expect(response.body.claim).toMatchObject({ item: 'item-1', claimant: 'user-2', status: 'pending' });
  });

  it('rejects a claim on your own item and duplicate pending claims', async () => {
    const item = { id: 'item-1', owner: { toString: () => 'user-2' }, type: 'found', status: 'open' };
    models.Item.findById = vi.fn().mockResolvedValue(item);
    const token = jwt.sign({}, secret, { subject: 'user-2', expiresIn: '1h' });
    const ownClaim = await request(app).post('/api/items/item-1/claims').set('Authorization', `Bearer ${token}`).send({ proof: 'I can identify the contents inside.' });
    expect(ownClaim.status).toBe(400);

    item.owner = { toString: () => 'someone-else' };
    await request(app).post('/api/items/item-1/claims').set('Authorization', `Bearer ${token}`).send({ proof: 'I can identify the contents inside.' });
    const duplicate = await request(app).post('/api/items/item-1/claims').set('Authorization', `Bearer ${token}`).send({ proof: 'Another ownership detail is included.' });
    expect(duplicate.status).toBe(409);
  });

  it('restricts claim review to admins and marks an approved item claimed', async () => {
    const item = { id: 'item-1', status: 'open', async save() { return this; } };
    const claim = { id: 'claim-1', item: 'item-1', claimant: 'user-2', status: 'pending', async save() { return this; } };
    models.Item.findById = vi.fn().mockResolvedValue(item);
    models.Claim.findById = vi.fn().mockResolvedValue(claim);
    const studentToken = jwt.sign({ role: 'student' }, secret, { subject: 'user-2', expiresIn: '1h' });
    const adminToken = jwt.sign({ role: 'admin' }, secret, { subject: 'admin-1', expiresIn: '1h' });

    const forbidden = await request(app).get('/api/admin/claims').set('Authorization', `Bearer ${studentToken}`);
    const approved = await request(app).patch('/api/admin/claims/claim-1').set('Authorization', `Bearer ${adminToken}`).send({ status: 'approved', adminNotes: 'Identity details verified.' });
    expect(forbidden.status).toBe(403);
    expect(approved.status).toBe(200);
    expect(approved.body.claim).toMatchObject({ status: 'approved', reviewedBy: 'admin-1' });
    expect(item.status).toBe('claimed');
    expect(models.notifications[0]).toMatchObject({ user: 'user-2', type: 'claim-approved' });
  });

  it('does not allow public registration to assign an administrator role', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: 'Campus Security', email: 'security@jiit.ac.in', password: 'secure-pass-123', role: 'admin' });
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('student');
    expect(jwt.verify(response.body.token, secret).role).toBe('student');
  });
});
