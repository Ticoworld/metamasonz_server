const express = require("express");
const validator = require("validator");
const User = require("../models/User");
const Invite = require("../models/Invite");
const { auth, admin } = require("../middleware/auth"); // Correct import
const router = express.Router();
const { sendEmail } = require("../utils/emailSender");

// Generate Invite
router.post("/invites/generate", auth, admin, async (req, res) => {
  try {
    const { email, role } = req.body;

    // Validation
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Valid email required",
      });
    }

    if (!["admin", "moderator"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Check existing invites
    const existingInvite = await Invite.findOne({
      email: email.toLowerCase(),
      status: { $in: ["pending", "sent"] },
    });

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        message: "Active invite exists for this email",
      });
    }

    // Create invite
    const invite = await Invite.create({
      email: email.toLowerCase(),
      role,
      createdBy: req.user._id,
      status: "sent",
    });

    // Populate creator info for response
    await invite.populate('createdBy', 'name email');

    // Send email
    await sendEmail(
      "adminInvite",
      [invite.code, invite.email, invite.role],
      invite.email
    );

    res.status(201).json({
      success: true,
      data: invite,
    });
  } catch (error) {
    console.error("Invite error:", error);
    res.status(500).json({
      success: false,
      message: "Invite generation failed",
    });
  }
});


// Resend Invite
router.post("/invites/resend/:id", auth, admin, async (req, res) => {
  try {
    const invite = await Invite.findById(req.params.id);

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found",
      });
    }

    if (invite.status === "accepted") {
      return res.status(400).json({
        success: false,
        message: "Invite already accepted",
      });
    }

    if (invite.isExpired) {
      return res.status(400).json({
        success: false,
        message: "Invite expired",
      });
    }

    // Update invite: extend expiration and reset status to 'sent'
    invite.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    invite.status = "sent";
    await invite.save();

    // Resend email
    await sendEmail(
      "adminInvite",
      [invite.code, invite.email, invite.role],
      invite.email
    );

    res.json({
      success: true,
      data: invite,
    });
  } catch (error) {
    console.error("Resend error:", error);
    res.status(500).json({
      success: false,
      message: "Resend failed",
    });
  }
});

// Get all invites (populating the creator details)
router.get('/invites', auth, admin, async (req, res) => {
  try {
    const invites = await Invite.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('usedBy', 'name email');

    res.json({
      success: true,
      data: invites
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invites'
    });
  }
});

router.post('/invites/:id/revoke', auth, admin, async (req, res) => {
  try {
    const invite = await Invite.findById(req.params.id);
    
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found'
      });
    }

    // Only allow revoking if invite hasn't been used
    if (invite.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke an accepted invite'
      });
    }

    // Only allow creator or admin to revoke
    if (invite.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to revoke this invite'
      });
    }

    invite.status = 'revoked';
    await invite.save();

    res.json({
      success: true,
      data: invite
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to revoke invite'
    });
  }
});

module.exports = router;
