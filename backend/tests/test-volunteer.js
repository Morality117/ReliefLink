const { getToken, api } = require("./test-helper");
(async () => {
  try {
    const token = await getToken();
    const available = await api("/api/volunteer/requests/available", { token });
    const assignments = await api("/api/volunteer/assignments/my", { token });
    console.log("Available requests:", available.status, available.body);
    console.log("My assignments:", assignments.status, assignments.body);
    if (available.status !== 200 || assignments.status !== 200) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
})();
