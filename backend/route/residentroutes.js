const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/resident.controller");

router.use(auth, allowRoles("resident"));
router.get("/profile", controller.getMyProfile);
router.patch("/profile", controller.updateMyProfile);
router.get("/requests", controller.getMyRequests);
router.post("/requests", controller.createRequest);

module.exports = router;
