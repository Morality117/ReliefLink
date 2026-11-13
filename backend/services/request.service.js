
const {
  validateCreateRequest,
  validateStatus,
  isUuid
} = require("../utils/validators");

const { notify } = require("./notification.service");

// ======================================
// COMMON ERROR HANDLER
// ======================================

const dbError = (error, fallback) => {
  const err = new Error(error?.message || fallback);
  err.status = 400;
  throw err;
};

// ======================================
// CREATE HELP REQUEST
// RESIDENT
// ======================================

const createRequest = async (db, residentId, body) => {
  const errors = validateCreateRequest(body || {});

  if (errors.length) {
    const err = new Error(errors.join(", "));
    err.status = 400;
    throw err;
  }

  const payload = {
    resident_id: residentId,
    category: body.category,
    description: body.description.trim(),
    latitude:
      body.latitude === undefined ? null : Number(body.latitude),
    longitude:
      body.longitude === undefined ? null : Number(body.longitude)
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

// ======================================
// GET RESIDENT REQUESTS
// ======================================

const getResidentRequests = async (db, residentId) => {
  const { data: requests, error } = await db
    .from("help_requests")
    .select("*")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });

  if (error) {
    dbError(error, "Could not fetch your requests");
  }

  if (!requests || requests.length === 0) {
    return [];
  }

  const requestIds = requests.map(request => request.id);

  const { data: assignments, error: assignmentError } = await db
    .from("assignments")
    .select("request_id, volunteer_id")
    .in("request_id", requestIds);

  if (assignmentError) {
    dbError(
      assignmentError,
      "Could not fetch request assignments"
    );
  }

  const assignmentMap = new Map();

  for (const assignment of assignments || []) {
    assignmentMap.set(
      assignment.request_id,
      assignment.volunteer_id
    );
  }

  const volunteerIds = [
    ...new Set(
      (assignments || []).map(a => a.volunteer_id)
    )
  ];

  let volunteerMap = new Map();

  if (volunteerIds.length > 0) {
    const { data: volunteers, error: volunteerError } = await db
      .from("profiles")
      .select("id, full_name")
      .in("id", volunteerIds);

    if (volunteerError) {
      dbError(
        volunteerError,
        "Could not fetch volunteer profiles"
      );
    }

    volunteerMap = new Map(
      (volunteers || []).map(volunteer => [
        volunteer.id,
        volunteer
      ])
    );
  }

  return requests.map(request => {
    const volunteerId = assignmentMap.get(request.id);
    const volunteer = volunteerId
      ? volunteerMap.get(volunteerId)
      : null;

    return {
      ...request,
      assigned_volunteer: volunteer
        ? {
            id: volunteer.id,
            name: volunteer.full_name
          }
        : null
    };
  });
};

// ======================================
// GET REQUEST BY ID
// ======================================

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

// ======================================
// GET AVAILABLE REQUESTS
// VOLUNTEER
// ======================================

const getAvailableRequests = async (db) => {
  const { data, error } = await db
    .from("help_requests")
    .select("*")
    .eq("status", "Pending")
    .order("created_at", { ascending: true });

  if (error) {
    dbError(error, "Could not fetch available requests");
  }

  return data || [];
};

// ======================================
// ACCEPT REQUEST
// VOLUNTEER
// ATOMIC DATABASE OPERATION
// ======================================

const acceptRequest = async (db, requestId) => {
  if (!isUuid(requestId)) {
    const err = new Error("Invalid request ID");
    err.status = 400;
    throw err;
  }

  const { data, error } = await db.rpc(
    "accept_help_request",
    {
      p_request_id: requestId
    }
  );

  if (error) {
    const err = new Error(
      error.message || "Could not accept request"
    );

    err.status =
      error.code === "42501" ? 403 :
      error.code === "28000" ? 401 :
      400;

    throw err;
  }

  if (!data) {
    const err = new Error("Assignment was not created");
    err.status = 500;
    throw err;
  }

  await notify({
    userId: data.volunteer_id,
    type: "request_accepted",
    message: "You have successfully accepted a help request",
    metadata: {
      requestId: data.request_id,
      assignmentId: data.id
    }
  });

  return data;
};

// ======================================
// UPDATE REQUEST STATUS
// ======================================

const updateRequestStatus = async (
  db,
  requestId,
  status,
  actor
) => {
  if (!isUuid(requestId)) {
    const err = new Error("Invalid request ID");
    err.status = 400;
    throw err;
  }

  const statusErrors = validateStatus(status);

  if (statusErrors && statusErrors.length) {
    const err = new Error(
      Array.isArray(statusErrors)
        ? statusErrors.join(", ")
        : "Invalid status"
    );

    err.status = 400;
    throw err;
  }

  if (!actor || !actor.id || !actor.role) {
    const err = new Error("Invalid user");
    err.status = 401;
    throw err;
  }

  const currentRequest = await getRequestById(db, requestId);
  const currentStatus = currentRequest.status;

  // Residents can only cancel their own pending requests
  if (actor.role === "resident") {
    if (currentRequest.resident_id !== actor.id) {
      const err = new Error(
        "You cannot update this request"
      );

      err.status = 403;
      throw err;
    }

    if (
      currentStatus !== "Pending" ||
      status !== "Cancelled"
    ) {
      const err = new Error(
        "Residents can only cancel pending requests"
      );

      err.status = 403;
      throw err;
    }
  }

  // Allowed status transitions
  const transitions = {
    resident: {
      Pending: ["Cancelled"]
    },

    volunteer: {
      Pending: ["In Progress", "Resolved"],
      Verified: ["In Progress", "Resolved"],
      Assigned: ["In Progress", "Resolved"],
      "In Progress": ["Resolved"]
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
      Resolved: ["Pending"]
    }
  };

  const allowedTransitions =
    transitions[actor.role]?.[currentStatus] || [];

  if (!allowedTransitions.includes(status)) {
    const err = new Error(
      `Cannot change status from ${currentStatus} to ${status}`
    );

    err.status = 400;
    throw err;
  }

  let query = db
    .from("help_requests")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", requestId);

  if (actor.role === "resident") {
    query = query.eq("resident_id", actor.id);
  }

  const { data, error } = await query
    .select("*")
    .maybeSingle();

  if (error) {
    dbError(error, "Could not update request status");
  }

  if (!data) {
    const err = new Error(
      "Request could not be updated"
    );

    err.status = 404;
    throw err;
  }

  await notify({
    userId: currentRequest.resident_id,
    type: "request_status_updated",
    message: `Your request status is now ${status}`,
    metadata: {
      requestId,
      status
    }
  });

  return data;
};

// ======================================
// EXPORT FUNCTIONS
// ======================================

module.exports = {
  createRequest,
  getResidentRequests,
  getRequestById,
  getAvailableRequests,
  acceptRequest,
  updateRequestStatus
};
