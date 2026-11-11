
const { getToken, api } = require("./test-helper");

(async () => {
  try {
    const token = await getToken();

    const assignmentId = "02715915-b9a3-4044-a1de-bb62fd689d3f";

    // STEP 1: Update volunteer assignment status
    const result = await api(
      `/api/volunteer/assignments/${assignmentId}/status`,
      {
        token,
        method: "PATCH",
        body: {
          status: "In Progress"
        }
      }
    );

    console.log("Update status:", result.status, result.body);

    if (result.status !== 200) {
      console.log("STATUS UPDATE FAILED");
      process.exitCode = 1;
      return;
    }

    // STEP 2: Verify status from PATCH response
    const updatedStatus = result.body?.data?.status;

    console.log("Verified status:", updatedStatus);

    if (updatedStatus === "In Progress") {
      console.log("VOLUNTEER STATUS TEST PASSED");
    } else {
      console.log("STATUS VERIFICATION FAILED");
      process.exitCode = 1;
    }

  } catch (e) {
    console.error("Test error:", e.message);
    process.exitCode = 1;
  }
})();
