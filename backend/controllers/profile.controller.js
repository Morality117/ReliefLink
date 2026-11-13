
const getMyProfile = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        name: req.profile.full_name,
        email: req.user.email,
        role: req.profile.role,
        phone: req.profile.phone
      }
    });
  } catch (error) {
    console.error("Get profile error:", error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to fetch profile"
    });
  }
};

module.exports = {
  getMyProfile
};
