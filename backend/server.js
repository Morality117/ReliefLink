require("dotenv").config();

const express = require("express");
const supabase = require("./supabase");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Nexconn credentials are loaded only on the backend.
// Never expose either value in frontend JavaScript or API responses.
const NEXCONN_APP_KEY = process.env.NEXCONN_APP_KEY;
const NEXCONN_APP_SECRET = process.env.NEXCONN_APP_SECRET;

if (!NEXCONN_APP_KEY || !NEXCONN_APP_SECRET) {
  throw new Error(
    "Missing Nexconn credentials. Add NEXCONN_APP_KEY and NEXCONN_APP_SECRET to the project-root .env file."
  );
}

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// Route imports — actual folder name is `route`.
const requestRoutes = require("./route/requestroutes");
const residentRoutes = require("./route/residentroutes");
const volunteerRoutes = require("./route/volunteerroutes");
const adminRoutes = require("./route/adminroutes");

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
    nexconnConfigured: Boolean(NEXCONN_APP_KEY && NEXCONN_APP_SECRET)
  });
});

// API routes.
app.use("/api/requests", requestRoutes);
app.use("/api/resident", residentRoutes);
app.use("/api/volunteer", volunteerRoutes);
app.use("/api/admin", adminRoutes);

// Keep 404 and error middleware LAST.
const {
  notFoundMiddleware,
  errorMiddleware
} = require("./middleware/error.middleware");

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const server = app.listen(PORT, () => {
  console.log(`Nexconn backend running at http://localhost:${PORT}`);
});

process.on("unhandledRejection", reason => {
  console.error("Unhandled promise rejection:", reason);
});

module.exports = { app, server, supabase };
