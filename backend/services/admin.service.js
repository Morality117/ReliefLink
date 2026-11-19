const { createClient } = require("@supabase/supabase-js");

// =====================================
// ADMIN SUPABASE CLIENT
// =====================================

const createAdminClient = () => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server configuration is missing");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
};

// =====================================
// CREATE VOLUNTEER
// =====================================

const createVolunteer = async ({
  email,
  password,
  full_name,
  phone
}) => {
  const adminSupabase = createAdminClient();

  const { data: authData, error: authError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
        role: "volunteer"
      }
    });

  if (authError) {
    const error = new Error(authError.message);
    error.status = 400;
    throw error;
  }

  const userId = authData.user.id;

  const { data: profile, error: profileError } =
    await adminSupabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name,
          phone,
          role: "volunteer"
        },
        { onConflict: "id" }
      )
      .select("id, full_name, phone, role")
      .single();

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(userId);
    const error = new Error(`Profile creation failed: ${profileError.message}`);
    error.status = 500;
    throw error;
  }

  const { error: volunteerProfileError } =
    await adminSupabase
      .from("volunteer_profiles")
      .upsert(
        {
          user_id: userId,
          skills: [],
          available: true
        },
        { onConflict: "user_id" }
      );

  if (volunteerProfileError) {
    await adminSupabase.from("profiles").delete().eq("id", userId);
    await adminSupabase.auth.admin.deleteUser(userId);
    const error = new Error(
      `Volunteer profile creation failed: ${volunteerProfileError.message}`
    );
    error.status = 500;
    throw error;
  }

  return {
    ...profile,
    email: authData.user.email,
    available: true
  };
};

// =====================================
// GET ALL USERS WITH AUTH EMAIL & AVAILABILITY
// =====================================

const getAllUsers = async () => {
  const adminSupabase = createAdminClient();

  const { data: profiles, error: profileError } =
    await adminSupabase
      .from("profiles")
      .select("id, full_name, role, phone, created_at")
      .order("created_at", { ascending: false });

  if (profileError) {
    throw profileError;
  }

  const { data: volunteerProfiles } = await adminSupabase
    .from("volunteer_profiles")
    .select("user_id, available, skills");

  const volMap = new Map(
    (volunteerProfiles || []).map((v) => [v.user_id, v])
  );

  const authUsers = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw error;
    }

    const currentUsers = data.users || [];
    authUsers.push(...currentUsers);

    if (currentUsers.length < perPage) {
      break;
    }
    page++;
  }

  const emailMap = new Map(
    authUsers.map((user) => [user.id, user.email || null])
  );

  return (profiles || []).map((profile) => {
    const vp = volMap.get(profile.id);
    return {
      ...profile,
      email: emailMap.get(profile.id) || null,
      ...(profile.role === "volunteer"
        ? {
            available: vp ? Boolean(vp.available) : false,
            skills: vp?.skills || []
          }
        : {})
    };
  });
};

module.exports = {
  createVolunteer,
  getAllUsers,
  createAdminClient
};
