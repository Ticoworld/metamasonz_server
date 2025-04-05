const express = require("express");
const User = require("../models/User");
const Submission = require("../models/Submission"); // Missing in your code
const router = express.Router();
const { auth, admin, superAdmin } = require("../middleware/auth");

// Get all users (admin only)
router.get("/", auth, admin, async (req, res) => {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: "submissions", // Collection name (usually pluralized)
          localField: "_id",
          foreignField: "approvedBy",
          as: "approvals",
        },
      },
      {
        // In users route aggregation
        $project: {
          name: 1,
          email: 1,
          role: 1,
          codesGenerated: { $size: "$approvals" },
          createdAt: 1,
          isProtected: 1, // This is now included
        },
      },
    ]);

    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Users route error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Delete user
router.delete("/:id", auth, superAdmin, async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);

    if (!userToDelete) {
      return res.status(404).json({ success: false });
    }

    // Prevent deletion of protected users
    if (userToDelete.isProtected) {
      return res.status(403).json({
        success: false,
        message: "Protected admin cannot be deleted",
      });
    }

    // Prevent self-deletion
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/:id/role", auth, superAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("-password -tokens");

    if (!user) return res.status(404).json({ success: false });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;