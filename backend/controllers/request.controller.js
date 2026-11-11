const service = require("../services/request.service");
const { success } = require("../utils/response");

exports.createRequest = async (req, res, next) => {
  try {
    const data = await service.createRequest(req.userSupabase, req.user.id, req.body);
    return success(res, data, "Help request created", 201);
  } catch (e) { next(e); }
};

exports.getMyRequests = async (req, res, next) => {
  try {
    const data = await service.getResidentRequests(req.userSupabase, req.user.id);
    return success(res, data, "Your requests fetched");
  } catch (e) { next(e); }
};

exports.getRequestById = async (req, res, next) => {
  try {
    const data = await service.getRequestById(req.userSupabase, req.params.id);
    return success(res, data, "Request fetched");
  } catch (e) { next(e); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const data = await service.updateRequestStatus(
      req.userSupabase, req.params.id, req.body.status,
      { id: req.user.id, role: req.profile.role }
    );
    return success(res, data, "Request status updated");
  } catch (e) { next(e); }
};
