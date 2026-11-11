
require("dotenv").config();

const { getToken, api } = require("./test-helper");

// =====================================
// CONFIGURATION
// =====================================

const residentEmail =
  process.env.RESIDENT_EMAIL || process.env.TEST_EMAIL;

const residentPassword =
  process.env.RESIDENT_PASSWORD || process.env.TEST_PASSWORD;

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

const volunteerEmail = process.env.VOLUNTEER_EMAIL;
const volunteerPassword = process.env.VOLUNTEER_PASSWORD;

// =====================================
// HELPERS
// =====================================

const assertStatus = (result, expected, step) => {
  if (result.status !== expected) {
    throw new Error(
      `${step} failed. Expected ${expected}, got ${result.status}. Response: ${JSON.stringify(result.body)}`
    );
  }

  console.log(`[PASS] ${step}`);
};

const getData = (body) => body?.data;

const getList = (body, possibleKeys = []) => {
  const data = getData(body);

  if (Array.isArray(data)) {
    return data;
  }

  for (const key of possibleKeys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
};

const findAssignment = (body, requestId) => {
  const assignments = getList(body, [
    "assignments"
  ]);

  return assignments.find(
    item => item.request_id === requestId
  );
};

// =====================================
// MASTER E2E TEST
// =====================================

async function runEndToEndTest() {

  console.log("\n========================================");
  console.log("       NEXCONN MASTER E2E TEST");
  console.log("========================================\n");

  // =====================================
  // CHECK ENVIRONMENT VARIABLES
  // =====================================

  const required = {
    RESIDENT_EMAIL: residentEmail,
    RESIDENT_PASSWORD: residentPassword,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    VOLUNTEER_EMAIL: volunteerEmail,
    VOLUNTEER_PASSWORD: volunteerPassword
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing .env variable: ${key}`);
    }
  }

  // =====================================
  // STEP 1: RESIDENT LOGIN
  // =====================================

  console.log("\n--- STEP 1: RESIDENT ---");

  const residentToken = await getToken(
    residentEmail,
    residentPassword
  );

  if (!residentToken) {
    throw new Error("Resident login failed");
  }

  console.log("[PASS] Resident login");

  // =====================================
  // STEP 2: RESIDENT CREATES REQUEST
  // =====================================

  const createResponse = await api(
    "/api/requests",
    {
      method: "POST",
      token: residentToken,
      body: {
        category: "Food",
        description: `Nexconn E2E test ${Date.now()}`
      }
    }
  );

  assertStatus(
    createResponse,
    201,
    "Resident creates request"
  );

  const request = getData(createResponse.body);

  if (!request?.id) {
    throw new Error("Request ID missing from response");
  }

  const requestId = request.id;

  console.log("Request ID:", requestId);

  // =====================================
  // STEP 3: ADMIN LOGIN
  // =====================================

  console.log("\n--- STEP 2: ADMIN ---");

  const adminToken = await getToken(
    adminEmail,
    adminPassword
  );

  if (!adminToken) {
    throw new Error("Admin login failed");
  }

  console.log("[PASS] Admin login");

  // =====================================
  // STEP 4: ADMIN FETCHES REQUESTS
  // =====================================

  const adminRequests = await api(
    "/api/admin/requests",
    {
      token: adminToken
    }
  );

  assertStatus(
    adminRequests,
    200,
    "Admin fetches requests"
  );

  const adminRequestList = getList(
    adminRequests.body,
    ["requests"]
  );

  const adminFound = adminRequestList.some(
    item => item.id === requestId
  );

  if (!adminFound) {
    throw new Error(
      "Admin cannot find newly created request"
    );
  }

  console.log("[PASS] Admin sees resident request");

  // =====================================
  // STEP 5: ADMIN VERIFIES REQUEST
  // =====================================

  const verifyResponse = await api(
    `/api/admin/requests/${requestId}/status`,
    {
      method: "PATCH",
      token: adminToken,
      body: {
        status: "Verified"
      }
    }
  );

  assertStatus(
    verifyResponse,
    200,
    "Admin verifies request"
  );

  // =====================================
  // STEP 6: ADMIN FETCHES USERS
  // =====================================

  console.log("\n--- STEP 3: VOLUNTEER LOOKUP ---");

  const usersResponse = await api(
    "/api/admin/users",
    {
      token: adminToken
    }
  );

  assertStatus(
    usersResponse,
    200,
    "Admin fetches users"
  );

  const users = getList(
    usersResponse.body,
    ["users", "profiles"]
  );

  console.log("Users returned:", users.length);

  if (users.length === 0) {
    throw new Error(
      "Admin users API returned no users"
    );
  }

  // =====================================
  // STEP 7: FIND VOLUNTEER BY EMAIL
  // =====================================

  const volunteer = users.find(user => {
    const email = user.email || user.user_email;

    return (
      email &&
      email.toLowerCase() === volunteerEmail.toLowerCase()
    );
  });

  if (!volunteer) {

    console.log("\nAvailable users:");

    users.forEach(user => {
      console.log({
        id: user.id || user.user_id,
        email: user.email || user.user_email,
        full_name: user.full_name,
        role: user.role
      });
    });

    throw new Error(
      "Volunteer not found. Check VOLUNTEER_EMAIL in .env"
    );
  }

  if (volunteer.role !== "volunteer") {
    throw new Error(
      `Matched account has incorrect role: ${volunteer.role}`
    );
  }

  const volunteerId = volunteer.id || volunteer.user_id;

  if (!volunteerId) {
    throw new Error("Volunteer ID missing");
  }

  console.log("[PASS] Volunteer account found");
  console.log("Volunteer ID:", volunteerId);
  console.log("Volunteer Name:", volunteer.full_name);

  // =====================================
  // STEP 8: ADMIN ASSIGNS VOLUNTEER
  // =====================================

  console.log("\n--- ADMIN ASSIGNMENT ---");

  const assignResponse = await api(
    `/api/admin/requests/${requestId}/assign`,
    {
      method: "POST",
      token: adminToken,
      body: {
        volunteerId
      }
    }
  );

  // IMPORTANT:
  // Assignment creation returns HTTP 201,
  // not HTTP 200.

  assertStatus(
    assignResponse,
    201,
    "Admin assigns volunteer"
  );

  const assignmentData = getData(assignResponse.body);

  if (!assignmentData?.id) {
    throw new Error(
      "Assignment ID missing from admin response"
    );
  }

  const assignmentId = assignmentData.id;

  if (assignmentData.request_id !== requestId) {
    throw new Error(
      "Assignment request ID does not match"
    );
  }

  if (assignmentData.volunteer_id !== volunteerId) {
    throw new Error(
      "Assignment volunteer ID does not match"
    );
  }

  console.log("[PASS] Assignment created successfully");
  console.log("Assignment ID:", assignmentId);

  // =====================================
  // STEP 9: VOLUNTEER LOGIN
  // =====================================

  console.log("\n--- STEP 4: VOLUNTEER ---");

  const volunteerToken = await getToken(
    volunteerEmail,
    volunteerPassword
  );

  if (!volunteerToken) {
    throw new Error("Volunteer login failed");
  }

  console.log("[PASS] Volunteer login");

  // =====================================
  // STEP 10: VOLUNTEER FETCHES ASSIGNMENTS
  // =====================================

  const assignmentResponse = await api(
    "/api/volunteer/assignments/my",
    {
      token: volunteerToken
    }
  );

  assertStatus(
    assignmentResponse,
    200,
    "Volunteer fetches assignments"
  );

  const assignment = findAssignment(
    assignmentResponse.body,
    requestId
  );

  if (!assignment?.id) {
    throw new Error(
      "Newly assigned request not found in volunteer assignments"
    );
  }

  if (assignment.id !== assignmentId) {
    throw new Error(
      "Volunteer assignment ID does not match admin assignment"
    );
  }

  console.log(
    "[PASS] Volunteer receives correct assignment"
  );

  // =====================================
  // STEP 11: VOLUNTEER UPDATES IN PROGRESS
  // =====================================

  const progressResponse = await api(
    `/api/volunteer/assignments/${assignmentId}/status`,
    {
      method: "PATCH",
      token: volunteerToken,
      body: {
        status: "In Progress"
      }
    }
  );

  assertStatus(
    progressResponse,
    200,
    "Volunteer updates status to In Progress"
  );

  // =====================================
  // STEP 12: VOLUNTEER RESOLVES REQUEST
  // =====================================

  const resolveResponse = await api(
    `/api/volunteer/assignments/${assignmentId}/status`,
    {
      method: "PATCH",
      token: volunteerToken,
      body: {
        status: "Resolved"
      }
    }
  );

  assertStatus(
    resolveResponse,
    200,
    "Volunteer resolves request"
  );

  // =====================================
  // STEP 13: RESIDENT FINAL VERIFICATION
  // =====================================

  console.log(
    "\n--- STEP 5: FINAL RESIDENT VERIFICATION ---"
  );

  const residentRequests = await api(
    "/api/requests/my",
    {
      token: residentToken
    }
  );

  assertStatus(
    residentRequests,
    200,
    "Resident fetches own requests"
  );

  const residentList = getList(
    residentRequests.body,
    ["requests"]
  );

  const finalRequest = residentList.find(
    item => item.id === requestId
  );

  if (!finalRequest) {
    throw new Error(
      "Resident cannot find completed request"
    );
  }

  if (finalRequest.status !== "Resolved") {
    throw new Error(
      `Final status mismatch. Expected Resolved, got ${finalRequest.status}`
    );
  }

  console.log(
    "[PASS] Resident sees final Resolved status"
  );

  // =====================================
  // FINAL RESULT
  // =====================================

  console.log("\n========================================");
  console.log("       NEXCONN E2E TEST PASSED");
  console.log("========================================");

  console.log("\nFINAL TEST DETAILS:");

  console.log("Request ID:", requestId);
  console.log("Volunteer ID:", volunteerId);
  console.log("Assignment ID:", assignmentId);
  console.log("Final Status:", finalRequest.status);

  console.log(
    "\nALL WORKFLOW STEPS COMPLETED SUCCESSFULLY!"
  );

  console.log(
    "\nRESIDENT -> ADMIN -> VOLUNTEER -> RESIDENT"
  );
}

// =====================================
// EXECUTION
// =====================================

runEndToEndTest().catch(error => {

  console.error("\n========================================");
  console.error("       NEXCONN E2E TEST FAILED");
  console.error("========================================");

  console.error("\nERROR:", error.message);

  process.exitCode = 1;
});
