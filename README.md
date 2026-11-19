# ReliefLink
# ReliefLink

ReliefLink is a full-stack humanitarian emergency-response platform designed to streamline assistance requests, volunteer coordination, and real-time communication. Its backend is architected using Node.js, Express.js, PostgreSQL, Supabase, and the Nexconn Server SDK, implementing RESTful APIs, JWT-based authentication, role-based access control (RBAC), and Row Level Security (RLS).

The system supports three user roles—Residents, Volunteers, and Administrators—with functionalities including user profile management, emergency request creation and tracking, volunteer availability management, request assignment, and administrative operations. Nexconn integration enables secure chat-token generation and authorized communication between assigned residents and volunteers, alongside real-time incoming message notifications across dashboards.
Disaster relief coordination platform, built for the Nexconn Build Challenge 2026.


## Features
- Resident: sign up, send a help request (category, description, map pin), track its status, cancel a pending request, chat with the assigned volunteer
- Volunteer: see requests waiting for help on a list and a map, accept one, update its status (In Progress, Resolved), chat with the resident
- Admin: see every request, verify it, assign a volunteer, add volunteer accounts
- Chat: Nexconn ChatUI with a "Send my location" button

## Tech
- Frontend: HTML, CSS, JavaScript, Vite, Nexconn ChatUI for Web, Google Maps
- Backend: Node.js, Express, Supabase (login and database), Nexconn server SDK (chat tokens)

## Folder layout
```
Homepage/          landing page
LoginSignupPage/   login and sign-up
Dashboards/        resident, volunteer and admin pages, request form, chat
js/api.js          the one file every page uses to talk to the backend (has a mock mode)
backend/           the Express server
```

## Run it

### Option A: mock mode (no backend needed)
1. Install Node.js 18.12 or newer.
2. In the project root: `npm install`, then `npm run dev`
3. Open http://localhost:5173/Homepage/index.html
4. `js/api.js` must have `USE_MOCK = true`. Demo accounts: `citizen@relieflink.test` / `citizen123`, `volunteer@relieflink.test` / `volunteer123`, `admin@relieflink.test` / `admin123`

### Option B: real backend
1. Install Git and Node.js. Create `backend/.env` (see below).
2. Terminal 1: `cd backend`, `npm install`, `node server.js` (runs on port 3000)
3. Terminal 2 (project root): `npm install`, `npm run dev`
4. In `js/api.js` set `USE_MOCK = false`, then open http://localhost:5173 (use `localhost`, not `127.0.0.1`)

### backend/.env (never commit this file)
```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXCONN_APP_KEY=
NEXCONN_APP_SECRET=
NEXCONN_PRIMARY_API_DOMAIN=
NEXCONN_SECONDARY_API_DOMAIN=
PORT=3000
FRONTEND_URL=
CORS_ORIGIN=
ALLOW_VERCEL_ORIGINS=false
ADMIN_CONTACT_EMAIL=

## Team
* **Debangan Chakraborty** – Lead Frontend, UI/UX, Nexconn ChatUI Integration & Deployment
* **Subhayu Chatterjee** – Backend API, Supabase Database/RLS & Nexconn Server SDK
* **Anwesan Chatterjee** – Frontend Support
* **Sourati Ghosh** – UI & Workflow Testing
