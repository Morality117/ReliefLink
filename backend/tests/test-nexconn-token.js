
require("dotenv").config();
const axios = require("axios");

const BASE_URL = process.env.NEXCONN_BACKEND_URL || "http://localhost:3000";

async function testNexconnToken() {
  try {
    console.log("\n===== NEXCONN TOKEN TEST =====\n");

    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
      throw new Error("TEST_EMAIL or TEST_PASSWORD missing in .env");
    }

    // Step 1: Supabase login
    const { createClient } = require("@supabase/supabase-js");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const accessToken = data.session.access_token;

    console.log("[PASS] Supabase login");

    // Step 2: Request Nexconn token from backend
    const response = await axios.post(
      `${BASE_URL}/api/token`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        timeout: 15000
      }
    );

    console.log("[PASS] Nexconn token endpoint");
    console.log("Response:", {
      success: response.data.success,
      message: response.data.message,
      hasToken: Boolean(
        response.data.data?.result?.accessToken ||
        response.data.data?.accessToken
      )
    });

    const token =
      response.data.data?.result?.accessToken ||
      response.data.data?.accessToken;

    if (!token) {
      throw new Error("Nexconn access token missing in response");
    }

    console.log("\n[SUCCESS] Nexconn token issued!");

  } catch (error) {
    console.error("\n[FAILED]", error.response?.data || error.message);
    process.exitCode = 1;
  }
}

testNexconnToken();
