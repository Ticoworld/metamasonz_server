const express = require('express');
const Submission = require('../models/Submission.js');
const { auth, admin } = require('../middleware/auth.js');

const router = express.Router();

// Submit new project
router.post('/', async (req, res) => {
  try {
    // Validate and format incoming data
    const submissionData = {
      ...req.body,
      socials: {
        ...req.body.socials,
        x: req.body.socials.x?.replace(/^@/, ''),
        telegram: req.body.socials.telegram?.startsWith('@') 
          ? req.body.socials.telegram 
          : `@${req.body.socials.telegram}`,
        discord: req.body.socials.discord?.startsWith('http')
          ? req.body.socials.discord
          : `https://discord.gg/${req.body.socials.discord}`
      }
    };

    const submission = await Submission.create(submissionData);
    
    res.status(201).json({
      success: true,
      code: submission.submissionCode,
      data: {
        id: submission._id,
        submittedAt: submission.submittedAt
      }
    });

  } catch (error) {
    console.error('Submission error:', error);
    
    let statusCode = 500;
    let message = 'Server error';
    let errors = {};

    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation failed';
      Object.values(error.errors).forEach(err => {
        errors[err.path.split('.').pop()] = err.message;
      });
    } else if (error.code === 11000) {
      statusCode = 409;
      message = 'This submission already exists';
    }

    res.status(statusCode).json({
      success: false,
      message,
      errors: Object.keys(errors).length ? errors : undefined
    });
  }
});

// Get all submissions
router.get('/', auth, admin, async (req, res) => {
  try {
    const { status, sort } = req.query;
    const filter = status ? { status } : {};
    const sortOrder = sort === 'oldest' ? 1 : -1;

    const submissions = await Submission.find(filter)
      .populate('approvedBy', 'name email role')  // Add this line
      .sort({ submittedAt: sortOrder })
      .limit(100);

    res.json({ 
      success: true,
      count: submissions.length,
      data: submissions 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// // Advanced search
// router.get('/search', auth, admin, async (req, res) => {
//   try {
//     const { q: searchTerm } = req.query;
    
//     const submissions = await Submission.find({
//       $or: [
//         { submissionCode: searchTerm.toUpperCase() },
//         { projectName: new RegExp(searchTerm, 'i') },
//         { email: new RegExp(searchTerm, 'i') },
//         { 'socials.founderTg': new RegExp(searchTerm, 'i') }
//       ]
//     }).limit(10);

//     res.json({ 
//       success: true, 
//       count: submissions.length,
//       data: submissions 
//     });
//   } catch (error) {
//     res.status(500).json({ 
//       success: false,
//       message: 'Server error' 
//     });
//   }
// });

// Add delete route
router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const submission = await Submission.findByIdAndDelete(req.params.id);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      data: null
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Add status update route
router.patch('/:id/status', auth, admin, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    
    // Validation checks
    if (submission.statusLocked) {
      return res.status(400).json({
        success: false,
        message: 'This submission has been finalized and cannot be modified'
      });
    }

    const { status } = req.body;
    const allowedTransitions = {
      pending: ['approved', 'rejected'],
      approved: [],
      rejected: []
    };

    if (!allowedTransitions[submission.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${submission.status} to ${status}`
      });
    }

    // Build update object
    const update = {
      status,
      statusLocked: ['approved', 'rejected'].includes(status),
      $push: { 
        statusHistory: {
          status,
          changedBy: req.user._id,
          changedAt: new Date()
        }
      }
    };

    // Set approver/rejector
    if (status === 'approved') update.approvedBy = req.user._id;
    if (status === 'rejected') update.rejectedBy = req.user._id;

    // Perform update with population
    const updatedSubmission = await Submission.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).populate('approvedBy rejectedBy statusHistory.changedBy', 'name role email');

    res.json({ 
      success: true,
      data: updatedSubmission 
    });

  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ 
      success: false,
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Server error' 
    });
  }
});

// Update search route
router.get('/search', auth, admin, async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    // Use $regex operator properly
    const submissions = await Submission.find({
      $or: [
        { submissionCode: { $regex: `^${searchTerm}$`, $options: 'i' } },
        { projectName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { 'socials.founderTg': { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(10);

    res.json({ 
      success: true, 
      count: submissions.length,
      data: submissions 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Get single submission
router.get('/:id', auth, admin, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
    .populate('approvedBy rejectedBy statusHistory.changedBy', 'name email role');
  
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      data: submission
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;