const requestService = require("../services/request.service");
const assignmentService = require("../services/assignment.service");
const adminService = require("../services/admin.service");
const { success } = require("../utils/response");

// =====================================
// GET ALL REQUESTS
// =====================================

exports.getAllRequests = async (req, res, next) => {
  try {
    const adminDb = adminService.createAdminClient();
    const { data, error } = await adminDb
      .from("help_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const requests = data || [];
    if (!requests.length) {
      return success(res, [], "All requests fetched");
    }

    // Also inspect assignments table as fallback in case assigned_volunteer_id wasn't set
    const { data: assignments } = await adminDb
      .from("assignments")
      .select("request_id, volunteer_id");

    const assignmentVolMap = new Map();
    (assignments || []).forEach((a) => {
      if (a.request_id && a.volunteer_id) {
        assignmentVolMap.set(a.request_id, a.volunteer_id);
      }
    });

    const userIds = new Set();
    requests.forEach((r) => {
      if (r.resident_id) userIds.add(r.resident_id);
      const vid = r.assigned_volunteer_id || assignmentVolMap.get(r.id);
      if (vid) userIds.add(vid);
    });

    const names = {};
    if (userIds.size) {
      const { data: profiles } = await adminDb
        .from("profiles")
        .select("id, full_name")
        .in("id", [...userIds]);

      (profiles || []).forEach((p) => {
        names[p.id] = p.full_name;
      });
    }

    const enriched = requests.map((r) => {
      const volunteerId = r.assigned_volunteer_id || assignmentVolMap.get(r.id) || null;
      const volunteerName = volunteerId ? (names[volunteerId] || "Volunteer") : null;
      const residentName = names[r.resident_id] || "Unknown";

      return {
        ...r,
        assigned_volunteer_id: volunteerId,
        resident_name: residentName,
        volunteer_name: volunteerName,
        assigned_volunteer: volunteerId
          ? { id: volunteerId, name: volunteerName }
          : null
      };
    });

    return success(res, enriched, "All requests fetched");
  } catch (e) {
    next(e);
  }
};

// =====================================
// UPDATE REQUEST STATUS
// =====================================

exports.updateRequestStatus = async (req, res, next) => {
  try {
    const data = await requestService.updateRequestStatus(
      adminService.createAdminClient(),
      req.params.requestId,
      req.body.status,
      {
        id: req.user.id,
        role: "admin"
      }
    );

    return success(res, data, "Request status updated");
  } catch (e) {
    next(e);
  }
};

// =====================================
// ASSIGN VOLUNTEER
// =====================================

exports.assignVolunteer = async (req, res, next) => {
  try {
    const data = await assignmentService.assignRequest(
      adminService.createAdminClient(),
      {
        requestId: req.params.requestId,
        volunteerId: req.body.volunteerId,
        assignedBy: req.user.id,
        actorRole: "admin"
      }
    );

    return success(res, data, "Volunteer assigned", 201);
  } catch (e) {
    next(e);
  }
};

// =====================================
// GET ALL USERS WITH AUTH EMAIL
// =====================================

exports.getUsers = async (req, res, next) => {
  try {
    const data = await adminService.getAllUsers();
    return success(res, data, "Users fetched");
  } catch (e) {
    next(e);
  }
};

// =====================================
// CREATE VOLUNTEER
// =====================================

exports.createVolunteer = async (req, res, next) => {
  try {
    const {
      email,
      password,
      full_name,
      phone
    } = req.body || {};

    if (!email || !password || !full_name || !phone) {
      return res.status(400).json({
        success: false,
        error: "Email, password, full_name and phone are required"
      });
    }

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof full_name !== "string" ||
      typeof phone !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid input types"
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = full_name.trim();
    const cleanPhone = phone.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email address"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters"
      });
    }

    if (!cleanName || !cleanPhone) {
      return res.status(400).json({
        success: false,
        error: "Name and phone cannot be empty"
      });
    }

    const volunteer = await adminService.createVolunteer({
      email: cleanEmail,
      password,
      full_name: cleanName,
      phone: cleanPhone
    });

    return success(res, volunteer, "Volunteer created successfully", 201);
  } catch (e) {
    next(e);
  }
};

// =====================================
// VOLUNTEER APPLICATIONS (ADMIN)
// =====================================

exports.getVolunteerApplications = async (req, res, next) => {
  try {
    const adminDb = adminService.createAdminClient();
    const { data, error } = await adminDb
      .from("volunteer_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return success(res, [], "Volunteer applications table not configured yet");
      }
      throw error;
    }

    return success(res, data || [], "Volunteer applications fetched");
  } catch (e) {
    next(e);
  }
};

exports.updateVolunteerApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be pending, approved, or rejected"
      });
    }

    const adminDb = adminService.createAdminClient();
    const { data, error } = await adminDb
      .from("volunteer_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    return success(res, data, "Application status updated");
  } catch (e) {
    next(e);
  }
};
