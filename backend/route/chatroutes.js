const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const controller = require("../controllers/chat.controller");

router.post("/token", auth, controller.getToken);
router.post("/chat/profiles", auth, controller.getChatProfiles);

module.exports = router;
