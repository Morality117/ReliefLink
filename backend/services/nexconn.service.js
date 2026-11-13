
const {
  Configuration,
  UserManagementApi
} = require("@nexconn/server-sdk");

let userManagementApi = null;

const getNexconnClient = () => {
  if (userManagementApi) {
    return userManagementApi;
  }

  const appKey = process.env.NEXCONN_APP_KEY;
  const appSecret = process.env.NEXCONN_APP_SECRET;

  const primaryDomain = process.env.NEXCONN_PRIMARY_API_DOMAIN;
  const secondaryDomain = process.env.NEXCONN_SECONDARY_API_DOMAIN;

  if (!appKey || !appSecret) {
    throw new Error("Nexconn credentials are not configured");
  }

  if (!primaryDomain || !secondaryDomain) {
    const error = new Error(
      "Nexconn API domains are not configured"
    );
    error.statusCode = 503;
    throw error;
  }

  const configuration = new Configuration();

  // Configure Nexconn application credentials
  configuration.setNexconnCredentials(
    appKey,
    appSecret
  );

  // Configure primary and backup API domains
  configuration.setPrimaryBackupDomains(
    primaryDomain,
    secondaryDomain
  );

  // Initialize Nexconn User Management API
  userManagementApi = new UserManagementApi(configuration);

  return userManagementApi;
};


const issueChatAccessToken = async ({
  userId,
  name,
  avatarUrl
}) => {
  try {
    // Validate authenticated user
    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!name) {
      throw new Error("User name is required");
    }

    // Initialize Nexconn SDK
    const nexconnClient = getNexconnClient();

    // Prepare token request
    const tokenRequest = {
      userId: String(userId),
      name: String(name)
    };

    // Avatar is optional
    if (avatarUrl) {
      tokenRequest.avatarUrl = avatarUrl;
    }

    // Issue access token through official Nexconn SDK
    const { data } = await nexconnClient.issueAccessToken(
      tokenRequest
    );

    // Validate SDK response
    if (!data?.result?.accessToken) {
      throw new Error(
        "Nexconn did not return a valid access token"
      );
    }

    console.log(
      "Nexconn chat access token issued successfully"
    );

    return data;

  } catch (error) {
    console.error(
      "Nexconn service error:",
      error.message
    );

    throw error;
  }
};


// Export service functions
module.exports = {
  issueChatAccessToken
};
