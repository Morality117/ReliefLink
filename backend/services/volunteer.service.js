const { createAdminClient } = require("./admin.service");
const { fetchAvatarMap } = require("../utils/avatar");

exports.createVolunteerProfile = async (supabase, userId, skills = []) => {
  const { data, error } = await supabase
    .from("volunteer_profiles")
    .upsert(
      {
        user_id: userId,
        skills: skills,
        available: true
      },
      {
        onConflict: "user_id"
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Create volunteer profile error:", error);
    throw error;
  }

  return data;
};

exports.getVolunteerProfile = async (userId, authUser, baseProfile) => {
  const adminDb = createAdminClient();

  const [{ data: vp }, { data: assignments }, avatarMap] = await Promise.all([
    adminDb
      .from("volunteer_profiles")
      .select("skills, available, created_at")
      .eq("user_id", userId)
      .maybeSingle(),
    adminDb
      .from("assignments")
      .select("id, help_requests(status)")
      .eq("volunteer_id", userId),
    fetchAvatarMap(adminDb, [userId])
  ]);

  const tasks = (assignments || []).filter((a) => a.help_requests);
  const activeCount = tasks.filter((a) =>
    ["Assigned", "In Progress"].includes(a.help_requests.status)
  ).length;
  const resolvedCount = tasks.filter(
    (a) => a.help_requests.status === "Resolved"
  ).length;

  return {
    id: userId,
    full_name: baseProfile.full_name || authUser.email,
    email: authUser.email,
    phone: baseProfile.phone || "",
    role: baseProfile.role,
    avatar_url: avatarMap[userId] || "",
    skills: Array.isArray(vp?.skills) ? vp.skills : [],
    available: vp ? Boolean(vp.available) : true,
    stats: {
      total: tasks.length,
      active: activeCount,
      resolved: resolvedCount
    }
  };
};

exports.updateVolunteerProfile = async (userId, { full_name, phone, skills, available, avatar_url }) => {
  const adminDb = createAdminClient();

  const profilePatch = {};
  if (full_name !== undefined) profilePatch.full_name = full_name.trim();
  if (phone !== undefined) profilePatch.phone = phone.trim();
  if (avatar_url !== undefined) profilePatch.avatar_url = avatar_url || null;

  if (Object.keys(profilePatch).length > 0) {
    const { error: pErr } = await adminDb
      .from("profiles")
      .update(profilePatch)
      .eq("id", userId);
    if (pErr) {
      if (pErr.code === "42703" || /avatar_url/i.test(pErr.message || "")) {
        const err = new Error("Please run the avatar_url SQL migration in Supabase first.");
        err.status = 400;
        throw err;
      }
      throw pErr;
    }
  }

  const vpPatch = { user_id: userId };
  if (skills !== undefined) vpPatch.skills = skills;
  if (available !== undefined) vpPatch.available = Boolean(available);

  if (skills !== undefined || available !== undefined) {
    const { error: vpErr } = await adminDb
      .from("volunteer_profiles")
      .upsert(vpPatch, { onConflict: "user_id" });
    if (vpErr) throw vpErr;
  }

  return true;
};
