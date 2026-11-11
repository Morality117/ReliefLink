const requestService = require("../services/request.service");
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
    return success(res, req.profile, "Profile fetched");
  } catch (e) { next(e); }
};

exports.updateMyProfile = async (req, res, next) => {
  try {
    const allowed = ["full_name", "phone"];
    const keys = Object.keys(req.body || {});
    if (!keys.length || keys.some(k => !allowed.includes(k))) {
      return res.status(400).json({ success: false, error: "Only full_name and phone can be updated" });
    }
    if (req.body.full_name !== undefined &&
        (typeof req.body.full_name !== "string" || !req.body.full_name.trim())) {
      return res.status(400).json({ success: false, error: "full_name must be a non-empty string" });
    }
    if (req.body.phone !== undefined &&
        req.body.phone !== null && typeof req.body.phone !== "string") {
      return res.status(400).json({ success: false, error: "phone must be a string or null" });
    }

    const patch = {};
    if (req.body.full_name !== undefined) patch.full_name = req.body.full_name.trim();
    if (req.body.phone !== undefined) patch.phone = req.body.phone;

    const { data, error } = await req.userSupabase.from("profiles")
      .update(patch).eq("id", req.user.id)
      .select("id, full_name, role, phone, created_at").single();
    if (error) throw error;
    return success(res, data, "Profile updated");
  } catch (e) { next(e); }
};
