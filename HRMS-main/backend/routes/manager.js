const express = require('express');
const Manager = require('../models/Manager');

const router = express.Router();

// Get all managers
router.get('/', async (req, res) => {
  try {
    const managers = await Manager.find();
    res.json(managers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create manager (for setup)
router.post('/', async (req, res) => {
  try {
    const { managerId, name, email, department } = req.body;

    const manager = new Manager({
      managerId,
      name,
      email,
      department,
    });

    await manager.save();
    res.status(201).json(manager);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
