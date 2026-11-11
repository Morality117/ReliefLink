const success = (res, data = null, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

const failure = (res, message = "Request failed", status = 400, details = undefined) =>
  res.status(status).json({ success: false, error: message, ...(details ? { details } : {}) });

module.exports = { success, failure };
