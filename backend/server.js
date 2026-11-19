require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

const express = require("express");
const supabase = require("./supabase");
const cors = require("cors");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const authMiddleware = require("./middleware/auth.middleware");
const { success } = require("./utils/response");

// Nexconn credentials are loaded only on the backend.
// Never expose either value in frontend JavaScript or API responses.

app.disable("x-powered-by");

const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server requests with no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Allow Vercel preview/production subdomains if CORS_ORIGIN is not explicitly restricted
      if (process.env.ALLOW_VERCEL_ORIGINS === "true" && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "500kb" }));

// Route imports — actual folder name is `route`.
const requestRoutes = require("./route/requestroutes");
const residentRoutes = require("./route/residentroutes");
const volunteerRoutes = require("./route/volunteerroutes");
const adminRoutes = require("./route/adminroutes");
const chatRoutes = require("./route/chatroutes");

// Public health endpoints.
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Nexconn backend is running!"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "nexconn-backend",
    supabaseConfigured: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY
    ),
    nexconnConfigured: Boolean(
      process.env.NEXCONN_APP_KEY &&
      process.env.NEXCONN_APP_SECRET
    )
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "nexconn-backend",
    supabaseConfigured: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY
    ),
    nexconnConfigured: Boolean(
      process.env.NEXCONN_APP_KEY &&
      process.env.NEXCONN_APP_SECRET
    )
  });
});

// Authenticated current-user profile endpoint
app.get("/api/me", authMiddleware, async (req, res) => {
  const { fetchAvatarMap } = require("./utils/avatar");
  const adminDb = require("./services/admin.service").createAdminClient();
  const avatarMap = await fetchAvatarMap(adminDb, [req.user.id]);
  return success(
    res,
    {
      id: req.user.id,
      name: req.profile.full_name,
      email: req.user.email,
      role: req.profile.role,
      phone: req.profile.phone,
      avatar_url: avatarMap[req.user.id] || ""
    },
    "Profile fetched"
  );
});




// Ensure profile exists after OAuth login (e.g. Google sign-in)
app.post("/api/auth/ensure-profile", async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authentication token required" });
    }
    const token = header.slice(7).trim();
    const adminDb = require("./services/admin.service").createAdminClient();
    const { data: userData, error: userErr } = await adminDb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }

    const u = userData.user;
    const { data: existing } = await adminDb
      .from("profiles")
      .select("id, full_name, role, phone")
      .eq("id", u.id)
      .maybeSingle();

    if (existing) {
      return success(res, existing, "Profile verified");
    }

    const meta = u.user_metadata || {};
    const fullName = meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : "Citizen");
    const { data: created, error: createErr } = await adminDb
      .from("profiles")
      .upsert(
        {
          id: u.id,
          full_name: String(fullName).trim(),
          phone: meta.phone || "",
          role: "resident"
        },
        { onConflict: "id" }
      )
      .select("id, full_name, role, phone")
      .single();

    if (createErr) throw createErr;
    return success(res, created, "Profile created", 201);
  } catch (e) {
    next(e);
  }
});

// Delete authenticated user's own account (citizens & volunteers)
app.delete("/api/me", authMiddleware, async (req, res, next) => {
  try {
    if (req.profile.role === "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin accounts cannot be self-deleted"
      });
    }

    const userId = req.user.id;
    const adminDb = require("./services/admin.service").createAdminClient();

    if (req.profile.role === "resident") {
      const { data: myReqs } = await adminDb
        .from("help_requests")
        .select("id")
        .eq("resident_id", userId);
      const reqIds = (myReqs || []).map((r) => r.id);
      if (reqIds.length) {
        await adminDb.from("assignments").delete().in("request_id", reqIds);
        await adminDb.from("help_requests").delete().eq("resident_id", userId);
      }
    } else if (req.profile.role === "volunteer") {
      // Return any active assigned requests back to Pending so citizens are not stranded
      await adminDb
        .from("help_requests")
        .update({
          assigned_volunteer_id: null,
          status: "Pending",
          updated_at: new Date().toISOString()
        })
        .eq("assigned_volunteer_id", userId)
        .in("status", ["Assigned", "In Progress"]);

      await adminDb
        .from("help_requests")
        .update({ assigned_volunteer_id: null })
        .eq("assigned_volunteer_id", userId);

      await adminDb.from("assignments").delete().eq("volunteer_id", userId);
      await adminDb.from("volunteer_profiles").delete().eq("user_id", userId);
    }

    await adminDb.from("profiles").delete().eq("id", userId);

    const { error: authErr } = await adminDb.auth.admin.deleteUser(userId);
    if (authErr) throw authErr;

    return success(res, { deleted: true }, "Account deleted");
  } catch (e) {
    next(e);
  }
});

// Public volunteer application endpoint (no login required)
app.post("/api/volunteer-applications", async (req, res, next) => {
  try {
    const { full_name, email, phone, skills, message } = req.body || {};
    if (!full_name || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: "Full name, email, and phone number are required"
      });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "Invalid email address" });
    }
    const adminDb = require("./services/admin.service").createAdminClient();
    const { data, error } = await adminDb
      .from("volunteer_applications")
      .insert({
        full_name: String(full_name).trim().slice(0, 120),
        email: cleanEmail,
        phone: String(phone).trim().slice(0, 40),
        skills: Array.isArray(skills)
          ? skills.map((x) => String(x).trim()).filter(Boolean).slice(0, 15)
          : String(skills || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 15),
        message: String(message || "").trim().slice(0, 1500),
        status: "pending"
      })
      .select("*")
      .single();

    if (error) {
      console.error("Volunteer application insert error:", error);
      if (["42P01", "PGRST205", "PGRST204"].includes(error.code)) {
        return success(
          res,
          {
            stored: false,
            fallbackEmail: process.env.ADMIN_CONTACT_EMAIL || null
          },
          "Application table not yet configured"
        );
      }
      const err = new Error(error.message || "Could not save volunteer application");
      err.status = 400;
      throw err;
    }

    return success(res, { stored: true, application: data }, "Application submitted", 201);
  } catch (e) {
    next(e);
  }
});

// API routes.
app.use("/api/requests", requestRoutes);
app.use("/api/resident", residentRoutes);
app.use("/api/volunteer", volunteerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", chatRoutes);

// Keep 404 and error middleware LAST.
const {
  notFoundMiddleware,
  errorMiddleware
} = require("./middleware/error.middleware");

app.use(notFoundMiddleware);
app.use(errorMiddleware);

if (require.main === module && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`Nexconn backend running at http://localhost:${PORT}`);
  });
  module.exports = { app, server, supabase };
} else {
  module.exports = app;
  module.exports.app = app;
  module.exports.supabase = supabase;
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
