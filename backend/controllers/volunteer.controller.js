const requestService = require("../services/request.service");
const assignmentService = require("../services/assignment.service");
const volunteerService = require("../services/volunteer.service");
const { success } = require("../utils/response");

// CREATE VOLUNTEER PROFILE
exports.createProfile = async (req, res, next) => {
  try {
    const skills = req.body.skills || [];

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        error: "Skills must be an array"
      });
    }

    const data = await volunteerService.createVolunteerProfile(
      req.userSupabase,
      req.user.id,
      skills
    );

    return success(
      res,
      data,
      "Volunteer profile created successfully",
      201
    );
  } catch (e) {
    next(e);
  }
};

// GET MY VOLUNTEER PROFILE SUMMARY
exports.getMyProfile = async (req, res, next) => {
  try {
    const data = await volunteerService.getVolunteerProfile(
      req.user.id,
      req.user,
      req.profile
    );
    return success(res, data, "Volunteer profile fetched");
  } catch (e) {
    next(e);
  }
};

// UPDATE MY VOLUNTEER PROFILE
exports.updateMyProfile = async (req, res, next) => {
  try {
    const { isValidAvatarUrl } = require("../utils/avatar");
    const { full_name, phone, skills, available, avatar_url } = req.body || {};
    if (avatar_url !== undefined && !isValidAvatarUrl(avatar_url)) {
      return res.status(400).json({ success: false, error: "Invalid avatar image format or size (max ~220KB)" });
    }

    if (full_name !== undefined && (typeof full_name !== "string" || !full_name.trim())) {
      return res.status(400).json({ success: false, error: "full_name must be a non-empty string" });
    }
    if (phone !== undefined && typeof phone !== "string") {
      return res.status(400).json({ success: false, error: "phone must be a string" });
    }
    if (skills !== undefined && !Array.isArray(skills)) {
      return res.status(400).json({ success: false, error: "skills must be an array" });
    }

    const cleanSkills = Array.isArray(skills)
      ? skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : undefined;

    await volunteerService.updateVolunteerProfile(req.user.id, {
      full_name,
      phone,
      skills: cleanSkills,
      available,
      avatar_url
    });

    const updated = await volunteerService.getVolunteerProfile(
      req.user.id,
      req.user,
      {
        ...req.profile,
        ...(full_name !== undefined ? { full_name: full_name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone.trim() } : {})
      }
    );

    return success(res, updated, "Volunteer profile updated");
  } catch (e) {
    next(e);
  }
};

// GET AVAILABLE REQUESTS
exports.getAvailableRequests = async (req, res, next) => {
  try {
    const data = await requestService.getAvailableRequests(req.userSupabase);
    return success(res, data, "Available requests fetched");
  } catch (e) {
    next(e);
  }
};

// GET MY ASSIGNMENTS
exports.getMyAssignments = async (req, res, next) => {
  try {
    const data = await assignmentService.getMyAssignments(
      req.userSupabase,
      req.user.id
    );
    return success(res, data, "Your assignments fetched");
  } catch (e) {
    next(e);
  }
};

// ACCEPT REQUEST
exports.acceptRequest = async (req, res, next) => {
  try {
    const data = await assignmentService.assignRequest(
      req.userSupabase,
      {
        requestId: req.params.requestId,
        volunteerId: req.user.id,
        assignedBy: req.user.id,
        actorRole: req.profile.role
      }
    );
    return success(res, data, "Request accepted", 201);
  } catch (e) {
    next(e);
  }
};

// UPDATE ASSIGNED REQUEST STATUS
exports.updateRequestStatus = async (req, res, next) => {
  try {
    const assignmentId = req.params.assignmentId;
    const status = req.body.status;

    const data = await assignmentService.updateAssignmentStatus(
      req.userSupabase,
      assignmentId,
      status,
      req.user.id
    );

    return success(res, data, "Request status updated");
  } catch (e) {
    next(e);
  }
};
