const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/request.controller");

router.use(auth);
router.post("/", allowRoles("resident"), controller.createRequest);
router.get("/my", allowRoles("resident"), controller.getMyRequests);
router.get("/:id", allowRoles("resident", "volunteer", "admin"), controller.getRequestById);
router.patch("/:id/status", allowRoles("resident", "volunteer", "admin"), controller.updateStatus);

module.exports = router;
