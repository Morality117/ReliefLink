/* =====================================================================
   api.js: every page talks to the backend ONLY through this file.
   - USE_MOCK = true  -> fake backend in the browser (testing and demos)
   - USE_MOCK = false -> the real backend
   ===================================================================== */

const USE_MOCK = false;

// In local dev, talk to Express on port 3000.
// In production (Vercel), use same-origin /api routes unless window.RELIEFLINK_API_URL is set.
const API_URL =
  (typeof window !== "undefined" && window.RELIEFLINK_API_URL) ||
  ((typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1"))
    ? "http://localhost:3000"
    : "");

const SUPABASE_URL = "https://zlkwresbafygljemspxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n0LPwhTx5cv0v0PPrvZHmg_OfgJbEaz";

// Nexconn App Key fallback.
// Normally the backend sends this along with the chat token.
const NEXCONN_APP_KEY = "";


/* ---------- Pages ---------- */

const LOGIN_PAGE = "../LoginSignupPage/login.html";

const HOME_PAGE = {
  resident: "../Dashboards/citizen-dashboard.html",
  volunteer: "../Dashboards/volunteer-dashboard.html",
  admin: "../Dashboards/admin-dashboard.html",
};

function homeFor(role) {
  return HOME_PAGE[role] || LOGIN_PAGE;
}


/* ---------- Session ---------- */

const SESSION_KEY = "relieflink_session_v2";

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function logout() {
  localStorage.removeItem(SESSION_KEY);

  if (!USE_MOCK && window.supabase) {
    try {
      sb().auth.signOut();
    } catch (e) {}
  }
}

function requireRole(role) {
  const session = getSession();

  if (!session || !session.user || !HOME_PAGE[session.user.role]) {
    if (session) logout();
    window.location.href = LOGIN_PAGE;
    return null;
  }

  if (session.user.role !== role) {
    window.location.href = homeFor(session.user.role);
    return null;
  }

  const nameEl = document.querySelector("#user-name");
  if (nameEl) nameEl.textContent = session.user.name || session.user.email || "User";
  renderTopbarAvatar(session.user);

  const out = document.querySelector("#logout");
  if (out) out.addEventListener("click", () => logout());

  return session.user;
}


/* ---------- Helpers ---------- */

const CATEGORIES = ["Rescue", "Food", "Water", "Medical", "Other"];

const STATUSES = [
  "Pending",
  "Verified",
  "Assigned",
  "In Progress",
  "Resolved",
  "Cancelled",
];

function statusClass(status) {
  return String(status).toLowerCase().replace(/\s+/g, "");
}

function timeAgo(ms) {
  const min = Math.round((Date.now() - ms) / 60000);

  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";

  const hours = Math.round(min / 60);

  if (hours < 24) {
    return hours + (hours === 1 ? " hour ago" : " hours ago");
  }

  const days = Math.round(hours / 24);

  return days + (days === 1 ? " day ago" : " days ago");
}

function el(tag, className, text) {
  const e = document.createElement(tag);

  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;

  return e;
}



function renderTopbarAvatar(user) {
  const nameEl = document.querySelector("#user-name");
  if (!nameEl || !nameEl.parentElement) return;
  let av = document.querySelector("#topbar-avatar");
  if (!av) {
    av = document.createElement("span");
    av.id = "topbar-avatar";
    av.className = "topbar-avatar";
    nameEl.parentElement.insertBefore(av, nameEl);
  }
  av.innerHTML = "";
  if (user && user.avatarUrl) {
    const img = document.createElement("img");
    img.src = user.avatarUrl;
    img.alt = user.name || "Avatar";
    av.appendChild(img);
  } else {
    av.textContent = ((user && (user.name || user.email)) || "U").trim().charAt(0).toUpperCase();
  }
}

function resizeAvatarFile(file, size = 160) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      return reject(new Error("Please choose an image file (PNG, JPG, or WebP)."));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Google Maps ---------- */

const GOOGLE_MAPS_KEY = "AIzaSyCPhHPT-YfuZ_dMictykzl3FawpMv_-ASk";

let _mapsPromise = null;

function loadGoogleMaps() {
  if (_mapsPromise) return _mapsPromise;

  _mapsPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();

    window.__gmapsReady = () => resolve();

    window.gm_authFailure = () => {
      const box = document.querySelector("#map");

      if (box) {
        box.textContent =
          "Google Maps rejected the API key. Check the key, billing and referrer settings in Google Cloud.";
      }
    };

    const script = document.createElement("script");

    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(GOOGLE_MAPS_KEY) +
      "&callback=__gmapsReady&loading=async";

    script.onerror = () => {
      _mapsPromise = null;
      reject(new Error("Google Maps failed to load (check your internet)"));
    };

    document.head.appendChild(script);
  });

  return _mapsPromise;
}


/* =====================================================================
   MOCK BACKEND
   ===================================================================== */

const DB_KEY = "relieflink_mock_db_v2";

function seedDb() {
  const now = Date.now();

  return {
    users: [
      {
        id: "u-admin",
        name: "Admin",
        email: "admin@relieflink.test",
        password: "admin123",
        role: "admin",
        phone: "",
      },
      {
        id: "u-rahul",
        name: "Rahul Das",
        email: "volunteer@relieflink.test",
        password: "volunteer123",
        role: "volunteer",
        phone: "",
        available: true,
      },
      {
        id: "u-anita",
        name: "Anita Das",
        email: "anita@relieflink.test",
        password: "volunteer123",
        role: "volunteer",
        phone: "",
        available: true,
      },
      {
        id: "u-sen",
        name: "Rahul Sen",
        email: "citizen@relieflink.test",
        password: "citizen123",
        role: "resident",
        phone: "",
      },
      {
        id: "u-meera",
        name: "Meera Paul",
        email: "meera@relieflink.test",
        password: "citizen123",
        role: "resident",
        phone: "",
      },
    ],

    requests: [
      {
        id: "r1",
        category: "Rescue",
        description: "Water is rising, two elderly people upstairs\nPeople needing help: 5",
        latitude: 22.5726,
        longitude: 88.3639,
        status: "Pending",
        priority: null,
        residentId: "u-sen",
        createdAt: now - 10 * 60000,
      },
      {
        id: "r2",
        category: "Food",
        description: "No drinking water since morning",
        latitude: 22.5958,
        longitude: 88.3841,
        status: "Assigned",
        priority: null,
        residentId: "u-meera",
        createdAt: now - 60 * 60000,
      },
      {
        id: "r3",
        category: "Medical",
        description: "Need insulin and a check-up",
        latitude: 22.5448,
        longitude: 88.3426,
        status: "Verified",
        priority: null,
        residentId: "u-meera",
        createdAt: now - 3 * 3600000,
      },
      {
        id: "r4",
        category: "Other",
        description: "Home flooded, need a place to stay",
        latitude: 22.5300,
        longitude: 88.3500,
        status: "Resolved",
        priority: null,
        residentId: "u-sen",
        createdAt: now - 26 * 3600000,
      },
    ],

    assignments: [
      {
        id: "a1",
        requestId: "r2",
        volunteerId: "u-rahul",
        assignedAt: now - 50 * 60000,
      },
      {
        id: "a2",
        requestId: "r4",
        volunteerId: "u-rahul",
        assignedAt: now - 25 * 3600000,
      },
    ],
  };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const db = seedDb();
  saveDb(db);
  return db;
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    available: u.available !== false,
  };
}

function need(role) {
  const s = getSession();
  if (!s || !s.user || s.user.role !== role) {
    throw new Error("You do not have permission to access this resource");
  }
  return s.user;
}

function findRequest(db, id) {
  const r = db.requests.find((x) => x.id === id);
  if (!r) throw new Error("Request not found");
  return r;
}

function createAssignment(db, request, volunteerId) {
  db.assignments.push({
    id: "a" + Date.now(),
    requestId: request.id,
    volunteerId,
    assignedAt: Date.now(),
  });
  request.status = "Assigned";
}


const mockApi = {
  async login(email, password) {
    const db = loadDb();
    const u = db.users.find(
      (x) =>
        x.email.toLowerCase() === email.trim().toLowerCase() &&
        x.password === password
    );
    if (!u) throw new Error("Invalid login credentials");
    const user = publicUser(u);
    saveSession({ token: "mock-" + u.id, user });
    return user;
  },

  async signup(d) {
    const db = loadDb();
    if (
      db.users.some(
        (x) => x.email.toLowerCase() === d.email.trim().toLowerCase()
      )
    ) {
      throw new Error("User already registered");
    }
    const u = {
      id: "u-" + Date.now(),
      name: d.name.trim(),
      email: d.email.trim(),
      phone: d.phone,
      password: d.password,
      role: "resident",
    };
    db.users.push(u);
    saveDb(db);
    const user = publicUser(u);
    saveSession({ token: "mock-" + u.id, user });
    return user;
  },

  async deleteAccount() {
    const s = getSession();
    if (!s || !s.user) throw new Error("Not logged in");
    if (s.user.role === "admin") throw new Error("Admin accounts cannot be self-deleted");
    const db = loadDb();
    db.users = db.users.filter((u) => u.id !== s.user.id);
    db.requests = db.requests.filter((r) => r.residentId !== s.user.id);
    db.assignments = db.assignments.filter((a) => a.volunteerId !== s.user.id);
    saveDb(db);
    logout();
    return { deleted: true };
  },

  async resetPassword(email) {
    if (!email || !email.trim()) throw new Error("Enter your email address");
    return { sent: true, mock: true };
  },

  async loginWithGoogle() {
    throw new Error("Google sign-in is only available when connected to Supabase (USE_MOCK = false).");
  },

  async updatePassword(newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    return { updated: true, mock: true };
  },

  // ----- resident -----

  async createRequest(d) {
    const user = need("resident");
    const db = loadDb();
    const r = {
      id: "r" + Date.now(),
      category: d.category,
      description: d.description,
      latitude: d.latitude,
      longitude: d.longitude,
      status: "Pending",
      priority: null,
      residentId: user.id,
      createdAt: Date.now(),
    };
    db.requests.push(r);
    saveDb(db);
    return { ...r };
  },

  async getMyRequests() {
    const user = need("resident");
    const db = loadDb();
    return db.requests
      .filter((r) => r.residentId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => {
        const a = db.assignments.find((x) => x.requestId === r.id);
        const v = a ? db.users.find((u) => u.id === a.volunteerId) : null;
        return {
          ...r,
          volunteerId: a ? a.volunteerId : null,
          volunteerName: v ? v.name : null,
        };
      });
  },

  async cancelRequest(id) {
    const user = need("resident");
    const db = loadDb();
    const r = findRequest(db, id);
    if (r.residentId !== user.id || r.status !== "Pending") {
      throw new Error("Residents can only cancel their own Pending requests");
    }
    r.status = "Cancelled";
    saveDb(db);
    return { ...r };
  },

  // ----- volunteer -----

  async getAvailableRequests() {
    need("volunteer");
    const db = loadDb();
    return db.requests
      .filter((r) => r.status === "Pending")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => {
        const owner = db.users.find((u) => u.id === r.residentId);
        return {
          ...r,
          residentName: owner ? owner.name : "Citizen",
        };
      });
  },

  async acceptRequest(requestId) {
    const user = need("volunteer");
    const db = loadDb();
    const r = findRequest(db, requestId);
    if (r.status !== "Pending") {
      throw new Error("Only pending requests can be accepted");
    }
    createAssignment(db, r, user.id);
    saveDb(db);
    return { ...r };
  },

  async getMyTasks() {
    const user = need("volunteer");
    const db = loadDb();
    return db.assignments
      .filter((a) => a.volunteerId === user.id)
      .map((a) => {
        const req = findRequest(db, a.requestId);
        const owner = db.users.find((u) => u.id === req.residentId);
        return {
          ...req,
          assignmentId: a.id,
          residentName: owner ? owner.name : "Citizen",
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async updateTaskStatus(assignmentId, status) {
    const user = need("volunteer");
    const db = loadDb();
    if (status !== "In Progress" && status !== "Resolved") {
      throw new Error("Invalid volunteer status");
    }
    const a = db.assignments.find(
      (x) => x.id === assignmentId && x.volunteerId === user.id
    );
    if (!a) throw new Error("Assignment not found or not authorized");
    const r = findRequest(db, a.requestId);
    const allowed = {
      Assigned: ["In Progress", "Resolved"],
      "In Progress": ["Resolved"],
    };
    if (!(allowed[r.status] || []).includes(status)) {
      throw new Error(
        'Status change from "' + r.status + '" to "' + status + '" is not allowed'
      );
    }
    r.status = status;
    saveDb(db);
    return { ...r };
  },


  async getResidentProfile() {
    const user = need("resident");
    const db = loadDb();
    const u = db.users.find((x) => x.id === user.id) || user;
    const myReqs = db.requests.filter((r) => r.residentId === user.id);
    return {
      id: u.id,
      full_name: u.name,
      email: u.email,
      phone: u.phone || "",
      role: "resident",
      avatar_url: u.avatarUrl || "",
      stats: {
        total: myReqs.length,
        active: myReqs.filter((r) => !["Resolved", "Cancelled"].includes(r.status)).length,
        resolved: myReqs.filter((r) => r.status === "Resolved").length,
        cancelled: myReqs.filter((r) => r.status === "Cancelled").length,
      },
    };
  },

  async updateResidentProfile(d) {
    const user = need("resident");
    const db = loadDb();
    const u = db.users.find((x) => x.id === user.id);
    if (u) {
      if (d.full_name !== undefined) u.name = d.full_name.trim();
      if (d.phone !== undefined) u.phone = d.phone.trim();
      if (d.avatar_url !== undefined) u.avatarUrl = d.avatar_url || "";
      saveDb(db);
      const s = getSession();
      if (s && s.user) {
        s.user.name = u.name;
        s.user.avatarUrl = u.avatarUrl || "";
        saveSession(s);
        renderTopbarAvatar(s.user);
      }
    }
    return mockApi.getResidentProfile();
  },

  async getVolunteerProfile() {
    const user = need("volunteer");
    const db = loadDb();
    const u = db.users.find((x) => x.id === user.id) || user;
    const myAssigns = db.assignments.filter((a) => a.volunteerId === user.id);
    const myReqs = myAssigns.map((a) => db.requests.find((r) => r.id === a.requestId)).filter(Boolean);
    return {
      id: u.id,
      full_name: u.name,
      email: u.email,
      phone: u.phone || "",
      role: "volunteer",
      avatar_url: u.avatarUrl || "",
      skills: u.skills || ["First Aid", "Rescue"],
      available: u.available !== false,
      stats: {
        total: myReqs.length,
        active: myReqs.filter((r) => r.status === "Assigned" || r.status === "In Progress").length,
        resolved: myReqs.filter((r) => r.status === "Resolved").length,
      },
    };
  },

  async updateVolunteerProfile(d) {
    const user = need("volunteer");
    const db = loadDb();
    const u = db.users.find((x) => x.id === user.id);
    if (u) {
      if (d.full_name !== undefined) u.name = d.full_name.trim();
      if (d.phone !== undefined) u.phone = d.phone.trim();
      if (d.skills !== undefined) u.skills = d.skills;
      if (d.available !== undefined) u.available = Boolean(d.available);
      if (d.avatar_url !== undefined) u.avatarUrl = d.avatar_url || "";
      saveDb(db);
      const s = getSession();
      if (s && s.user) {
        s.user.name = u.name;
        s.user.avatarUrl = u.avatarUrl || "";
        saveSession(s);
        renderTopbarAvatar(s.user);
      }
    }
    return mockApi.getVolunteerProfile();
  },

  async submitVolunteerApplication(d) {
    const db = loadDb();
    db.applications = db.applications || [];
    const app = {
      id: "app-" + Date.now(),
      full_name: d.full_name.trim(),
      email: d.email.trim().toLowerCase(),
      phone: d.phone.trim(),
      skills: d.skills || [],
      message: d.message || "",
      status: "pending",
      created_at: new Date().toISOString(),
    };
    db.applications.unshift(app);
    saveDb(db);
    return { stored: true, application: app };
  },

  async getVolunteerApplications() {
    need("admin");
    const db = loadDb();
    return db.applications || [];
  },

  async updateVolunteerApplicationStatus(id, status) {
    need("admin");
    const db = loadDb();
    const app = (db.applications || []).find((a) => a.id === id);
    if (!app) throw new Error("Application not found");
    app.status = status;
    saveDb(db);
    return app;
  },

  // ----- chat -----

  async getChatToken() {
    throw new Error(
      "Chat needs the real backend. Set USE_MOCK = false in js/api.js."
    );
  },

  async getChatProfiles(userIds) {
    const db = loadDb();
    return (userIds || [])
      .map((id) => {
        const clean = String(id).replace(/^rl/, "");
        const u = db.users.find((x) => x.id === id || x.id.replace(/-/g, "") === clean);
        return u
          ? { userId: id, supabaseId: u.id, name: u.name, role: u.role, avatarUrl: "" }
          : null;
      })
      .filter(Boolean);
  },

  // ----- admin -----

  async getAllRequests() {
    need("admin");
    const db = loadDb();
    return [...db.requests]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => {
        const owner = db.users.find((u) => u.id === r.residentId);
        const a = db.assignments.find((x) => x.requestId === r.id);
        const vol = a ? db.users.find((u) => u.id === a.volunteerId) : null;
        return {
          ...r,
          residentName: owner ? owner.name : "Unknown",
          volunteerId: vol ? vol.id : null,
          volunteerName: vol ? vol.name : null,
        };
      });
  },

  async getVolunteers() {
    need("admin");
    const db = loadDb();
    return db.users
      .filter((u) => u.role === "volunteer")
      .map(publicUser);
  },

  async setRequestStatus(requestId, status) {
    need("admin");
    const db = loadDb();
    const r = findRequest(db, requestId);
    const allowed = {
      Pending: ["Verified", "Assigned", "In Progress", "Resolved", "Cancelled"],
      Verified: ["Assigned", "In Progress", "Resolved", "Cancelled"],
      Assigned: ["In Progress", "Resolved", "Cancelled"],
      "In Progress": ["Resolved", "Cancelled"],
      Resolved: ["Pending"],
    };
    if (!(allowed[r.status] || []).includes(status)) {
      throw new Error(
        'Status change from "' + r.status + '" to "' + status + '" is not allowed for admin'
      );
    }
    r.status = status;
    saveDb(db);
    return { ...r };
  },

  async assignVolunteer(requestId, volunteerId) {
    need("admin");
    const db = loadDb();
    const r = findRequest(db, requestId);
    if (
      !db.users.some((u) => u.id === volunteerId && u.role === "volunteer")
    ) {
      throw new Error("Volunteer not found");
    }
    if (!["Pending", "Verified"].includes(r.status)) {
      throw new Error("Request is not assignable");
    }
    createAssignment(db, r, volunteerId);
    saveDb(db);
    return { ...r };
  },

  async createVolunteer(d) {
    need("admin");
    const db = loadDb();
    if (!d.email || !d.password || !d.name || !d.phone) {
      throw new Error("Email, full name, phone and password are required");
    }
    if (d.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (
      db.users.some(
        (u) => u.email.toLowerCase() === d.email.trim().toLowerCase()
      )
    ) {
      throw new Error("A user with this email already exists");
    }
    const u = {
      id: "u-" + Date.now(),
      name: d.name.trim(),
      email: d.email.trim().toLowerCase(),
      phone: d.phone.trim(),
      password: d.password,
      role: "volunteer",
      available: true,
    };
    db.users.push(u);
    saveDb(db);
    return publicUser(u);
  },
};


/* =====================================================================
   REAL BACKEND
   ===================================================================== */

let _sb = null;

function sb() {
  if (!_sb) {
    if (!window.supabase) {
      throw new Error("The Supabase script didn't load (check your internet)");
    }
    _sb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );
  }
  return _sb;
}

async function http(method, path, body, _retried = false) {
  const { data } = await sb().auth.getSession();
  let token = data.session ? data.session.access_token : null;

  if (!token) {
    logout();
    window.location.href = LOGIN_PAGE;
    throw new Error("Please log in again");
  }

  let res;

  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error("Can't reach the server. Please check your connection.");
  }

  if (res.status === 401 && !_retried) {
    try {
      const { data: refreshed, error: refreshErr } = await sb().auth.refreshSession();
      if (!refreshErr && refreshed?.session?.access_token) {
        const existing = getSession();
        if (existing) {
          saveSession({ ...existing, token: refreshed.session.access_token });
        }
        return http(method, path, body, true);
      }
    } catch (e) {}
    logout();
    window.location.href = LOGIN_PAGE;
    throw new Error("Session expired. Please log in again.");
  }

  let json = null;
  try {
    json = await res.json();
  } catch (e) {}

  if (!res.ok || (json && json.success === false)) {
    throw new Error(
      (json && json.error) || "Request failed (" + res.status + ")"
    );
  }

  return json ? json.data : null;
}


/* ---------- Backend data conversion ---------- */

function toRequest(r) {
  return {
    id: r.id,
    category: r.category,
    description: r.description || "",
    latitude: r.latitude,
    longitude: r.longitude,
    status: r.status,
    priority: r.priority || null,
    residentId: r.resident_id,
    residentName:
      r.resident_name ||
      (r.resident && r.resident.name) ||
      null,
    volunteerId:
      (r.assigned_volunteer && r.assigned_volunteer.id) ||
      r.assigned_volunteer_id ||
      null,
    volunteerName:
      (r.assigned_volunteer && r.assigned_volunteer.name) ||
      r.volunteer_name ||
      null,
    createdAt: Date.parse(r.created_at) || Date.now(),
  };
}

async function loadProfile(userId) {
  try {
    const { data, error } = await sb()
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) return data;
  } catch (e) {}

  try {
    const me = await http("GET", "/api/me");
    if (me && me.role) {
      return {
        id: me.id,
        full_name: me.name,
        role: me.role,
      };
    }
  } catch (e) {}

  throw new Error("Your profile wasn't found. Ask an admin for help.");
}


/* ---------- REAL API ---------- */

const realApi = {
  async login(email, password) {
    const { data, error } = await sb().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      if (/confirm/i.test(error.message)) {
        throw new Error("Please confirm your email first. Check your inbox.");
      }
      throw new Error(error.message);
    }

    let profile;
    try {
      profile = await loadProfile(data.user.id);
    } catch (e) {
      await sb().auth.signOut();
      throw e;
    }

    let avatarUrl = "";
    try {
      const me = await fetch(API_URL + "/api/me", {
        headers: { Authorization: "Bearer " + data.session.access_token }
      }).then((r) => r.json());
      if (me && me.data && me.data.avatar_url) avatarUrl = me.data.avatar_url;
    } catch (e) {}

    const user = {
      id: profile.id,
      name: profile.full_name || data.user.email,
      email: data.user.email,
      role: profile.role,
      avatarUrl,
    };

    saveSession({
      token: data.session.access_token,
      user,
    });

    return user;
  },

  async signup(d) {
    const checkRes = await fetch(API_URL + "/api/auth/validate-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: d.email.trim() }),
    });
    const checkJson = await checkRes.json().catch(() => null);
    if (!checkRes.ok || (checkJson && checkJson.success === false)) {
      throw new Error((checkJson && checkJson.error) || "Please enter a valid email address.");
    }

    const { data, error } = await sb().auth.signUp({
      email: d.email.trim(),
      password: d.password,
      options: {
        data: {
          full_name: d.name.trim(),
          phone: d.phone,
        },
        emailRedirectTo: window.location.origin + "/LoginSignupPage/login.html",
      },
    });

    if (error) throw new Error(error.message);
    if (data?.user?.identities && data.user.identities.length === 0) {
      throw new Error("An account with this email already exists. Try logging in or using Continue with Google.");
    }
    if (!data.session) return null;
    return realApi.login(d.email, d.password);
  },

  async deleteAccount() {
    await http("DELETE", "/api/me");
    logout();
    return { deleted: true };
  },

  async resetPassword(email) {
    const clean = String(email || "").trim();
    if (!clean) throw new Error("Please enter your email address");
    const { error } = await sb().auth.resetPasswordForEmail(clean, {
      redirectTo: window.location.origin + "/LoginSignupPage/login.html",
    });
    if (error) throw new Error(error.message);
    return { sent: true };
  },

  async loginWithGoogle() {
    const { error } = await sb().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/LoginSignupPage/login.html",
      },
    });
    if (error) throw new Error(error.message);
  },

  async updatePassword(newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    const { error } = await sb().auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    await sb().auth.signOut();
    return { updated: true };
  },

  async completeOAuthSession(session) {
    if (!session || !session.user) return null;
    let profile = null;
    try {
      profile = await loadProfile(session.user.id);
    } catch (e) {
      const res = await fetch(API_URL + "/api/auth/ensure-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        throw new Error((json && json.error) || "Could not create profile for Google sign-in");
      }
      profile = json.data;
    }
    const meta = session.user.user_metadata || {};
    const user = {
      id: profile.id,
      name: profile.full_name || meta.full_name || meta.name || session.user.email,
      email: session.user.email,
      role: profile.role,
      avatarUrl: meta.avatar_url || meta.picture || "",
    };
    saveSession({ token: session.access_token, user });
    return user;
  },

  // ----- resident -----

  async createRequest(d) {
    return toRequest(
      await http("POST", "/api/requests", {
        category: d.category,
        description: d.description,
        latitude: d.latitude,
        longitude: d.longitude,
      })
    );
  },

  async getMyRequests() {
    return (await http("GET", "/api/requests/my")).map(toRequest);
  },

  async cancelRequest(id) {
    return toRequest(
      await http("PATCH", "/api/requests/" + id + "/status", {
        status: "Cancelled",
      })
    );
  },

  // ----- volunteer -----

  async getAvailableRequests() {
    return (await http("GET", "/api/volunteer/requests/available")).map(toRequest);
  },

  async acceptRequest(requestId) {
    const path = "/api/volunteer/requests/" + requestId + "/accept";
    try {
      return await http("POST", path);
    } catch (err) {
      if (
        /volunteer.*profile|profile.*(missing|not found|required)/i.test(
          err.message
        )
      ) {
        await http("POST", "/api/volunteer/profile", { skills: [] });
        return http("POST", path);
      }
      throw err;
    }
  },

  async getMyTasks() {
    const rows = await http("GET", "/api/volunteer/assignments/my");
    return rows
      .filter((a) => a.help_requests)
      .map((a) => ({
        ...toRequest(a.help_requests),
        assignmentId: a.id,
      }));
  },

  async updateTaskStatus(assignmentId, status) {
    return http(
      "PATCH",
      "/api/volunteer/assignments/" + assignmentId + "/status",
      { status }
    );
  },


  async getResidentProfile() {
    return http("GET", "/api/resident/profile");
  },

  async updateResidentProfile(d) {
    const updated = await http("PATCH", "/api/resident/profile", d);
    const s = getSession();
    if (s && s.user && updated) {
      s.user.name = updated.full_name || s.user.name;
      s.user.avatarUrl = updated.avatar_url || "";
      saveSession(s);
      renderTopbarAvatar(s.user);
    }
    return updated;
  },

  async getVolunteerProfile() {
    return http("GET", "/api/volunteer/profile");
  },

  async updateVolunteerProfile(d) {
    const updated = await http("PATCH", "/api/volunteer/profile", d);
    const s = getSession();
    if (s && s.user && updated) {
      s.user.name = updated.full_name || s.user.name;
      s.user.avatarUrl = updated.avatar_url || "";
      saveSession(s);
      renderTopbarAvatar(s.user);
    }
    return updated;
  },

  async submitVolunteerApplication(d) {
    let res;
    try {
      res = await fetch(API_URL + "/api/volunteer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
    } catch (e) {
      throw new Error("Can't reach the server. Please try again later.");
    }
    const json = await res.json().catch(() => null);
    if (!res.ok || (json && json.success === false)) {
      throw new Error((json && json.error) || "Could not submit application");
    }
    return json ? json.data : { stored: false };
  },

  async getVolunteerApplications() {
    return http("GET", "/api/admin/volunteer-applications");
  },

  async updateVolunteerApplicationStatus(id, status) {
    return http("PATCH", "/api/admin/volunteer-applications/" + id, { status });
  },

  // ----- chat -----

  async getChatToken(requestId, partnerId) {
    return http("POST", "/api/token", {
      ...(requestId ? { requestId } : {}),
      ...(partnerId ? { partnerId } : {}),
    });
  },

  async getChatProfiles(userIds) {
    const res = await http("POST", "/api/chat/profiles", { userIds });
    return (res && res.profiles) || [];
  },

  // ----- admin -----

  async getAllRequests() {
    const [rows, users] = await Promise.all([
      http("GET", "/api/admin/requests"),
      http("GET", "/api/admin/users"),
    ]);

    const names = {};
    users.forEach((u) => {
      names[u.id] = u.full_name;
    });

    return rows.map((r) => {
      const converted = toRequest(r);
      return {
        ...converted,
        residentName: converted.residentName || names[r.resident_id] || "Unknown",
        volunteerName:
          converted.volunteerName ||
          (converted.volunteerId ? names[converted.volunteerId] : null) ||
          null,
      };
    });
  },

  async getVolunteers() {
    const users = await http("GET", "/api/admin/users");
    return users
      .filter((u) => u.role === "volunteer")
      .map((u) => ({
        id: u.id,
        name: u.full_name,
        email: u.email || "",
        available: u.available !== false,
      }));
  },

  async setRequestStatus(requestId, status) {
    return http("PATCH", "/api/admin/requests/" + requestId + "/status", {
      status,
    });
  },

  async assignVolunteer(requestId, volunteerId) {
    return http("POST", "/api/admin/requests/" + requestId + "/assign", {
      volunteerId,
    });
  },

  async createVolunteer(d) {
    const v = await http("POST", "/api/admin/volunteers", {
      email: d.email,
      password: d.password,
      full_name: d.name,
      phone: d.phone,
    });
    return {
      id: v.id,
      name: v.full_name,
      email: v.email,
      available: v.available !== false,
    };
  },
};


/* ---------- Export API ---------- */

const api = USE_MOCK ? mockApi : realApi;
