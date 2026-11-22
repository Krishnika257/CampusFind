# CampusFind

CampusFind is a campus lost-and-found application. Students can post lost and found items, search listings, submit ownership claims, and coordinate returns through private messages.

## Features

- Student registration and sign-in with hashed passwords and JWT authentication. Public registration always creates a student account.
- Create, edit, and delete your own listings; view a personal listings page.
- Browse open listings and filter by keyword, category, location, lost/found type, and date. Results are paginated.
- View listing details and suggested matches between lost and found items.
- Submit a claim with private ownership details. The person who posted a found listing can review claims on that item; an admin can review claims from the dashboard as a backup. Approval records a verification method and marks the item as returned.
- Private in-app conversations, message notifications, match alerts, and notification history.
- Admin dashboard with campus activity and claim statistics.
- Responsive mobile layout and light/dark themes.

Claim review is a human check: the reviewer should confirm an identifying detail and arrange the handoff before approving. The app does not verify email ownership or enforce a specific email domain.

## Technology

- Client: React and Vite, styled with CSS
- API: Node.js and Express
- Database: MongoDB and Mongoose
- Authentication: JWT and bcrypt
- Tests: Vitest, Testing Library, and Supertest
- CI: GitHub Actions runs tests and builds the client for pull requests and pushes to `main`.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB Community Server running locally, or a MongoDB connection URI

## Run locally

From the repository root:

```sh
npm install
```

Copy `server/.env.example` to `server/.env` and configure the database URI and JWT secret. The default database URI is `mongodb://127.0.0.1:27017/campusfind`. Copy `client/.env.example` to `client/.env` if you need to change the API URL; the local default is `http://localhost:4000/api`.

Start the client and API together:

```sh
npm run dev
```

- Client: <http://localhost:5173>
- API health check: <http://localhost:4000/api/health>

The API requires `JWT_SECRET`. Set `CLIENT_ORIGIN` to the client origin when running the client from a different host or port. Never commit `.env` files or production secrets.

## Tests and production build

Run the automated test suite:

```sh
npm test
```

Build the client for deployment:

```sh
npm run build --workspace @campusfind/client
```

## Optional student demo data

To add two fictional student accounts and five sample listings to the database configured for the server, run:

```sh
npm run seed:demo
```

Sample student logins:

- `riya.student@example.invalid`
- `kabir.student@example.invalid`
- Shared sample password: `CampusFindDemo123!`

The command is repeatable and refuses to run when `NODE_ENV=production`. Use it only with a development database; do not seed production data.

## Optional local admin and activity demo

To create or promote a local admin account and add three admin listings, two conversations, sample messages, and notifications, set `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`, then run:

```sh
npm run seed:admin-demo
```

The admin seeder only connects to a localhost MongoDB host and refuses `NODE_ENV=production`. If the account already exists with a different password, it stops without changing it. To intentionally reset the password for that local demo account, set `DEMO_ADMIN_RESET_PASSWORD=YES` for that run. Do not put real credentials in source files or commit them.

## Deployment configuration

Deploy the client and API as separate services and use a remotely reachable MongoDB database. Configure these environment values on the relevant service:

- Client build: `VITE_API_URL`, set to the deployed API base URL ending in `/api`
- API: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, and the hosting platform's `PORT`

Use a strong, private JWT secret and set `CLIENT_ORIGIN` to the exact deployed client origin. Do not run either demo seeder against a production database.
