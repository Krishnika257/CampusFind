import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Conversation, Item, Message, Notification, User } from './models.js';
import { DEMO_USER_EMAILS, seedDemoData } from './seedDemo.js';

const adminListings = [
  { title: 'Blue key pouch found', description: 'Found a navy fabric key pouch near the library. The owner can identify the small stitched star on the inside.', category: 'Accessories', location: 'Central Library', type: 'found' },
  { title: 'Orange umbrella found', description: 'Found a compact orange umbrella after the afternoon lecture.', category: 'Accessories', location: 'Academic Block', type: 'found' },
  { title: 'Graph notebook lost', description: 'Lost a graph-paper notebook with handwritten engineering notes.', category: 'Books', location: 'Student Activity Centre', type: 'lost' },
];

const sampleChats = [
  {
    itemTitle: adminListings[0].title,
    studentEmail: DEMO_USER_EMAILS[1],
    messages: [
      { sender: 'student', text: 'Hi, I think the blue key pouch may be mine. Is it still available?' },
      { sender: 'admin', text: 'It is safe with campus staff. Please tell us the stitched detail inside so we can verify it.' },
    ],
  },
  {
    itemTitle: adminListings[1].title,
    studentEmail: DEMO_USER_EMAILS[0],
    messages: [
      { sender: 'student', text: 'I may have left my umbrella in the Academic Block. Can you share where to collect it?' },
      { sender: 'admin', text: 'Please confirm one detail about it, then we can arrange a campus pickup.' },
    ],
  },
];

function idOf(document) {
  return document?._id || document?.id;
}

function sameId(left, right) {
  return String(left) === String(right);
}

export async function seedAdminDemoData({
  email,
  password,
  name = 'CampusFind Admin',
  resetExistingPassword = false,
  UserModel = User,
  ItemModel = Item,
  ConversationModel = Conversation,
  MessageModel = Message,
  NotificationModel = Notification,
} = {}) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Set DEMO_ADMIN_EMAIL to a valid email address.');
  if (DEMO_USER_EMAILS.includes(normalizedEmail)) throw new Error('Use a separate email for the admin demo account, not a sample student account.');
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set DEMO_ADMIN_PASSWORD to a password between 8 and 72 bytes.');
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('DEMO_ADMIN_NAME must be between 1 and 80 characters.');

  let admin = await UserModel.findOne({ email: normalizedEmail });
  const passwordMatches = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
  if (admin && !passwordMatches && !resetExistingPassword) {
    throw new Error('That account already exists with a different password. No account or demo data was changed.');
  }

  await seedDemoData({ UserModel, ItemModel });
  const students = await Promise.all(DEMO_USER_EMAILS.map((studentEmail) => UserModel.findOne({ email: studentEmail })));
  if (students.some((student) => !student)) throw new Error('Could not prepare the sample student accounts.');

  let accountCreated = false;
  if (!admin) {
    admin = await UserModel.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
    });
    accountCreated = true;
  } else if (!passwordMatches || admin.role !== 'admin') {
    if (!passwordMatches) admin.passwordHash = await bcrypt.hash(password, 12);
    if (admin.role !== 'admin') admin.role = 'admin';
    await admin.save();
  }

  let listingsCreated = 0;
  const listingsByTitle = new Map();
  for (const listingData of adminListings) {
    let listing = await ItemModel.findOne({ title: listingData.title, owner: idOf(admin) });
    if (!listing) {
      listing = await ItemModel.create({ ...listingData, owner: idOf(admin), status: 'open' });
      listingsCreated += 1;
    }
    listingsByTitle.set(listingData.title, listing);
  }

  let conversationsCreated = 0;
  let messagesCreated = 0;
  let notificationsCreated = 0;
  for (const chatData of sampleChats) {
    const listing = listingsByTitle.get(chatData.itemTitle);
    const student = students[DEMO_USER_EMAILS.indexOf(chatData.studentEmail)];
    const adminId = idOf(admin);
    const studentId = idOf(student);
    const participantKey = [String(adminId), String(studentId)].sort().join(':');
    const conversationFilter = { item: idOf(listing), participantKey };
    let conversation = await ConversationModel.findOne(conversationFilter);
    if (!conversation) {
      conversation = await ConversationModel.create({ item: idOf(listing), participants: [adminId, studentId], participantKey });
      conversationsCreated += 1;
    }

    for (const messageData of chatData.messages) {
      const senderId = messageData.sender === 'admin' ? adminId : studentId;
      const messageFilter = { conversation: idOf(conversation), sender: senderId, text: messageData.text };
      let message = await MessageModel.findOne(messageFilter);
      if (!message) {
        message = await MessageModel.create(messageFilter);
        messagesCreated += 1;
      }
      conversation.lastMessage = messageData.text.slice(0, 300);
      conversation.lastMessageAt = message.createdAt || new Date();
    }
    await conversation.save();

    const notificationFilter = { user: adminId, type: 'message', conversation: idOf(conversation), title: 'New private message' };
    if (!(await NotificationModel.findOne(notificationFilter))) {
      await NotificationModel.create({
        ...notificationFilter,
        message: `There is a demo conversation about “${listing.title}”.`,
        item: idOf(listing),
        isRead: false,
      });
      notificationsCreated += 1;
    }
  }

  const matchedListing = listingsByTitle.get(adminListings[2].title);
  const matchFilter = { user: idOf(admin), type: 'match', title: 'Possible item match', item: idOf(matchedListing) };
  if (!(await NotificationModel.findOne(matchFilter))) {
    await NotificationModel.create({
      ...matchFilter,
      message: 'A sample found listing may match your lost notebook.',
      isRead: false,
    });
    notificationsCreated += 1;
  }

  return { accountCreated, listingsCreated, conversationsCreated, messagesCreated, notificationsCreated };
}

export async function runAdminSeed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Admin demo seeding is disabled when NODE_ENV=production.');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusfind';
  const hostname = new URL(uri).hostname.toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) throw new Error('Admin demo seeding is restricted to a local MongoDB host.');

  await mongoose.connect(uri);
  try {
    const result = await seedAdminDemoData({
      email: process.env.DEMO_ADMIN_EMAIL,
      password: process.env.DEMO_ADMIN_PASSWORD,
      name: process.env.DEMO_ADMIN_NAME || 'CampusFind Admin',
      resetExistingPassword: process.env.DEMO_ADMIN_RESET_PASSWORD === 'YES',
    });
    console.log(`Local admin demo data ready: ${result.listingsCreated} listings, ${result.conversationsCreated} conversations, ${result.messagesCreated} messages, and ${result.notificationsCreated} notifications added.`);
    console.log('The demo admin email is the DEMO_ADMIN_EMAIL value you supplied. The password was not printed or stored in the source code.');
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAdminSeed().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
