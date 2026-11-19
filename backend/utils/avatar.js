const isValidAvatarUrl = (val) => {
  if (val === null || val === "") return true;
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  if (trimmed.length > 300000) return false; // ~220KB max
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(trimmed)) return true;
  return false;
};

const fetchAvatarMap = async (adminDb, userIds) => {
  const map = {};
  if (!userIds || !userIds.length) return map;
  try {
    const { data, error } = await adminDb
      .from("profiles")
      .select("id, avatar_url")
      .in("id", userIds);
    if (!error && data) {
      data.forEach((p) => {
        if (p.avatar_url) map[p.id] = p.avatar_url;
      });
    }
  } catch (e) {}
  return map;
};

module.exports = { isValidAvatarUrl, fetchAvatarMap };
