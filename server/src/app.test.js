import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from './app.js';

const secret = 'test-only-campusfind-secret';

function createModels() {
  const users = [];
  const claims = [];
  const itemModel = {
    lastFilter: null,
    find(filter) {
      this.lastFilter = filter;
      return { sort() { return this; }, limit() { return this; }, async populate() { return []; } };
    },
    async create(fields) { return { id: 'item-1', ...fields }; },
  };
  const userModel = {
    async exists(filter) { return users.some((user) => user.email === filter.email); },
    async create(fields) {
      const user = { id: `user-${users.length + 1}`, ...fields };
      users.push(user);
      return user;
    },
    async findOne(filter) { return users.find((user) => user.email === filter.email) || null; },
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
  };
  return { users, claims, User: userModel, Item: itemModel, Claim: claimModel };
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

  it('logs in with the normalized email and rejects an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('campus-pass-123', 4);
    models.users.push({ id: 'user-1', name: 'Riley', email: 'riley@jiit.ac.in', passwordHash });

    const success = await request(app).post('/api/auth/login').send({ email: ' RILEY@JIIT.AC.IN ', password: 'campus-pass-123' });
    const failure = await request(app).post('/api/auth/login').send({ email: 'riley@jiit.ac.in', password: 'wrong-pass' });
    expect(success.status).toBe(200);
    expect(jwt.verify(success.body.token, secret).sub).toBe('user-1');
    expect(failure.status).toBe(401);
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
    const claim = { id: 'claim-1', item: 'item-1', status: 'pending', async save() { return this; } };
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
  });

  it('does not allow public registration to assign an administrator role', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: 'Campus Security', email: 'security@jiit.ac.in', password: 'secure-pass-123', role: 'admin' });
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('student');
    expect(jwt.verify(response.body.token, secret).role).toBe('student');
  });
});
