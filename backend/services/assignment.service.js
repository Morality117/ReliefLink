
const { isUuid } = require("../utils/validators");
const { notify } = require("./notification.service");

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  throw error;
};

// ==========================================
// GET MY ASSIGNMENTS
// ==========================================

const getMyAssignments = async (db, volunteerId) => {
  if (!isUuid(volunteerId)) {
    fail("Invalid volunteer ID", 400);
  }

  const { data, error } = await db
    .from("assignments")
    .select("*, help_requests(*)")
    .eq("volunteer_id", volunteerId)
    .order("assigned_at", { ascending: false });

  if (error) {
    console.error("Get assignments error:", error);
    fail(error.message || "Could not fetch assignments");
  }

  return data || [];
};

// ==========================================
// ASSIGN / ACCEPT REQUEST
// ==========================================

const assignRequest = async (
  db,
  { requestId, volunteerId, assignedBy, actorRole }
) => {
  if (!isUuid(requestId) || !isUuid(volunteerId)) {
    fail("Valid requestId and volunteerId are required");
  }

  if (!isUuid(assignedBy)) {
    fail("Invalid assigning user ID");
  }

  if (
    actorRole === "volunteer" &&
    volunteerId !== assignedBy
  ) {
    fail(
      "Volunteers can only accept requests for themselves",
      403
    );
  }

  // Verify volunteer profile
  const { data: volunteer, error: volunteerError } = await db
    .from("volunteer_profiles")
    .select("user_id, available")
    .eq("user_id", volunteerId)
    .maybeSingle();

  if (volunteerError) {
    console.error("Volunteer lookup error:", volunteerError);
    fail(volunteerError.message);
  }

  if (!volunteer || !volunteer.available) {
    fail(
      "Volunteer profile is missing or volunteer is unavailable",
      403
    );
  }

  // Verify request
  const { data: request, error: requestError } = await db
    .from("help_requests")
    .select("id, resident_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    console.error("Request lookup error:", requestError);
    fail(requestError.message);
  }

  if (!request) {
    fail("Request not found", 404);
  }

  if (
    actorRole === "volunteer" &&
    request.status !== "Pending"
  ) {
    fail("Only pending requests can be accepted", 409);
  }

  if (
    actorRole === "admin" &&
    !["Pending", "Verified", "Assigned"].includes(request.status)
  ) {
    fail("Request is not assignable", 409);
  }

  // Create assignment
  const { data, error } = await db
    .from("assignments")
    .insert({
      request_id: requestId,
      volunteer_id: volunteerId,
      assigned_by: assignedBy
    })
    .select("*")
    .single();

  if (error) {
    console.error("Create assignment error:", error);
    fail(error.message || "Could not create assignment");
  }

  // Notify resident
  try {
    await notify({
      userId: request.resident_id,
      type: "request_assigned",
      message: "A volunteer has been assigned to your request",
      metadata: {
        requestId,
        volunteerId,
        assignmentId: data.id
      }
    });
  } catch (notificationError) {
    console.error(
      "Assignment notification error:",
      notificationError.message
    );
  }

  return data;
};

// ==========================================
// UPDATE ASSIGNED REQUEST STATUS
// ==========================================

const updateAssignmentStatus = async (
  db,
  assignmentId,
  status,
  volunteerId
) => {
  // Validate IDs
  if (!isUuid(assignmentId)) {
    fail("Invalid assignment ID", 400);
  }

  if (!isUuid(volunteerId)) {
    fail("Invalid volunteer ID", 401);
  }

  // Validate volunteer status
  const allowedStatuses = [
    "In Progress",
    "Resolved"
  ];

  if (!allowedStatuses.includes(status)) {
    fail("Invalid volunteer status", 400);
  }

  // Verify assignment ownership
  const { data: assignment, error: assignmentError } = await db
    .from("assignments")
    .select("id, request_id, volunteer_id")
    .eq("id", assignmentId)
    .eq("volunteer_id", volunteerId)
    .maybeSingle();

  if (assignmentError) {
    console.error("Assignment verification error:", assignmentError);
    fail(assignmentError.message);
  }

  if (!assignment) {
    fail(
      "Assignment not found or not authorized",
      403
    );
  }

  // Call existing SECURITY DEFINER database function
  console.log("Calling status update RPC:", {
    assignmentId,
    requestId: assignment.request_id,
    volunteerId,
    status
  });

  const { data, error } = await db.rpc(
    "update_help_request_status",
    {
      p_request_id: assignment.request_id,
      p_status: status
    }
  );

  if (error) {
    console.error("Status update RPC error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });

    fail(
      error.message || "Could not update request status",
      400
    );
  }

  console.log("Status update RPC successful:", data);

  return data;
};

// ==========================================
// EXPORT SERVICES
// ==========================================

module.exports = {
  getMyAssignments,
  assignRequest,
  updateAssignmentStatus
};
