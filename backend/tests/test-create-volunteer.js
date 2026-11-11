
const { getToken, api } = require("./test-helper");

(async () => {
  try {
    console.log("\n===== VOLUNTEER CREATION TEST =====\n");

    // Admin login
    const token = await getToken();

    console.log("Admin login successful");

    // Create volunteer
    const response = await api("/api/admin/volunteers", {
      token,
      method: "POST",
      body: {
        email: "newvolunteer@example.com",
        password: "Volunteer@12345",
        full_name: "Rahul Das",
        phone: "9876543210"
      }
    });

    console.log("Creation status:", response.status);
    console.log("Creation response:", response.body);

    if (response.status === 201) {
      console.log("\nSUCCESS: Volunteer created!");
    } else {
      console.log("\nFAILED: Volunteer creation unsuccessful");
    }

  } catch (error) {
    console.error("\nTEST ERROR:", error.message);
  }
})();
