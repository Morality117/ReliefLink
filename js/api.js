/* =====================================================================
   api.js: every page talks to the "backend" ONLY through this file.
   - USE_MOCK = true  -> a fake backend that lives in the browser (for building and demos)
   - USE_MOCK = false -> your friend's real server (fill in the CHANGE parts first)
   Pages never change when you switch. Only this file does.
   ===================================================================== */

const USE_MOCK = true;
const API_URL = "http://localhost:3000";   // CHANGE: your friend's server address

/* ---------- Where pages live (works from LoginSignupPage and Dashboards) ---------- */
const LOGIN_PAGE = "../LoginSignupPage/login.html";
const HOME_PAGE = {
  citizen: "../Dashboards/citizen-dashboard.html",
  volunteer: "../Dashboards/volunteer-dashboard.html",
  admin: "../Dashboards/admin-dashboard.html",
};
function homeFor(role) { return HOME_PAGE[role] || LOGIN_PAGE; }

/* ---------- Session: who is logged in ---------- */
const SESSION_KEY = "relieflink_session";
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}
function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function logout() { localStorage.removeItem(SESSION_KEY); }

// Put at the top of every protected page. Sends the wrong person away.
// NOTE: this only hides pages. The real protection must be in the backend.
function requireRole(role) {
  const session = getSession();
  if (!session || session.user.role !== role) {
    window.location.href = session ? homeFor(session.user.role) : LOGIN_PAGE;
    return null;
  }
  const nameEl = document.querySelector("#user-name");
  if (nameEl) nameEl.textContent = session.user.name;
  const out = document.querySelector("#logout");
  if (out) out.addEventListener("click", () => logout());
  return session.user;
}

/* ---------- Small helpers used by the pages ---------- */
const TYPE_LABELS = {
  food: "Food and drinking water", medical: "Medical help",
  rescue: "Rescue / evacuation", shelter: "Shelter", other: "Other",
};
const STATUS_LABELS = { unassigned: "Unassigned", assigned: "Assigned", inprogress: "In progress", resolved: "Resolved" };
function typeLabel(type) { return TYPE_LABELS[type] || type; }
function peopleText(n) { return n + (Number(n) === 1 ? " person" : " people"); }

function timeAgo(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";
  const hours = Math.round(min / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hours / 24);
  return days + (days === 1 ? " day ago" : " days ago");
}

// Make an element safely. textContent means user text can never run as code.
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* =====================================================================
   MOCK BACKEND (fake data stored in the browser's localStorage)
   Demo accounts:  citizen@relieflink.test / citizen123
                   volunteer@relieflink.test / volunteer123
                   admin@relieflink.test / admin123
   To reset the fake data: run  localStorage.clear()  in the Console (F12).
   ===================================================================== */
const DB_KEY = "relieflink_mock_db";

function seedDb() {
  const now = Date.now();
  return {
    users: [
      { id: "u-admin", name: "Admin", email: "admin@relieflink.test", password: "admin123", role: "admin", phone: "" },
      { id: "u-rahul", name: "Rahul Das", email: "volunteer@relieflink.test", password: "volunteer123", role: "volunteer", phone: "" },
      { id: "u-anita", name: "Anita Das", email: "anita@relieflink.test", password: "volunteer123", role: "volunteer", phone: "" },
      { id: "u-sen", name: "Rahul Sen", email: "citizen@relieflink.test", password: "citizen123", role: "citizen", phone: "" },
      { id: "u-meera", name: "Meera Paul", email: "meera@relieflink.test", password: "citizen123", role: "citizen", phone: "" },
    ],
    requests: [
      { id: "r1", type: "rescue", people: 5, urgency: "high", description: "Water is rising, two elderly people upstairs", location: "Esplanade, Kolkata", latitude: 22.5726, longitude: 88.3639, accuracy: null, status: "unassigned", residentId: "u-sen", volunteerId: null, createdAt: now - 10 * 60000 },
      { id: "r2", type: "food", people: 4, urgency: "medium", description: "No drinking water since morning", location: "Salt Lake, Kolkata", latitude: 22.5958, longitude: 88.3841, accuracy: null, status: "assigned", residentId: "u-meera", volunteerId: "u-rahul", createdAt: now - 60 * 60000 },
      { id: "r3", type: "shelter", people: 2, urgency: "low", description: "Home flooded, need a place to stay", location: "Jadavpur, Kolkata", latitude: 22.5448, longitude: 88.3426, accuracy: null, status: "resolved", residentId: "u-sen", volunteerId: "u-anita", createdAt: now - 26 * 3600000 },
    ],
  };
}
function loadDb() {
  try { const raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  const db = seedDb(); saveDb(db); return db;
}
function saveDb(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function publicUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role }; }
function nameOf(db, id) { const u = db.users.find((x) => x.id === id); return u ? u.name : null; }
function withNames(db, r) { return { ...r, residentName: nameOf(db, r.residentId) || "Unknown", volunteerName: r.volunteerId ? nameOf(db, r.volunteerId) : null }; }
function need(role) {   // mirrors what the real backend must enforce
  const s = getSession();
  if (!s || s.user.role !== role) throw new Error("Not allowed");
  return s.user;
}

const mockApi = {
  async login(email, password) {
    const db = loadDb();
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) throw new Error("Wrong email or password");
    const user = publicUser(u);
    saveSession({ token: "mock-" + u.id, user });
    return user;
  },
  async signup(data) {
    if (data.role !== "citizen" && data.role !== "volunteer") throw new Error("Invalid role");
    const db = loadDb();
    if (db.users.some((x) => x.email.toLowerCase() === data.email.trim().toLowerCase())) throw new Error("An account with this email already exists");
    const u = { id: "u-" + Date.now(), name: data.name.trim(), email: data.email.trim(), phone: data.phone, password: data.password, role: data.role };
    db.users.push(u); saveDb(db);
    const user = publicUser(u);
    saveSession({ token: "mock-" + u.id, user });
    return user;
  },
  async createRequest(d) {
    const user = need("citizen"); const db = loadDb();
    const r = { id: "r" + Date.now(), type: d.type, people: Number(d.people), urgency: d.urgency, description: d.description, location: d.location, latitude: d.latitude, longitude: d.longitude, accuracy: d.accuracy, status: "unassigned", residentId: user.id, volunteerId: null, createdAt: Date.now() };
    db.requests.push(r); saveDb(db);
    return withNames(db, r);
  },
  async getMyRequests() {
    const user = need("citizen"); const db = loadDb();
    return db.requests.filter((r) => r.residentId === user.id).sort((a, b) => b.createdAt - a.createdAt).map((r) => withNames(db, r));
  },
  async getAllRequests() {
    need("admin"); const db = loadDb();
    return [...db.requests].sort((a, b) => b.createdAt - a.createdAt).map((r) => withNames(db, r));
  },
  async getMyTasks() {
    const user = need("volunteer"); const db = loadDb();
    return db.requests.filter((r) => r.volunteerId === user.id).map((r) => withNames(db, r));
  },
  async getVolunteers() {
    need("admin"); const db = loadDb();
    return db.users.filter((u) => u.role === "volunteer").map(publicUser);
  },
  async assignVolunteer(requestId, volunteerId) {
    need("admin"); const db = loadDb();
    const r = db.requests.find((x) => x.id === requestId);
    const v = db.users.find((x) => x.id === volunteerId && x.role === "volunteer");
    if (!r || !v) throw new Error("Request or volunteer not found");
    if (r.status !== "unassigned") throw new Error("This request is already assigned");
    r.volunteerId = v.id; r.status = "assigned"; saveDb(db);
    return withNames(db, r);
  },
  async updateStatus(requestId, status) {
    const user = need("volunteer"); const db = loadDb();
    const r = db.requests.find((x) => x.id === requestId);
    if (!r || r.volunteerId !== user.id) throw new Error("This task isn't assigned to you");
    const allowed = { assigned: "inprogress", inprogress: "resolved" };
    if (allowed[r.status] !== status) throw new Error("That status change isn't allowed");
    r.status = status; saveDb(db);
    return withNames(db, r);
  },
};

/* =====================================================================
   REAL BACKEND. Everything marked CHANGE must match your friend's server.
   (His test used the word "resident" and the statuses "In Progress" / "Resolved".)
   ===================================================================== */
const ROLE_FROM_BACKEND = { resident: "citizen", volunteer: "volunteer", admin: "admin" };   // CHANGE if needed
const ROLE_TO_BACKEND = { citizen: "resident", volunteer: "volunteer" };

async function http(method, path, body) {
  const session = getSession();
  const headers = { "Content-Type": "application/json" };
  if (session) headers.Authorization = "Bearer " + session.token;
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error("Can't reach the server");
  }
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && (data.error || data.message)) || "Request failed (" + res.status + ")");
  return data;
}

const realApi = {
  async login(email, password) {
    const data = await http("POST", "/auth/login", { email, password });                  // CHANGE: address and field names
    const user = { id: data.user.id, name: data.user.name, email: data.user.email, role: ROLE_FROM_BACKEND[data.user.role] };
    saveSession({ token: data.token, user });
    return user;
  },
  async signup(d) {
    await http("POST", "/auth/register", { name: d.name, email: d.email, phone: d.phone, password: d.password, role: ROLE_TO_BACKEND[d.role] });   // CHANGE
    return realApi.login(d.email, d.password);
  },
  createRequest: (d) => http("POST", "/requests", d),                                    // CHANGE
  getMyRequests: () => http("GET", "/requests/mine"),                                    // CHANGE
  getAllRequests: () => http("GET", "/admin/requests"),                                  // CHANGE
  getMyTasks: () => http("GET", "/volunteer/assignments"),                               // CHANGE
  getVolunteers: () => http("GET", "/admin/volunteers"),                                 // CHANGE
  assignVolunteer: (requestId, volunteerId) => http("POST", "/admin/assign", { requestId, volunteerId }),   // CHANGE
  updateStatus: (requestId, status) => http("PATCH", "/requests/" + requestId + "/status", { status }),    // CHANGE
  // Also CHANGE: make sure each request has the fields the pages use:
  // id, type, people, urgency, description, location, latitude, longitude, status
  // (unassigned / assigned / inprogress / resolved), createdAt, residentName, volunteerId, volunteerName
};

// Every page uses  api.something(...)
const api = USE_MOCK ? mockApi : realApi;
