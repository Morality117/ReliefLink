const { getToken, api } = require("./test-helper");
(async () => {
  try {
    const token = await getToken();
    const list = await api("/api/resident/requests", { token });
    console.log("Resident requests:", list.status, list.body);
    if (list.status !== 200) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
})();
