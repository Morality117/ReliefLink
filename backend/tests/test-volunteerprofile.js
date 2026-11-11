
const { getToken, api } = require("./test-helper");

(async () => {
  try {
    const token = await getToken();

    const result = await api("/api/volunteer/profile", {
      method: "POST",
      token,
      body: {
        skills: ["Rescue", "Medical", "Food"]
      }
    });

    console.log(
      "Create volunteer profile:",
      result.status,
      result.body
    );

    if (result.status !== 201) {
      process.exitCode = 1;
    }

  } catch (e) {
    console.error("Volunteer profile test failed:", e.message);
    process.exitCode = 1;
  }
})();
