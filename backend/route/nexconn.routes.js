
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const nexconnService = require("../services/nexconn.service");

// POST /api/token
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const tokenData = await nexconnService.issueChatAccessToken({
      userId: req.user.id,
      name:
        req.profile?.full_name ||
        req.profile?.name ||
        req.user.name ||
        "ReliefLink User",
      avatarUrl: req.profile?.avatar_url || ""
    });

    return res.status(200).json({
      success: true,
      message: "Nexconn access token issued successfully",
      data: tokenData
    });

  } catch (error) {
    console.error("Nexconn token issuance failed:", error.message);

    if (error.message === "Nexconn API domains are not configured") {
      return res.status(503).json({
        success: false,
        error: error.message
      });
    }

    return next(error);
  }
});

module.exports = router;
