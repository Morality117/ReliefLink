
const requestService = require("../services/request.service");
const assignmentService = require("../services/assignment.service");
const volunteerService = require("../services/volunteer.service");
const { success } = require("../utils/response");

// ======================================
// CREATE VOLUNTEER PROFILE
// ======================================

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

// ======================================
// GET AVAILABLE REQUESTS
// ======================================

exports.getAvailableRequests = async (req, res, next) => {
  try {
    const data = await requestService.getAvailableRequests(
      req.userSupabase
    );

    return success(
      res,
      data,
      "Available requests fetched"
    );
  } catch (e) {
    next(e);
  }
};

// ======================================
// GET MY ASSIGNMENTS
// ======================================

exports.getMyAssignments = async (req, res, next) => {
  try {
    const data = await assignmentService.getMyAssignments(
      req.userSupabase,
      req.user.id
    );

    return success(
      res,
      data,
      "Your assignments fetched"
    );
  } catch (e) {
    next(e);
  }
};

// ======================================
// ACCEPT REQUEST
// VOLUNTEER
// ======================================

exports.acceptRequest = async (req, res, next) => {
  try {
    const requestId = req.params.requestId;

    const data = await requestService.acceptRequest(
      req.userSupabase,
      requestId
    );

    return success(
      res,
      data,
      "Request accepted successfully",
      201
    );
  } catch (e) {
    next(e);
  }
};

// ======================================
// UPDATE ASSIGNED REQUEST STATUS
// ======================================

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

    return success(
      res,
      data,
      "Request status updated successfully"
    );
  } catch (e) {
    next(e);
  }
};
