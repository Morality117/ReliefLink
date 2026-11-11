const { getToken, api } = require("./test-helper");
(async () => {
  try {
    const token = await getToken();
    const result = await api("/api/resident/profile", { token });
    console.log("Profile:", result.status, result.body);
    if (result.status !== 200) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
})();
