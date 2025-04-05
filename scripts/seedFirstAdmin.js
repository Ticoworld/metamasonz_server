require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Check if superAdmin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superAdmin' });
    if (existingSuperAdmin) {
      console.log('Super admin already exists:', existingSuperAdmin.email);
      return process.exit(0);
    }

    // Create super admin
    const superAdmin = await User.create({
      name: 'Metamasonz',
      email: process.env.INITIAL_ADMIN_EMAIL,
      password: process.env.INITIAL_ADMIN_PASSWORD.trim(),
      role: 'superAdmin',
      isProtected: true,
      isVerified: true
    });

    console.log('Super admin created successfully!');
    console.log('Email:', superAdmin.email);
    console.log('Temporary password:', process.env.INITIAL_ADMIN_PASSWORD);
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedSuperAdmin();