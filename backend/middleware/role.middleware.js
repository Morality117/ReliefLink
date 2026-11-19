const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.profile) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this resource"
      });
    }

    return next();
  };
};

module.exports = allowRoles;
