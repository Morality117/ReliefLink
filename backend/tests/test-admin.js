const { getToken, api } = require("./test-helper");

(async () => {
  try {
    const token = await getToken();

    const result = await api("/api/admin/requests", {
      token
    });

    console.log("Admin requests:", result.status, result.body);

    if (result.status === 200) {
      console.log("ADMIN AUTHORIZATION TEST PASSED");
    } else {
      console.log("ADMIN AUTHORIZATION TEST FAILED");
      process.exitCode = 1;
    }
  } catch (e) {
    console.error("Admin test error:", e.message);
    process.exitCode = 1;
  }
})();