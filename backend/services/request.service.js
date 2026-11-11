
const {
  validateCreateRequest,
  validateStatus,
  isUuid
} = require("../utils/validators");

const { notify } = require("./notification.service");

// =====================================
// DATABASE ERROR HANDLER
// =====================================

const dbError = (error, fallback) => {
  const err = new Error(error?.message || fallback);
  err.status = 400;
  throw err;
};

// =====================================
// CREATE REQUEST
// RESIDENT
// =====================================

const createRequest = async (db, residentId, body) => {
  const errors = validateCreateRequest(body || {});

  if (errors.length) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }

  const payload = {
    resident_id: residentId,
    category: body.category,
    description: body.description.trim(),
    latitude:
      body.latitude === undefined
        ? null
        : Number(body.latitude),
    longitude:
      body.longitude === undefined
        ? null
        : Number(body.longitude)
  };

  const { data, error } = await db
    .from("help_requests")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    dbError(error, "Could not create request");
  }

  await notify({
    userId: residentId,
    type: "request_created",
    message: "Your help request has been submitted",
    metadata: {
      requestId: data.id
    }
  });

  return data;
};

// =====================================
// GET RESIDENT REQUESTS
// RESIDENT
// =====================================

const getResidentRequests = async (db, residentId) => {
  const { data, error } = await db
    .from("help_requests")
    .select("*")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });

  if (error) {
    dbError(error, "Could not fetch your requests");
  }

  return data || [];
};

// =====================================
// GET REQUEST BY ID
// =====================================

const getRequestById = async (db, requestId) => {
  if (!isUuid(requestId)) {
    const err = new Error("Invalid request ID");
    err.status = 400;
    throw err;
  }

  const { data, error } = await db
    .from("help_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    dbError(error, "Could not fetch request");
  }

  if (!data) {
    const err = new Error("Request not found");
    err.status = 404;
    throw err;
  }

  return data;
};

// =====================================
// GET AVAILABLE REQUESTS
// VOLUNTEER
// =====================================

const getAvailableRequests = async (db) => {
  const { data, error } = await db
    .from("help_requests")
    .select("*")
    .eq("status", "Pending")
    .order("created_at", { ascending: true });

  if (error) {
    dbError(error, "Could not fetch pending requests");
  }

  return data || [];
};

// =====================================
// UPDATE REQUEST STATUS
// RESIDENT / VOLUNTEER / ADMIN
// =====================================

const updateRequestStatus = async (
  db,
  requestId,
  status,
  actor
) => {

  // 1. Validate request ID

  if (!isUuid(requestId)) {
    const err = new Error("Invalid request ID");
    err.status = 400;
    throw err;
  }

  // 2. Validate requested status

  if (!validateStatus(status)) {
    const err = new Error("Invalid request status");
    err.status = 400;
    throw err;
  }

  // 3. Validate authenticated user

  if (!actor || !actor.id || !actor.role) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  // 4. Fetch existing request

  const current = await getRequestById(db, requestId);

  // =====================================
  // RESIDENT OWNERSHIP CHECK
  // =====================================

  if (actor.role === "resident") {

    // Resident can only access own request

    if (current.resident_id !== actor.id) {
      const err = new Error(
        "You can only cancel your own requests"
      );

      err.status = 403;
      throw err;
    }

    // Resident can only cancel Pending requests

    if (
      current.status !== "Pending" ||
      status !== "Cancelled"
    ) {
      const err = new Error(
        "Residents can only cancel their own Pending requests"
      );

      err.status = 403;
      throw err;
    }
  }

  // =====================================
  // ROLE-BASED STATUS TRANSITIONS
  // =====================================

  const allowed = {

    resident: {
      Pending: ["Cancelled"],
      Verified: [],
      Assigned: [],
      "In Progress": [],
      Resolved: [],
      Cancelled: []
    },

    volunteer: {
      Pending: ["In Progress", "Resolved"],
      Verified: ["In Progress", "Resolved"],
      Assigned: ["In Progress", "Resolved"],
      "In Progress": ["Resolved"],
      Resolved: [],
      Cancelled: []
    },

    admin: {
      Pending: [
        "Verified",
        "Assigned",
        "In Progress",
        "Resolved"
      ],

      Verified: [
        "Assigned",
        "In Progress",
        "Resolved"
      ],

      Assigned: [
        "In Progress",
        "Resolved"
      ],

      "In Progress": ["Resolved"],
      Resolved: ["Pending"],
      Cancelled: []
    }
  };

  const permittedTransitions =
    allowed[actor.role]?.[current.status] || [];

  if (!permittedTransitions.includes(status)) {
    const err = new Error(
      `Status transition from "${current.status}" to "${status}" is not allowed for ${actor.role}`
    );

    err.status = 403;
    throw err;
  }

  // =====================================
  // UPDATE REQUEST
  // PRESERVE SUPABASE RLS
  // =====================================

  let updateQuery = db
    .from("help_requests")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .eq("status", current.status);

  // Additional protection for resident cancellation

  if (actor.role === "resident") {
    updateQuery = updateQuery
      .eq("resident_id", actor.id)
      .eq("status", "Pending");
  }

  const { data, error } = await updateQuery
    .select("*")
    .maybeSingle();

  if (error) {
    dbError(
      error,
      "Could not update request status. Check help_requests UPDATE RLS policy."
    );
  }

  if (!data) {
    const err = new Error(
      "Request could not be updated. It may have changed or RLS may have blocked the operation."
    );

    err.status = 403;
    throw err;
  }

  // =====================================
  // SEND NOTIFICATION
  // =====================================

  await notify({
    userId: current.resident_id,
    type: "request_status_updated",
    message: `Your request status is now ${status}`,
    metadata: {
      requestId,
      status
    }
  });

  return data;
};

// =====================================
// EXPORT SERVICES
// =====================================

module.exports = {
  createRequest,
  getResidentRequests,
  getRequestById,
  getAvailableRequests,
  updateRequestStatus
};
