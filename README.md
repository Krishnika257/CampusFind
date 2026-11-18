# CampusFind

CampusFind is a campus lost-and-found app. Students can report lost or found items, browse listings, and request the return of an item.

## MVP plan (9–10 days)

1. Setup and a running client/server skeleton
2. Accounts and lost/found item posting
3. Browse, search, and filtering
4. Claim submission and basic admin review
5. Verification, bug fixes, and deployment preparation

## Stack

- Client: React, Vite, and Tailwind CSS
- API: Node.js and Express
- Database: MongoDB
- Authentication: JWT and bcrypt

## Getting started

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

The Vite client runs at <http://localhost:5173>. The API runs at <http://localhost:4000> and exposes `GET /api/health`.

Copy `server/.env.example` to `server/.env` before connecting MongoDB or configuring authentication. Never commit `.env` files.
