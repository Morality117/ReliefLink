
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

async function testRequest() {
  try {
    // =====================================
    // 1. RESIDENT LOGIN
    // =====================================

    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_EMAIL,
      password: process.env.TEST_PASSWORD,
    });

    if (error) throw error;

    const token = data.session.access_token;

    console.log("Logged in user ID:", data.user.id);
    console.log("Login successful!");

    // =====================================
    // 2. CREATE REQUEST
    // =====================================

    const response = await fetch(`${BASE_URL}/api/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        category: "Food",
        description: "Test help request from API",
      }),
    });

    const result = await response.json();

    console.log("Create request:", response.status, result);

    if (response.status !== 201) {
      throw new Error("Request creation failed");
    }

    const requestId = result.data.id;

    console.log("Request created successfully!");
    console.log("Created Request ID:", requestId);

    // =====================================
    // 3. GET REQUEST DETAILS
    // =====================================

    const detailsResponse = await fetch(
      `${BASE_URL}/api/requests/${requestId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const detailsResult = await detailsResponse.json();

    console.log(
      "Request details:",
      detailsResponse.status,
      detailsResult
    );

    if (
      detailsResponse.status !== 200 ||
      detailsResult.data?.id !== requestId
    ) {
      throw new Error("Request details test failed");
    }

    console.log("Request details fetched successfully!");

    // =====================================
    // 4. GET MY REQUESTS
    // =====================================

    const myRequests = await fetch(
      `${BASE_URL}/api/requests/my`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const myResult = await myRequests.json();

    console.log("My requests:", myRequests.status, myResult);

    if (myRequests.status !== 200) {
      throw new Error("Failed to fetch my requests");
    }

    const foundRequest = myResult.data?.some(
      (request) => request.id === requestId
    );

    if (!foundRequest) {
      throw new Error("Created request not found in my requests");
    }

    console.log("My requests verification successful!");

    // =====================================
    // FINAL RESULT
    // =====================================

    console.log("\n=================================");
    console.log("ALL RESIDENT REQUEST TESTS PASSED");
    console.log("=================================");
    console.log("1. Resident Login: PASS");
    console.log("2. Create Request: PASS");
    console.log("3. Request Details: PASS");
    console.log("4. My Requests: PASS");
    console.log("=================================");

  } catch (error) {
    console.error("\nTEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    await supabase.auth.signOut();
  }
}

testRequest();
