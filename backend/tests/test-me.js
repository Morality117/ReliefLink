
const { getToken, api } = require("./test-helper");

(async () => {
  try {
    console.log("\n===== TESTING GET /api/me =====\n");

    const token = await getToken();

    const result = await api("/api/me", { token });

    console.log("HTTP Status:", result.status);
    console.log("Response:", JSON.stringify(result.body, null, 2));

    if (result.status !== 200 || !result.body.success) {
      throw new Error("Profile endpoint test failed");
    }

    console.log("\n[PASS] GET /api/me");

  } catch (error) {
    console.error("\n[FAIL]", error.message);
    process.exitCode = 1;
  }
})();
