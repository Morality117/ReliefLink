
const requestService = require("../services/request.service");
const assignmentService = require("../services/assignment.service");
const adminService = require("../services/admin.service");
const { success } = require("../utils/response");

// =====================================
// GET ALL REQUESTS
// =====================================

exports.getAllRequests = async (req, res, next) => {
  try {
    const { data, error } = await req.userSupabase
      .from("help_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return success(
      res,
      data || [],
      "All requests fetched"
    );
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
      req.userSupabase,
      req.params.requestId,
      req.body.status,
      {
        id: req.user.id,
        role: "admin"
      }
    );

    return success(
      res,
      data,
      "Request status updated"
    );
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
      req.userSupabase,
      {
        requestId: req.params.requestId,
        volunteerId: req.body.volunteerId,
        assignedBy: req.user.id,
        actorRole: "admin"
      }
    );

    return success(
      res,
      data,
      "Volunteer assigned",
      201
    );
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

    return success(
      res,
      data,
      "Users fetched"
    );
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

    // Required field validation

    if (!email || !password || !full_name || !phone) {
      return res.status(400).json({
        success: false,
        error: "Email, password, full_name and phone are required"
      });
    }

    // Input type validation

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

    // Email validation

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email address"
      });
    }

    // Password validation

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters"
      });
    }

    // Name and phone validation

    if (!cleanName || !cleanPhone) {
      return res.status(400).json({
        success: false,
        error: "Name and phone cannot be empty"
      });
    }

    // Create volunteer through admin service

    const volunteer = await adminService.createVolunteer({
      email: cleanEmail,
      password,
      full_name: cleanName,
      phone: cleanPhone
    });

    return success(
      res,
      volunteer,
      "Volunteer created successfully",
      201
    );

  } catch (e) {
    next(e);
  }
};
