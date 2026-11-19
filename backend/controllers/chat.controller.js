const {
  issueToken,
  toNexconnUserId,
  fromNexconnUserId
} = require("../services/nexconn.service");
const adminService = require("../services/admin.service");
const { isUuid } = require("../utils/validators");
const { fetchAvatarMap } = require("../utils/avatar");
const { success } = require("../utils/response");

exports.getToken = async (req, res, next) => {
  try {
    const requestId = req.body.requestId;
    const partnerId = req.body.partnerId;
    let partnerProfile = null;

    if (requestId || partnerId) {
      if (!requestId || !partnerId) {
        return res.status(400).json({
          success: false,
          error: "Request ID and partner ID are both required"
        });
      }

      if (!isUuid(requestId) || !isUuid(partnerId)) {
        return res.status(400).json({
          success: false,
          error: "Valid requestId and partnerId are required"
        });
      }

      const db = adminService.createAdminClient();

      const { data: request, error: requestError } = await db
        .from("help_requests")
        .select("id, resident_id")
        .eq("id", requestId)
        .maybeSingle();

      if (requestError) throw requestError;

      if (!request) {
        return res.status(404).json({
          success: false,
          error: "Request not found"
        });
      }

      const isResident = req.profile.role === "resident";
      const isVolunteer = req.profile.role === "volunteer";

      const authorizedVolunteerId =
        (isResident && request.resident_id === req.user.id)
          ? partnerId
          : (isVolunteer && request.resident_id === partnerId)
            ? req.user.id
            : null;

      if (!authorizedVolunteerId) {
        return res.status(403).json({
          success: false,
          error: "You cannot access this conversation"
        });
      }

      const { data: assignment, error: assignmentError } = await db
        .from("assignments")
        .select("id")
        .eq("request_id", requestId)
        .eq("volunteer_id", authorizedVolunteerId)
        .maybeSingle();

      if (assignmentError) throw assignmentError;

      if (!assignment) {
        return res.status(403).json({
          success: false,
          error: "No matching volunteer assignment exists"
        });
      }

      const { data: partnerData } = await db
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", partnerId)
        .maybeSingle();

      if (partnerData) {
        const pAv = await fetchAvatarMap(db, [partnerData.id]);
        partnerProfile = {
          id: partnerData.id,
          nexconnId: toNexconnUserId(partnerData.id),
          name: partnerData.full_name || (partnerData.role === "volunteer" ? "Volunteer" : "Citizen"),
          role: partnerData.role,
          avatarUrl: pAv[partnerData.id] || ""
        };
      }
    }

    const result = await issueToken({
      id: req.user.id,
      name: req.profile.full_name,
      email: req.user.email
    });

    res.set("Cache-Control", "no-store");

    const selfAv = await fetchAvatarMap(adminService.createAdminClient(), [req.user.id]);
    return success(
      res,
      {
        ...result,
        user: {
          id: req.user.id,
          nexconnId: result.userId,
          name: req.profile.full_name || req.user.email || "ReliefLink User",
          role: req.profile.role,
          avatarUrl: selfAv[req.user.id] || ""
        },
        ...(partnerProfile ? { partner: partnerProfile } : {})
      },
      "Chat token issued"
    );
  } catch (error) {
    next(error);
  }
};

exports.getChatProfiles = async (req, res, next) => {
  try {
    const rawIds = Array.isArray(req.body?.userIds) ? req.body.userIds.slice(0, 50) : [];
    if (!rawIds.length) {
      return success(res, { profiles: [] }, "No user IDs provided");
    }

    const db = adminService.createAdminClient();

    // Map incoming Nexconn IDs (rl...) or raw UUIDs to Supabase UUIDs
    const requestedUuids = new Set();
    for (const id of rawIds) {
      const str = String(id || "").trim();
      if (isUuid(str)) {
        requestedUuids.add(str.toLowerCase());
      } else {
        const uuid = fromNexconnUserId(str);
        if (uuid) requestedUuids.add(uuid.toLowerCase());
      }
    }

    if (!requestedUuids.size) {
      return success(res, { profiles: [] }, "No valid user IDs provided");
    }

    // Determine which user IDs the current user is authorized to view
    const allowedUuids = new Set([req.user.id.toLowerCase()]);

    if (req.profile.role === "admin") {
      requestedUuids.forEach((id) => allowedUuids.add(id));
    } else if (req.profile.role === "resident") {
      const { data: myReqs } = await db
        .from("help_requests")
        .select("id, assigned_volunteer_id")
        .eq("resident_id", req.user.id);

      const reqIds = (myReqs || []).map((r) => r.id);
      (myReqs || []).forEach((r) => {
        if (r.assigned_volunteer_id) allowedUuids.add(r.assigned_volunteer_id.toLowerCase());
      });

      if (reqIds.length) {
        const { data: assigns } = await db
          .from("assignments")
          .select("volunteer_id")
          .in("request_id", reqIds);
        (assigns || []).forEach((a) => {
          if (a.volunteer_id) allowedUuids.add(a.volunteer_id.toLowerCase());
        });
      }
    } else if (req.profile.role === "volunteer") {
      const { data: myAssigns } = await db
        .from("assignments")
        .select("help_requests(resident_id)")
        .eq("volunteer_id", req.user.id);

      (myAssigns || []).forEach((a) => {
        const rid = a.help_requests?.resident_id;
        if (rid) allowedUuids.add(rid.toLowerCase());
      });
    }

    const targetIds = [...requestedUuids].filter((id) => allowedUuids.has(id));
    if (!targetIds.length) {
      return success(res, { profiles: [] }, "Chat profiles fetched");
    }

    const { data: rows, error } = await db
      .from("profiles")
      .select("id, full_name, role")
      .in("id", targetIds);

    if (error) throw error;

    const avatarMap = await fetchAvatarMap(db, (rows || []).map((r) => r.id));
    const profiles = (rows || []).map((p) => ({
      userId: toNexconnUserId(p.id),
      supabaseId: p.id,
      name: p.full_name || (p.role === "volunteer" ? "Volunteer" : "Citizen"),
      role: p.role,
      avatarUrl: avatarMap[p.id] || ""
    }));

    return success(res, { profiles }, "Chat profiles fetched");
  } catch (error) {
    next(error);
  }
};
