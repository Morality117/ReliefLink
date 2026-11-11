
exports.createVolunteerProfile = async (supabase, userId, skills = []) => {
  const { data, error } = await supabase
    .from("volunteer_profiles")
    .upsert(
      {
        user_id: userId,
        skills: skills
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
