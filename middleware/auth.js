// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Authorization required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.id,
      'tokens.token': token,
      role: { $in: ['admin', 'superAdmin', 'moderator'] }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.token = token;
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ 
      success: false,
      message: 'Not authorized' 
    });
  }
};

const admin = (req, res, next) => {
  if (['admin', 'superAdmin', 'moderator'].includes(req.user?.role)) return next();
  res.status(403).json({ 
    success: false,
    message: 'Admin privileges required' 
  });
};

const superAdmin = (req, res, next) => {
  if (req.user.role !== 'superAdmin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin privileges required'
    });
  }
  next();
};


module.exports = { auth, admin, superAdmin };