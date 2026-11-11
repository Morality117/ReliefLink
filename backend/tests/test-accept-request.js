
const { getToken, api } = require("./test-helper");

(async () => {
  try {
    const token = await getToken();

    const requestId = "200cf501-34cb-4127-a69b-fb4d607bcabe";

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

    const assignments = await api(
      "/api/volunteer/assignments/my",
      { token }
    );

    console.log("Updated assignments:", assignments.status, assignments.body);

    if (assignments.status !== 200) {
      process.exitCode = 1;
    }

  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
})();
