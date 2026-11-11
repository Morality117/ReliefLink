
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

  // 1. Create Auth user

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

  // 2. Create profile

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

  // 3. Rollback if profile creation fails

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(userId);

    const error = new Error(
      `Profile creation failed: ${profileError.message}`
    );

    error.status = 500;
    throw error;
  }

  // Return profile with Auth email

  return {
    ...profile,
    email: authData.user.email
  };
};

// =====================================
// GET ALL USERS WITH AUTH EMAIL
// =====================================

const getAllUsers = async () => {
  const adminSupabase = createAdminClient();

  // 1. Fetch profiles

  const { data: profiles, error: profileError } =
    await adminSupabase
      .from("profiles")
      .select("id, full_name, role, phone, created_at")
      .order("created_at", { ascending: false });

  if (profileError) {
    throw profileError;
  }

  // 2. Fetch Auth users (paginated)

  const authUsers = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } =
      await adminSupabase.auth.admin.listUsers({
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

  // 3. Map Auth email to profile using UUID

  const emailMap = new Map(
    authUsers.map(user => [
      user.id,
      user.email || null
    ])
  );

  // 4. Return merged users

  return (profiles || []).map(profile => ({
    ...profile,
    email: emailMap.get(profile.id) || null
  }));
};

// =====================================
// EXPORT
// =====================================

module.exports = {
  createVolunteer,
  getAllUsers
};
