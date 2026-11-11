
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/volunteer.controller");

// Authentication and volunteer role protection
router.use(auth, allowRoles("volunteer"));

// CREATE VOLUNTEER PROFILE
router.post("/profile", controller.createProfile);

// GET AVAILABLE REQUESTS
router.get("/requests/available", controller.getAvailableRequests);

// GET MY ASSIGNMENTS
router.get("/assignments/my", controller.getMyAssignments);

// ACCEPT REQUEST
router.post("/requests/:requestId/accept", controller.acceptRequest);

// UPDATE REQUEST STATUS
router.patch(
  "/assignments/:assignmentId/status",
  controller.updateRequestStatus
);

module.exports = router;
