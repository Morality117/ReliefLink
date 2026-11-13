
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { api } = require("./test-helper");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

const accounts = [
  {
    name: "Resident",
    email: process.env.RESIDENT_EMAIL,
    password: process.env.RESIDENT_PASSWORD,
    expectedRole: "resident"
  },
  {
    name: "Volunteer",
    email: process.env.VOLUNTEER_EMAIL,
    password: process.env.VOLUNTEER_PASSWORD,
    expectedRole: "volunteer"
  },
  {
    name: "Admin",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    expectedRole: "admin"
  }
];

(async () => {
  let passed = 0;
  let failed = 0;

  console.log("\n===== /api/me ROLE TEST =====");

  for (const account of accounts) {
    try {
      if (!account.email || !account.password) {
        throw new Error("Missing test credentials");
      }

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: account.email,
          password: account.password
        });

      if (error) throw error;

      const token = data.session?.access_token;

      if (!token) throw new Error("Access token missing");

      const result = await api("/api/me", { token });

      if (
        result.status !== 200 ||
        result.body?.data?.role !== account.expectedRole
      ) {
        throw new Error(
          `Expected ${account.expectedRole}, received ${
            result.body?.data?.role || "no role"
          } (HTTP ${result.status})`
        );
      }

      console.log(`[PASS] ${account.name}: ${account.expectedRole}`);
      passed++;

    } catch (error) {
      console.log(`[FAIL] ${account.name}: ${error.message}`);
      failed++;
    }
  }

  console.log("\n===== FINAL RESULTS =====");
  console.log("Passed:", passed);
  console.log("Failed:", failed);

  if (failed > 0) process.exitCode = 1;
})();
