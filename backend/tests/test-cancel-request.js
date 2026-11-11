
const { getToken, api } = require("./test-helper");

const API_PATH = "/api/requests";

(async () => {
  try {
    console.log("\n===== RESIDENT CANCELLATION TEST =====\n");

    // 1. Login
    const token = await getToken();

    console.log("Login successful");

    // 2. Fetch resident's requests
    const requestsResponse = await api(
      `${API_PATH}/my`,
      { token }
    );

    console.log(
      "My requests:",
      requestsResponse.status
    );

    if (requestsResponse.status !== 200) {
      throw new Error(
        "Could not fetch resident requests"
      );
    }

    const requests =
      requestsResponse.body.data;

    if (!Array.isArray(requests)) {
      throw new Error(
        "Unexpected response format. Check response.data structure."
      );
    }

    // 3. Find own Pending request
    const pendingRequest = requests.find(
      request => request.status === "Pending"
    );

    if (!pendingRequest) {
      console.log(
        "\nNo Pending request found."
      );

      console.log(
        "Create a new help request first, then rerun this test."
      );

      return;
    }

    console.log(
      "\nTesting cancellation for request:",
      pendingRequest.id
    );

    // 4. Cancel Pending request
    const cancelResponse = await api(
      `${API_PATH}/${pendingRequest.id}/status`,
      {
        token,
        method: "PATCH",
        body: {
          status: "Cancelled"
        }
      }
    );

    console.log(
      "\nCancellation response:",
      cancelResponse.status,
      cancelResponse.body
    );

    if (cancelResponse.status !== 200) {
      throw new Error(
        "Resident cancellation failed"
      );
    }

    // 5. Verify updated status
    const verifyResponse = await api(
      `${API_PATH}/my`,
      { token }
    );

    if (verifyResponse.status !== 200) {
      throw new Error(
        "Could not verify updated request"
      );
    }

    const updatedRequest =
      verifyResponse.body.data.find(
        request => request.id === pendingRequest.id
      );

    if (
      !updatedRequest ||
      updatedRequest.status !== "Cancelled"
    ) {
      throw new Error(
        "Request status was not updated to Cancelled"
      );
    }

    console.log(
      "\nSUCCESS: Resident cancelled own Pending request."
    );

    console.log(
      "Verified status:",
      updatedRequest.status
    );

    console.log(
      "\n===== TEST PASSED =====\n"
    );

  } catch (error) {
    console.error(
      "\n===== TEST FAILED ====="
    );

    console.error(error.message);

    process.exitCode = 1;
  }
})();
