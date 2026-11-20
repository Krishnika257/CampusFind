import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Item, User } from './models.js';

export const DEMO_PASSWORD = 'CampusFindDemo123!';

const demoUsers = [
  { name: 'Riya Sharma', email: 'riya.student@example.invalid' },
  { name: 'Kabir Mehta', email: 'kabir.student@example.invalid' },
];

const demoListings = [
  { title: 'Blue steel water bottle (lost)', description: 'Lost my blue steel bottle with a small constellation sticker. I last remember having it near the Central Library entrance.', category: 'Accessories', location: 'Central Library', type: 'lost', ownerEmail: demoUsers[0].email },
  { title: 'Blue bottle found near library', description: 'Found a blue steel bottle with a constellation sticker by the Central Library entrance. Please describe the sticker to claim it.', category: 'Accessories', location: 'Central Library', type: 'found', ownerEmail: demoUsers[1].email },
  { title: 'Black wireless earbuds (lost)', description: 'Black wireless earbuds in a compact charging case. Lost around the auditorium after the afternoon lecture.', category: 'Electronics', location: 'Auditorium A', type: 'lost', ownerEmail: demoUsers[1].email },
  { title: 'Found black earbuds case', description: 'Found a black earbuds case in the auditorium lobby. Tell me the brand and case detail to identify it.', category: 'Electronics', location: 'Auditorium lobby', type: 'found', ownerEmail: demoUsers[0].email },
  { title: 'Graph paper notebook found', description: 'Found a small graph paper notebook in the study area. It has handwritten lecture notes inside.', category: 'Books', location: 'Engineering Block study area', type: 'found', ownerEmail: demoUsers[1].email },
];

export async function seedDemoData({ UserModel = User, ItemModel = Item } = {}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const usersByEmail = new Map();
  let usersCreated = 0;
  let listingsCreated = 0;

  for (const userData of demoUsers) {
    let user = await UserModel.findOne({ email: userData.email });
    if (user) {
      if (!(await bcrypt.compare(DEMO_PASSWORD, user.passwordHash))) {
        throw new Error(`Reserved demo account ${userData.email} already exists with a different password; no data was overwritten.`);
      }
    } else {
      user = await UserModel.create({ ...userData, passwordHash, role: 'student' });
      usersCreated += 1;
    }
    usersByEmail.set(userData.email, user);
  }

  for (const listing of demoListings) {
    const { ownerEmail, ...itemData } = listing;
    const owner = usersByEmail.get(ownerEmail);
    const existing = await ItemModel.findOne({ title: itemData.title, owner: owner._id });
    if (!existing) {
      await ItemModel.create({ ...itemData, owner: owner._id, status: 'open' });
      listingsCreated += 1;
    }
  }

  return { usersCreated, listingsCreated };
}

export async function runSeed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seeding is disabled when NODE_ENV=production.');
  }
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusfind';
  await mongoose.connect(uri);
  try {
    const result = await seedDemoData();
    console.log(`Demo data ready: ${result.usersCreated} users and ${result.listingsCreated} listings added.`);
    console.log(`Sign in with ${demoUsers[0].email} or ${demoUsers[1].email}; password: ${DEMO_PASSWORD}`);
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSeed().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
