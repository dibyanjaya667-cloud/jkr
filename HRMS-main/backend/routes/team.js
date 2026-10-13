const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

const normalizeAttendance = (att) => {
  if (!att) return null;
  const obj = typeof att.toObject === 'function' ? att.toObject() : att;
  if (!obj.punchIn?.time) obj.punchIn = null;
  if (!obj.punchOut?.time) obj.punchOut = null;
  return obj;
};

const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// Pick attendance that truly belongs to today (guards against stale punchIn/punchOut)
const pickTodayAttendance = (user, today) => {
  const list = Array.isArray(user?.attendance) ? user.attendance : [];
  const found = list.find((a) => {
    if (!a) return false;
    const hasIn = !!a?.punchIn?.time;
    const hasOut = !!a?.punchOut?.time;
    const inToday = hasIn ? isSameDay(a.punchIn.time, today) : false;
    const outToday = hasOut ? isSameDay(a.punchOut.time, today) : false;
    const dateToday = a?.date ? isSameDay(a.date, today) : false;

    if (hasIn || hasOut) return inToday || outToday;
    return dateToday;
  });
  return normalizeAttendance(found);
};

const toTeamUser = (user, today) => {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    department: user.department,
    designation: user.designation,
    profilePicUrl: user.profilePicUrl,
    reportsTo: user.reportsTo,
    todayAttendance: pickTodayAttendance(user, today),
  };
};

// My Team (employee-first): returns manager (supervisor), peers, and (for managers/hr/ceo) direct reports.
router.get('/my-team', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    // Use simple today date - same logic as admin route
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Manager/Supervisor (who current user reports to)
    let manager = null;
    if (currentUser.reportsTo) {
      manager = await User.findById(currentUser.reportsTo)
        .select('name email role employeeId department designation profilePicUrl reportsTo attendance')
        .populate('reportsTo', 'name email role employeeId profilePicUrl')
        .lean();
    }

    // Peers (same manager)
    let peers = [];
    if (currentUser.reportsTo) {
      peers = await User.find({
        reportsTo: currentUser.reportsTo,
        _id: { $ne: currentUser._id },
        isActive: true,
        role: { $ne: 'admin' },
      })
        .select('name email role employeeId department designation profilePicUrl reportsTo attendance')
        .populate('reportsTo', 'name email role employeeId profilePicUrl')
        .lean();
    }

    // If current user is manager/hr/ceo: also show direct reports
    let directReports = [];
    if (['manager', 'hr', 'ceo', 'admin'].includes(currentUser.role)) {
      directReports = await User.find({ reportsTo: currentUser._id, isActive: true })
        .select('name email role employeeId department designation profilePicUrl reportsTo attendance')
        .populate('reportsTo', 'name email role employeeId profilePicUrl')
        .lean();
    }

    res.json({
      currentUser: toTeamUser(currentUser, today),
      manager: toTeamUser(manager, today),
      peers: Array.isArray(peers) ? peers.map((u) => toTeamUser(u, today)) : [],
      directReports: Array.isArray(directReports) ? directReports.map((u) => toTeamUser(u, today)) : [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
