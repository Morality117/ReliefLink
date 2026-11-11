
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

// =====================================
// CONFIGURATION
// =====================================

const baseUrl = (
  process.env.API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

// =====================================
// ENVIRONMENT VALIDATION
// =====================================

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is missing in .env");
}

if (!supabaseKey) {
  throw new Error("SUPABASE_PUBLISHABLE_KEY is missing in .env");
}

try {
  const parsedUrl = new URL(supabaseUrl);

  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname.endsWith(".supabase.co")
  ) {
    throw new Error();
  }
} catch {
  throw new Error(
    "Invalid SUPABASE_URL. Use your Supabase project URL."
  );
}

// =====================================
// SUPABASE CLIENT
// =====================================

const supabase = createClient(
  supabaseUrl.replace(/\/+$/, ""),
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

// =====================================
// GET AUTHENTICATION TOKEN
// =====================================

async function getToken(
  loginEmail = email,
  loginPassword = password
) {
  if (!loginEmail || !loginPassword) {
    throw new Error(
      "Test login credentials are missing in .env"
    );
  }

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword
    });

  if (error) {
    throw new Error(
      `Supabase login failed: ${error.message}`
    );
  }

  if (!data.user) {
    throw new Error(
      "Login succeeded but user information was not returned"
    );
  }

  // =====================================
  // DEBUG: AUTHENTICATED USER IDENTITY
  // =====================================

  console.log(
    "Logged-in user ID:",
    data.user.id
  );

  console.log(
    "Logged-in email:",
    data.user.email
  );

  if (!data.session?.access_token) {
    throw new Error(
      "Login succeeded but no access token was returned"
    );
  }

  return data.session.access_token;
}

// =====================================
// API REQUEST HELPER
// =====================================

async function api(
  path,
  {
    token,
    method = "GET",
    body
  } = {}
) {
  if (
    !path ||
    typeof path !== "string" ||
    !path.startsWith("/")
  ) {
    throw new Error("API path must start with /");
  }

  const url = `${baseUrl}${path}`;

  const headers = {
    Accept: "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {})
    });
  } catch (error) {
    throw new Error(
      `API request failed: ${error.message}`
    );
  }

  const responseText = await response.text();

  let payload;

  try {
    payload = responseText
      ? JSON.parse(responseText)
      : {};
  } catch {
    payload = {
      rawResponse: responseText
    };
  }

  return {
    status: response.status,
    body: payload
  };
}

// =====================================
// EXPORT FUNCTIONS
// =====================================

module.exports = {
  getToken,
  api
};
