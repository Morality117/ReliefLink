
const allowRoles = (...roles) => {
  return (req, res, next) => {

    console.log("\n===== ROLE DEBUG =====");
    console.log("User ID:", req.user?.id);
    console.log("Profile ID:", req.profile?.id);
    console.log("Profile role:", JSON.stringify(req.profile?.role));
    console.log("Expected roles:", roles);

    if (!req.user || !req.profile) {
      console.log("RESULT: Missing authentication/profile");

      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    if (!roles.includes(req.profile.role)) {
      console.log("RESULT: ROLE MISMATCH");

      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this resource"
      });
    }

    console.log("RESULT: ACCESS GRANTED");
    console.log("======================\n");

    next();
  };
};

module.exports = allowRoles;
