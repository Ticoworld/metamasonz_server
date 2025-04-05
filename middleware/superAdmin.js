const superAdmin = (req, res, next) => {
    if (req.user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin privileges required'
      });
    }
    next();
  };
  
  module.exports = superAdmin;