const { isUuid } = require("../utils/validators");
const { notify } = require("./notification.service");
const { createAdminClient } = require("./admin.service");

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

  const assignments = data || [];

  const residentIds = [
    ...new Set(
      assignments
        .filter((a) => a.help_requests)
        .map((a) => a.help_requests.resident_id)
        .filter(Boolean)
    )
  ];

  if (residentIds.length === 0) return assignments;

  // Use admin client to read citizen names safely regardless of profiles RLS
  const adminDb = createAdminClient();
  const { data: profiles, error: profileError } = await adminDb
    .from("profiles")
    .select("id, full_name")
    .in("id", residentIds);

  if (profileError) {
    console.error("Resident profiles error:", profileError);
    fail(profileError.message || "Could not fetch resident names");
  }

  const names = {};
  (profiles || []).forEach((p) => {
    names[p.id] = p.full_name;
  });

  return assignments.map((a) => ({
    ...a,
    help_requests: a.help_requests
      ? {
          ...a.help_requests,
          resident_name:
            names[a.help_requests.resident_id] || "Citizen"
        }
      : null
  }));
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

  if (actorRole === "volunteer" && volunteerId !== assignedBy) {
    fail("Volunteers can only accept requests for themselves", 403);
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
    fail("Volunteer profile is missing or volunteer is unavailable", 403);
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

  if (actorRole === "volunteer" && request.status !== "Pending") {
    fail("Only pending requests can be accepted", 409);
  }

  if (
    actorRole === "admin" &&
    !["Pending", "Verified"].includes(request.status)
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

  const allowedCurrentStatuses =
    actorRole === "admin"
      ? ["Pending", "Verified"]
      : ["Pending"];

  const { data: updatedRequest, error: updateError } = await db
    .from("help_requests")
    .update({
      status: "Assigned",
      assigned_volunteer_id: volunteerId,
      updated_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .in("status", allowedCurrentStatuses)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedRequest) {
    const { error: rollbackError } = await db
      .from("assignments")
      .delete()
      .eq("id", data.id);

    if (rollbackError) {
      console.error("Assignment rollback failed:", rollbackError);
    }

    fail(
      updateError?.message ||
        "This request has already been assigned or changed.",
      updateError ? 400 : 409
    );
  }

  // Look up volunteer name for response & notification
  let volunteerName = null;
  try {
    const adminDb = createAdminClient();
    const { data: volProfile } = await adminDb
      .from("profiles")
      .select("full_name")
      .eq("id", volunteerId)
      .maybeSingle();
    volunteerName = volProfile?.full_name || null;
  } catch (e) {}

  try {
    await notify({
      userId: request.resident_id,
      type: "request_assigned",
      message: volunteerName
        ? `${volunteerName} has been assigned to your request`
        : "A volunteer has been assigned to your request",
      metadata: {
        requestId,
        volunteerId,
        volunteerName,
        assignmentId: data.id
      }
    });
  } catch (notificationError) {
    console.error("Assignment notification error:", notificationError.message);
  }

  return {
    ...data,
    volunteer_name: volunteerName
  };
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
  if (!isUuid(assignmentId)) {
    fail("Invalid assignment ID", 400);
  }

  if (!isUuid(volunteerId)) {
    fail("Invalid volunteer ID", 401);
  }

  const allowedStatuses = ["In Progress", "Resolved"];

  if (!allowedStatuses.includes(status)) {
    fail("Invalid volunteer status", 400);
  }

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
    fail("Assignment not found or not authorized", 403);
  }

  const { data, error } = await db.rpc("update_help_request_status", {
    p_request_id: assignment.request_id,
    p_status: status
  });

  if (error) {
    console.error("Status update RPC error:", error.message);
    fail(error.message || "Could not update request status", 400);
  }

  return data;
};

module.exports = {
  getMyAssignments,
  assignRequest,
  updateAssignmentStatus
};
