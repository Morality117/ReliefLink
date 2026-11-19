const crypto = require("crypto");

const toNexconnUserId = (supabaseId) => {
  // Nexconn user IDs are mapped to alphanumeric IDs.
  return "rl" + String(supabaseId).replace(/-/g, "");
};

const fromNexconnUserId = (nexconnId) => {
  const raw = String(nexconnId || "").trim();
  if (!/^rl[0-9a-f]{32}$/i.test(raw)) return null;
  const h = raw.slice(2).toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const issueToken = async (user) => {
  const appKey = process.env.NEXCONN_APP_KEY;
  const appSecret = process.env.NEXCONN_APP_SECRET;

  if (!appKey || !appSecret) {
    const error = new Error("Nexconn credentials are missing");
    error.status = 503;
    throw error;
  }

  const primary = process.env.NEXCONN_PRIMARY_API_DOMAIN;
  const secondary = process.env.NEXCONN_SECONDARY_API_DOMAIN;

  const domains = [primary, secondary]
    .filter(Boolean)
    .map(domain =>
      domain.startsWith("http")
        ? domain.replace(/\/+$/, "")
        : `https://${domain}`
    );

  if (!domains.length) {
    const error = new Error("Nexconn API domains are missing");
    error.status = 503;
    throw error;
  }

  const nonce = crypto.randomBytes(9).toString("hex");
  const timestamp = Date.now().toString();

  const signature = crypto
    .createHash("sha1")
    .update(appSecret + nonce + timestamp)
    .digest("hex");

  const userId = toNexconnUserId(user.id);

  const payload = {
    userId,
    name: user.name || user.email || "ReliefLink User",
    avatarUrl: ""
  };

  let lastError;

  for (const domain of domains) {
    try {
      const response = await fetch(
        `${domain}/v4/auth/access-token/issue`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "App-Key": appKey,
            "Nonce": nonce,
            "Timestamp": timestamp,
            "Signature": signature
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000)
        }
      );

      const result = await response.json();

      if (!response.ok || result.code !== 0) {
        throw new Error(
          result.message || `Nexconn returned HTTP ${response.status}, code ${result.code}`
        );
      }

      if (!result.result?.accessToken) {
        throw new Error("Nexconn did not return an access token");
      }

      return {
        userId,
        token: result.result.accessToken,
        appKey
      };

    } catch (error) {
      lastError = error;
      console.error("Nexconn domain failed:", domain, error.message);
    }
  }

  const error = new Error(
    lastError?.message || "Unable to obtain Nexconn token"
  );
  error.status = 502;
  throw error;
};

module.exports = { issueToken, toNexconnUserId, fromNexconnUserId };
