
require("dotenv").config();

const { getToken, api } = require("./test-helper");

(async () => {
  try {
    // Login using VOLUNTEER credentials
    const token = await getToken(
      process.env.VOLUNTEER_EMAIL,
      process.env.VOLUNTEER_PASSWORD
    );

    // Verify role
    const me = await api("/api/me", { token });

    console.log("User role:", me.body?.data?.role);

    if (
      me.status !== 200 ||
      me.body?.data?.role !== "volunteer"
    ) {
      throw new Error("Volunteer authentication failed");
    }

    const requestId = "6013222a-f133-478c-a611-00290259b127";

    // Accept request
    const result = await api(
      `/api/volunteer/requests/${requestId}/accept`,
      {
        token,
        method: "POST"
      }
    );

    console.log("Accept request:", result.status, result.body);

    if (result.status !== 201) {
      process.exitCode = 1;
      return;
    }

    // Check assignments
    const assignments = await api(
      "/api/volunteer/assignments/my",
      { token }
    );

    console.log("Updated assignments:", assignments.status, assignments.body);

    if (assignments.status !== 200) {
      process.exitCode = 1;
      return;
    }

    console.log("[PASS] Volunteer acceptance workflow completed!");

  } catch (error) {
    console.error("[FAIL]", error.message);
    process.exitCode = 1;
  }
})();
