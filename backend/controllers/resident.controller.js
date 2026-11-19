const requestService = require("../services/request.service");
const adminService = require("../services/admin.service");
const { isValidAvatarUrl, fetchAvatarMap } = require("../utils/avatar");
const { success } = require("../utils/response");

exports.getMyRequests = async (req, res, next) => {
  try {
    const data = await requestService.getResidentRequests(req.userSupabase, req.user.id);
    return success(res, data, "Your requests fetched");
  } catch (e) { next(e); }
};

exports.createRequest = async (req, res, next) => {
  try {
    const data = await requestService.createRequest(req.userSupabase, req.user.id, req.body);
    return success(res, data, "Help request created", 201);
  } catch (e) { next(e); }
};

exports.getMyProfile = async (req, res, next) => {
  try {
    const adminDb = adminService.createAdminClient();
    const [avatarMap, { data: myReqs }] = await Promise.all([
      fetchAvatarMap(adminDb, [req.user.id]),
      adminDb
        .from("help_requests")
        .select("status")
        .eq("resident_id", req.user.id)
    ]);

    const list = myReqs || [];
    const active = list.filter((r) => ["Pending", "Verified", "Assigned", "In Progress"].includes(r.status)).length;
    const resolved = list.filter((r) => r.status === "Resolved").length;
    const cancelled = list.filter((r) => r.status === "Cancelled").length;

    return success(
      res,
      {
        id: req.user.id,
        full_name: req.profile.full_name || req.user.email,
        email: req.user.email,
        phone: req.profile.phone || "",
        role: req.profile.role,
        avatar_url: avatarMap[req.user.id] || "",
        stats: {
          total: list.length,
          active,
          resolved,
          cancelled
        }
      },
      "Profile fetched"
    );
  } catch (e) { next(e); }
};

exports.updateMyProfile = async (req, res, next) => {
  try {
    const allowed = ["full_name", "phone", "avatar_url"];
    const keys = Object.keys(req.body || {});
    if (!keys.length || keys.some((k) => !allowed.includes(k))) {
      return res.status(400).json({ success: false, error: "Only full_name, phone, and avatar_url can be updated" });
    }
    if (
      req.body.full_name !== undefined &&
      (typeof req.body.full_name !== "string" || !req.body.full_name.trim())
    ) {
      return res.status(400).json({ success: false, error: "full_name must be a non-empty string" });
    }
    if (
      req.body.phone !== undefined &&
      req.body.phone !== null &&
      typeof req.body.phone !== "string"
    ) {
      return res.status(400).json({ success: false, error: "phone must be a string or null" });
    }
    if (req.body.avatar_url !== undefined && !isValidAvatarUrl(req.body.avatar_url)) {
      return res.status(400).json({ success: false, error: "Invalid avatar image format or size (max ~220KB)" });
    }

    const patch = {};
    if (req.body.full_name !== undefined) patch.full_name = req.body.full_name.trim();
    if (req.body.phone !== undefined) patch.phone = req.body.phone ? req.body.phone.trim() : "";
    if (req.body.avatar_url !== undefined) patch.avatar_url = req.body.avatar_url || null;

    const adminDb = adminService.createAdminClient();
    const { error } = await adminDb
      .from("profiles")
      .update(patch)
      .eq("id", req.user.id);

    if (error) {
      if (error.code === "42703" || /avatar_url/i.test(error.message || "")) {
        return res.status(400).json({
          success: false,
          error: "Please run the avatar_url SQL migration in Supabase first."
        });
      }
      throw error;
    }

    if (req.body.full_name !== undefined) req.profile.full_name = patch.full_name;
    if (req.body.phone !== undefined) req.profile.phone = patch.phone;

    return exports.getMyProfile(req, res, next);
  } catch (e) { next(e); }
};
