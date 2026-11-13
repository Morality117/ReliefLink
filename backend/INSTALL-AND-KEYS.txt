NEXCONN BACKEND — INSTALLATION AND KEY PLACEMENT
=================================================

PROJECT STRUCTURE
-----------------
This package uses:
  route/       (NOT routes/ and NOT route.js/)
  middleware/
  controllers/
  services/
  utils/
  tests/

The package contains a new integrated server.js and supabase.js.
It intentionally does NOT contain `server,js`; keep your old legacy file
separately and do not run it. Start the app with `node server.js`.

INSTALL
-------
1. Back up your current project folder.
2. Extract this ZIP.
3. Copy/merge the package contents into your existing nexconn-backend folder.
4. Do not overwrite your real .env file. If you do not have one, copy
   `.env.example` to `.env`.
5. Open a terminal in the project root and run:
      npm install
6. Start:
      npm start
   or:
      node server.js

WHERE TO PUT SUPABASE KEYS
--------------------------
In the `.env` file at the SAME LEVEL as server.js and package.json:
  SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
  SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

Use the Supabase project URL and publishable key from your Supabase project
API settings. Do not use a secret/service-role key as the publishable key.

WHERE TO PUT NEXCONN SDK APP KEY AND SECRET
-------------------------------------------
Put them in that SAME project-root `.env` file:
  NEXCONN_APP_KEY=your_actual_nexconn_app_key
  NEXCONN_APP_SECRET=your_actual_nexconn_app_secret

Do NOT put either key in:
  - frontend JavaScript / React / mobile app
  - public HTML
  - GitHub
  - screenshots or messages
  - API response bodies

Do not prefix these secrets with VITE_, REACT_APP_, NEXT_PUBLIC_, or EXPO_PUBLIC_.
Keep `.env` in `.gitignore`.

IMPORTANT SDK NOTE
------------------
This project currently reads and checks the two Nexconn credential environment
variables at server startup. No Nexconn SDK package name, API endpoint, signing
algorithm, or authentication protocol was supplied in the project information.
Therefore this package does NOT invent a fake SDK integration or pretend that
the Nexconn SDK is already making API calls. To wire the SDK itself, use the
official Nexconn SDK documentation to identify the exact npm package, import,
initialization method, and API calls. Then initialize it in a backend-only
module (for example services/nexconn.service.js), reading the two values from
process.env. Never hardcode credentials.

DATABASE / SECURITY NOTES
-------------------------
- API requests use a Supabase client carrying the authenticated user's JWT.
  This keeps database requests subject to Supabase RLS.
- Do not add a service-role key to this code.
- Your assignments INSERT policy is checked by Supabase. It requires assigned_by
  to equal auth.uid(), an active volunteer, and the appropriate role/request state.
- Your assignments SELECT policy permits admin, the assigned volunteer, or the
  resident who owns the related request.
- Your volunteer_profiles fields are user_id, available, skills, created_at.
- Your supplied database schema did not include a notifications table/provider.
  notification.service.js is a logging adapter only; it does not send email/push.
- Status updates depend on help_requests UPDATE RLS policies. The app does not
  bypass RLS. If those policies do not permit the operation, the API will fail
  safely. Confirm database policies enforce resident ownership and volunteer
  assignment before production use.
- Admin endpoints require profiles.role = 'admin'. Create/assign that role only
  through a trusted administrative process, never through public profile PATCH.

TEST CONFIGURATION
------------------
For tests, set TEST_EMAIL and TEST_PASSWORD in .env to a suitable Supabase
test account. The volunteer test requires a volunteer-role account with a
volunteer_profiles row. The admin test requires an admin-role account.
The workflow test creates a real test help_request row; clean it up in Supabase
afterward if desired.

ROUTES
------
GET    /                         public health
GET    /health                   configuration status (never exposes keys)

POST   /api/requests             resident creates request
GET    /api/requests/my          resident lists own requests
GET    /api/requests/:id         request visible under RLS
PATCH  /api/requests/:id/status  role-authorized status update

GET    /api/resident/profile
PATCH  /api/resident/profile
GET    /api/resident/requests
POST   /api/resident/requests

GET    /api/volunteer/requests/available
GET    /api/volunteer/assignments/my
POST   /api/volunteer/requests/:requestId/accept
PATCH  /api/volunteer/requests/:requestId/status

GET    /api/admin/requests
PATCH  /api/admin/requests/:requestId/status
POST   /api/admin/requests/:requestId/assign
GET    /api/admin/users
