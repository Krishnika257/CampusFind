import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { DEMO_PASSWORD, seedDemoData } from './seedDemo.js';

function createMemoryModels() {
  const users = [];
  const items = [];
  let nextId = 1;
  const UserModel = {
    async findOne(query) { return users.find((user) => user.email === query.email) ?? null; },
    async create(user) { const saved = { ...user, _id: `user-${nextId++}` }; users.push(saved); return saved; },
  };
  const ItemModel = {
    async findOne(query) { return items.find((item) => item.title === query.title && item.owner === query.owner) ?? null; },
    async create(item) { items.push({ ...item, _id: `item-${nextId++}` }); return items.at(-1); },
  };
  return { UserModel, ItemModel, users, items };
}

describe('demo data seeding', () => {
  it('creates fictional student accounts and sample listings, then safely reruns', async () => {
    const models = createMemoryModels();
    const first = await seedDemoData(models);

    expect(first).toEqual({ usersCreated: 2, listingsCreated: 5 });
    expect(models.users.every((user) => user.role === 'student')).toBe(true);
    expect(models.users.every((user) => user.email.endsWith('@example.invalid'))).toBe(true);
    expect(await bcrypt.compare(DEMO_PASSWORD, models.users[0].passwordHash)).toBe(true);
    expect(models.items.some((item) => item.type === 'lost')).toBe(true);
    expect(models.items.some((item) => item.type === 'found')).toBe(true);

    await expect(seedDemoData(models)).resolves.toEqual({ usersCreated: 0, listingsCreated: 0 });
    expect(models.users).toHaveLength(2);
    expect(models.items).toHaveLength(5);
  });

  it('refuses to reuse a reserved demo email with a different password', async () => {
    const models = createMemoryModels();
    models.users.push({ email: 'riya.student@example.invalid', passwordHash: await bcrypt.hash('not-the-demo-password', 4) });

    await expect(seedDemoData(models)).rejects.toThrow('already exists with a different password');
    expect(models.items).toHaveLength(0);
  });
});
