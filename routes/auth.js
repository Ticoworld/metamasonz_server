const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const validator = require("validator");
const User = require("../models/User");
const Invite = require("../models/Invite");
const { auth, admin } = require("../middleware/auth"); // Correct import
const router = express.Router();
const { sendEmail, templates, transporter } = require("../utils/emailSender");

// Admin login
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.toLowerCase();

    // Validate input format
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Find admin user
    const user = await User.findOne({ 
      email,
      role: { $in: ["admin", "superAdmin", "moderator"] } // Changed this line
    }).select("+password +loginAttempts +lockUntil");

    // Account not found
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "No authorized account found with this email",
      });
    }

    // Account lock check
    if (user.isLocked) {
      const retryAfter = Math.ceil((user.lockUntil - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked. Try again in ${retryAfter} seconds`,
      });
    }

    // Verify credentials
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please try again",
      });
    }

    // Reset login attempts on success
    await user.resetLoginAttempts();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Update user tokens
    user.tokens.push({
      token,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    await user.save();

    // Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
    

    // Successful response
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later",
    });
  }
});

// Admin registration with invite code
router.post("/register", async (req, res) => {
  try {
    const { inviteCode, email, password, name } = req.body; // Changed from 'code'

    // Enhanced validation
    const errors = [];
    if (!validator.isEmail(email)) errors.push('Invalid email format');
    if (!validator.isLength(password, { min: 8 })) errors.push('Password must be 8+ characters');
    if (!validator.isLength(name, { min: 2 })) errors.push('Name must be 2+ characters');
    if (!inviteCode) errors.push('Invite code required');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errorType: 'VALIDATION_ERROR',
        message: 'Registration failed',
        errors
      });
    }

    // Case-insensitive invite search
    const invite = await Invite.findOne({
      code: inviteCode,
      email: email.toLowerCase(),
      status: 'sent'
    });

    if (!invite || invite.expiresAt < Date.now()) {
      return res.status(400).json({
        success: false,
        errorType: 'INVITE_ERROR',
        message: 'Invalid or expired invite code'
      });
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name: name.trim(),
      role: invite.role,
    });

    // Update invite
    invite.status = "accepted";
    invite.usedAt = new Date();
    invite.usedBy = user._id;
    await invite.save();

    // Login logic
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});

// Helper function
async function sendWelcomeEmail(email, name, role) {
  try {
    await transporter.sendMail({
      from: `"Admin Team" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: `Welcome to Our Platform (${role} access)`,
      html: `
        <h1>Welcome, ${name}!</h1>
        <p>Your ${role} account has been successfully created.</p>
        <p><strong>Important:</strong> This email confirms your elevated privileges.</p>
      `,
    });
  } catch (err) {
    console.error("Welcome email failed:", err);
  }
}

// Generate invite codes (admin only)
// router.post("/invites/generate", auth, admin, async (req, res) => {
//   try {
//     const { email, role } = req.body;

//     // Validation
//     if (!validator.isEmail(email)) {
//       return res.status(400).json({
//         success: false,
//         message: "Valid email required",
//       });
//     }

//     if (!["admin", "moderator"].includes(role)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid role",
//       });
//     }

//     // Check existing user
//     const existingUser = await User.findOne({ email: email.toLowerCase() });
//     if (existingUser) {
//       return res.status(400).json({
//         success: false,
//         message: "User already exists",
//       });
//     }

//     // Check existing invites
//     const existingInvite = await Invite.findOne({
//       email: email.toLowerCase(),
//       status: { $in: ["pending", "sent"] },
//     });

//     if (existingInvite) {
//       return res.status(400).json({
//         success: false,
//         message: "Active invite exists for this email",
//       });
//     }

//     // Create invite
//     const invite = await Invite.create({
//       email: email.toLowerCase(),
//       role,
//       createdBy: req.user._id,
//       status: "sent",
//     });

//     // Send email
//     await sendEmail(
//       "adminInvite",
//       [invite.code, invite.email, invite.role],
//       invite.email
//     );

//     res.status(201).json({
//       success: true,
//       data: invite,
//     });
//   } catch (error) {
//     console.error("Invite error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Invite generation failed",
//     });
//   }
// });

// // Resend Invite
// router.post("/invites/resend/:id", auth, admin, async (req, res) => {
//   try {
//     const invite = await Invite.findById(req.params.id);

//     if (!invite) {
//       return res.status(404).json({
//         success: false,
//         message: "Invite not found",
//       });
//     }

//     if (invite.status === "accepted") {
//       return res.status(400).json({
//         success: false,
//         message: "Invite already accepted",
//       });
//     }

//     if (invite.isExpired) {
//       return res.status(400).json({
//         success: false,
//         message: "Invite expired",
//       });
//     }

//     // Update invite
//     invite.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
//     invite.status = "sent";
//     await invite.save();

//     // Resend email
//     await sendEmail(
//       "adminInvite",
//       [invite.code, invite.email, invite.role],
//       invite.email
//     );

//     res.json({
//       success: true,
//       data: invite,
//     });
//   } catch (error) {
//     console.error("Resend error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Resend failed",
//     });
//   }
// });

// // routes/auth.js
// router.get('/invites', auth, admin, async (req, res) => {
//   try {
//     const invites = await Invite.find()
//       .sort({ createdAt: -1 })
//       .populate('createdBy', 'name email');

//     res.json({
//       success: true,
//       data: invites
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch invites'
//     });
//   }
// });

// Logout

router.post("/logout", auth, async (req, res) => {
  try {
    // Remove current token from user
    req.user.tokens = req.user.tokens.filter(
      (tokenObj) => tokenObj.token !== req.token
    );
    await req.user.save();

    // Clear cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Logout failed" });
  }
});

// Add to your auth routes (server-side)
router.get("/verify", auth, admin, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// Add this to your existing auth routes
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -tokens -loginAttempts -lockUntil');
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data'
    });
  }
});

// routes/auth.js

module.exports = router;
