const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Public: list available managers/supervisors for registration
// NOTE: intentionally returns limited fields only.
router.get('/managers', async (req, res) => {
  try {
    const managers = await User.find({
      role: 'manager',
      isActive: true,
    })
      .select('name email role employeeId department designation profilePicUrl')
      .sort({ name: 1, email: 1 });

    res.json(managers);
  } catch (error) {
    console.error('Public managers error:', error.message);
    res.json([]);
  }
});

module.exports = router;
