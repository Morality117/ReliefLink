/*
 * No notifications table was included in the supplied database schema.
 * This service is deliberately a safe integration hook: it logs events now
 * and can later be connected to email/push/ a notifications table.
 */
const notify = async ({ userId, type, message, metadata = {} }) => {
  console.info("[NEXCONN_NOTIFICATION]", JSON.stringify({
    userId, type, message, metadata, createdAt: new Date().toISOString()
  }));
  return { delivered: false, queued: false, reason: "Notification provider not configured" };
};

module.exports = { notify };
