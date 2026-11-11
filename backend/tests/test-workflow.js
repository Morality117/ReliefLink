const { getToken, api } = require("./test-helper");
(async () => {
  try {
    const token = await getToken();
    const created = await api("/api/resident/requests", {
      token, method: "POST",
      body: {
        category: "Other",
        description: "Integration test request - safe to delete after testing"
      }
    });
    console.log("Create request:", created.status, created.body);
    if (created.status !== 201) process.exitCode = 1;
    else {
      const id = created.body?.data?.id;
      const fetched = await api(`/api/requests/${id}`, { token });
      console.log("Fetch created request:", fetched.status, fetched.body);
      if (fetched.status !== 200) process.exitCode = 1;
    }
  } catch (e) { console.error(e.message); process.exitCode = 1; }
})();
