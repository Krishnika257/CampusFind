import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { DEMO_PASSWORD } from './seedDemo.js';
import { seedAdminDemoData } from './seedAdminDemo.js';

function createMemoryModels() {
  const users = [];
  const items = [];
  const conversations = [];
  const messages = [];
  const notifications = [];
  let nextId = 1;
  const makeDoc = (values, collection, prefix) => {
    const doc = { ...values, _id: `${prefix}-${nextId++}`, async save() { return this; } };
    collection.push(doc);
    return doc;
  };
  const matches = (document, query) => Object.entries(query).every(([key, value]) => String(document[key]) === String(value));
  const model = (collection, prefix, uniqueFields) => ({
    async findOne(query) { return collection.find((document) => matches(document, query)) ?? null; },
    async create(values) {
      if (prefix === 'user') {
        const document = { ...values, _id: `${prefix}-${nextId++}`, async save() { return this; } };
        collection.push(document);
        return document;
      }
      const document = makeDoc(values, collection, prefix);
      if (uniqueFields?.length) for (const field of uniqueFields) document[field] ??= values[field];
      return document;
    },
  });

  return {
    users,
    items,
    conversations,
    messages,
    notifications,
    UserModel: model(users, 'user'),
    ItemModel: model(items, 'item'),
    ConversationModel: model(conversations, 'conversation'),
    MessageModel: model(messages, 'message'),
    NotificationModel: model(notifications, 'notification'),
  };
}

describe('admin demo data seeding', () => {
  it('creates the admin account and sample activity, then reruns without duplicates', async () => {
    const models = createMemoryModels();
    const input = { email: 'admin@example.com', password: 'MyLocalDemoPassword123!', name: 'Demo Admin', ...models };

    const first = await seedAdminDemoData(input);
    expect(first).toEqual({ accountCreated: true, listingsCreated: 3, conversationsCreated: 2, messagesCreated: 4, notificationsCreated: 3 });
    const admin = models.users.find((user) => user.email === input.email);
    expect(admin.role).toBe('admin');
    expect(await bcrypt.compare(input.password, admin.passwordHash)).toBe(true);
    expect(models.items.filter((item) => String(item.owner) === String(admin._id))).toHaveLength(3);
    expect(models.messages).toHaveLength(4);
    expect(models.notifications).toHaveLength(3);

    await expect(seedAdminDemoData(input)).resolves.toEqual({ accountCreated: false, listingsCreated: 0, conversationsCreated: 0, messagesCreated: 0, notificationsCreated: 0 });
    expect(models.users.filter((user) => user.email === input.email)).toHaveLength(1);
    expect(models.items.filter((item) => String(item.owner) === String(admin._id))).toHaveLength(3);
  });

  it('does not overwrite an existing account when its password does not match', async () => {
    const models = createMemoryModels();
    models.users.push({ email: 'admin@example.com', role: 'student', passwordHash: await bcrypt.hash('different-password', 4) });

    await expect(seedAdminDemoData({ email: 'admin@example.com', password: 'MyLocalDemoPassword123!', ...models })).rejects.toThrow('different password');
    expect(models.users[0].role).toBe('student');
    expect(models.items).toHaveLength(0);
  });

  it('resets and promotes an existing account only when explicitly requested', async () => {
    const models = createMemoryModels();
    const existingHash = await bcrypt.hash('old-demo-password', 4);
    models.users.push({ _id: 'user-admin', email: 'admin@example.com', role: 'student', passwordHash: existingHash, async save() { return this; } });

    const result = await seedAdminDemoData({ email: 'admin@example.com', password: 'MyLocalDemoPassword123!', resetExistingPassword: true, ...models });

    expect(result.accountCreated).toBe(false);
    expect(models.users[0].role).toBe('admin');
    expect(models.users[0].passwordHash).not.toBe(existingHash);
    expect(await bcrypt.compare('MyLocalDemoPassword123!', models.users[0].passwordHash)).toBe(true);
  });
});
