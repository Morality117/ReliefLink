
const { getToken, api } = require("./test-helper");

(async () => {
  try {
    const token = await getToken();

    const result = await api("/api/admin/users", {
      token
    });

    console.log("Admin users:", result.status, result.body);

    if (result.status === 200) {
      console.log("ADMIN USERS TEST PASSED");
    } else {
      console.log("ADMIN USERS TEST FAILED");
      process.exitCode = 1;
    }
  } catch (e) {
    console.error("Admin users test error:", e.message);
    process.exitCode = 1;
  }
})();
