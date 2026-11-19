const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/admin.controller");

// All routes require admin access
router.use(auth, allowRoles("admin"));

// REQUEST MANAGEMENT
router.get("/requests", controller.getAllRequests);
router.patch("/requests/:requestId/status", controller.updateRequestStatus);

// VOLUNTEER ASSIGNMENT
router.post("/requests/:requestId/assign", controller.assignVolunteer);

// USER MANAGEMENT
router.get("/users", controller.getUsers);

// VOLUNTEER CREATION & APPLICATIONS
router.post("/volunteers", controller.createVolunteer);
router.get("/volunteer-applications", controller.getVolunteerApplications);
router.patch("/volunteer-applications/:id", controller.updateVolunteerApplicationStatus);

module.exports = router;
