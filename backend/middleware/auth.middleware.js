const { createClient } = require("@supabase/supabase-js");
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Check Authorization header
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Authentication token required"
      });
    }
    const token = header.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication token required"
      });
    }

    // 2. Check Supabase configuration
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      console.error("Supabase configuration missing");

      return res.status(500).json({
        success: false,
        error: "Supabase configuration is missing"
      });
    }

    // 3. Create request-scoped Supabase client
    const userClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // 4. Verify access token
    const { data, error } = await userClient.auth.getUser(token);

    if (error || !data?.user) {
      console.error("Authentication verification failed:", error?.message);

      return res.status(401).json({
        success: false,
        error: "Invalid or expired authentication token"
      });
    }

    // 5. Fetch authenticated user's profile
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("id, full_name, role, phone")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile verification failed:", profileError.message);

      return res.status(403).json({
        success: false,
        error: "Could not verify user profile or role"
      });
    }

    if (!profile) {
      return res.status(403).json({
        success: false,
        error: "User profile not found"
      });
    }
    console.log("\n===== AUTH PROFILE DEBUG =====");
    console.log("Authenticated ID:", data.user.id);
    console.log("Fetched Profile:", profile);
    console.log("==============================\n");

    // 6. Attach authenticated user and profile
    req.user = data.user;
    req.profile = profile;
    req.userSupabase = userClient;
    req.accessToken = token;

    // 7. Continue
    return next();

  } catch (error) {
    console.error("Authentication middleware error:", error.message);
    return next(error);
  }
};

module.exports = authMiddleware;
