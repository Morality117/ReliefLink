
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const profileController = require("../controllers/profile.controller");

// GET /api/me
router.get("/", auth, profileController.getMyProfile);

module.exports = router;
