import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 4000;
const jwtSecret = process.env.JWT_SECRET;
const app = createApp({ jwtSecret });

async function start() {
  if (!jwtSecret) throw new Error('JWT_SECRET is missing. Copy server/.env.example to server/.env and set a secret.');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusfind');
  app.listen(port, () => console.log(`CampusFind API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error(`Could not start CampusFind API: ${error.message}`);
  process.exit(1);
});
