const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const Leave = require('../models/Leave');
const auth = require('../middleware/auth');

const toRad = (v) => (v * Math.PI) / 180;
const haversineMeters = (aLat, aLng, bLat, bLng) => {
  const R = 6371000; // meters
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(aa));
};

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Attendance day resets at 12:01 AM (local time).
// If current time is before 12:01 AM, treat attendance as previous day.
const getAttendanceDay = (now = new Date()) => {
  const d = new Date(now);
  if (d.getHours() === 0 && d.getMinutes() < 1) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
};

const normalizeAttendance = (att) => {
  if (!att) return null;
  const obj = typeof att.toObject === 'function' ? att.toObject() : att;
  // Mongoose subdocs can serialize empty objects for nested paths.
  // Treat punchIn/punchOut as present only when they have a time.
  if (!obj.punchIn?.time) obj.punchIn = null;
  if (!obj.punchOut?.time) obj.punchOut = null;
  return obj;
};

// Punch In
router.post('/punch-in', auth, async (req, res) => {
  try {
    let { lat, lng, address, accuracy, selfie } = req.body;

    lat = typeof lat === 'string' ? parseFloat(lat) : lat;
    lng = typeof lng === 'string' ? parseFloat(lng) : lng;
    accuracy = typeof accuracy === 'string' ? parseFloat(accuracy) : accuracy;

    if (!selfie || typeof selfie !== 'string') {
      return res.status(400).json({ message: 'Selfie is required for punch in' });
    }
    if (selfie.startsWith('data:image/')) {
      if (selfie.length > 280000) {
        return res.status(413).json({ message: 'Selfie too large. Please retake.' });
      }
    } else if (!isHttpUrl(selfie)) {
      return res.status(400).json({ message: 'Invalid selfie format' });
    }

    if (typeof lat !== 'number' || Number.isNaN(lat) || typeof lng !== 'number' || Number.isNaN(lng)) {
      return res.status(400).json({ message: 'Valid lat and lng are required' });
    }

    if (typeof accuracy !== 'number' || Number.isNaN(accuracy)) {
      accuracy = undefined;
    }

    // Punch-in should always succeed and should not be marked illegal.
    const isSuspect = false;
    const suspectReason = '';
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const today = getAttendanceDay(new Date());

    // Block punching while on approved leave unless HR/Admin permission granted
    const leave = await Leave.findOne({
      applicant: user._id,
      status: 'approved',
      startDate: { $lte: today },
      endDate: { $gte: today },
    }).select('_id leaveType startDate endDate');

    if (leave && !user.leavePunchPermission?.allowed) {
      await Notification.create({
        recipient: user._id,
        type: 'system',
        title: 'Punch Disabled During Leave',
        message: 'You are on approved leave. HR/Admin permission required to punch in/out.',
        category: 'attendance',
      });
      return res.status(403).json({ message: 'You are on approved leave. HR/Admin permission required to punch in/out.' });
    }

    // Check if already punched in today
    const existingAttendance = user.attendance.find(
      a => new Date(a.date).toDateString() === today.toDateString()
    );

    if (existingAttendance && existingAttendance.punchIn) {
      return res.status(400).json({ message: 'Already punched in today' });
    }

    // Create new attendance record
    const attendanceRecord = {
      date: today,
      punchIn: {
        time: new Date(),
        selfie,
        isSuspect,
        suspectReason: isSuspect ? suspectReason : '',
        location: { lat, lng, address, accuracy },
      },
    };

    user.attendance.push(attendanceRecord);
    user.isOnline = true;
    user.lastLocation = {
      lat,
      lng,
      address,
      accuracy,
      isSuspect,
      suspectReason: isSuspect ? suspectReason : '',
      updatedAt: new Date(),
    };
    
    await user.save();

    res.json({ 
      message: 'Punched in successfully', 
      attendance: attendanceRecord,
      location: { lat, lng, address, accuracy }
    });
  } catch (error) {
    console.error('Punch in error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Punch Out
router.post('/punch-out', auth, async (req, res) => {
  try {
    let { lat, lng, address, accuracy, selfie } = req.body;

    lat = typeof lat === 'string' ? parseFloat(lat) : lat;
    lng = typeof lng === 'string' ? parseFloat(lng) : lng;
    accuracy = typeof accuracy === 'string' ? parseFloat(accuracy) : accuracy;

    if (!selfie || typeof selfie !== 'string') {
      return res.status(400).json({ message: 'Selfie is required for punch out' });
    }
    if (selfie.startsWith('data:image/')) {
      if (selfie.length > 280000) {
        return res.status(413).json({ message: 'Selfie too large. Please retake.' });
      }
    } else if (!isHttpUrl(selfie)) {
      return res.status(400).json({ message: 'Invalid selfie format' });
    }

    if (typeof lat !== 'number' || Number.isNaN(lat) || typeof lng !== 'number' || Number.isNaN(lng)) {
      return res.status(400).json({ message: 'Valid lat and lng are required' });
    }

    if (typeof accuracy !== 'number' || Number.isNaN(accuracy)) {
      accuracy = undefined;
    }

    const reasons = [];
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const today = getAttendanceDay(now);

    // Block punching while on approved leave unless HR/Admin permission granted
    const leave = await Leave.findOne({
      applicant: user._id,
      status: 'approved',
      startDate: { $lte: today },
      endDate: { $gte: today },
    }).select('_id leaveType startDate endDate');

    if (leave && !user.leavePunchPermission?.allowed) {
      await Notification.create({
        recipient: user._id,
        type: 'system',
        title: 'Punch Disabled During Leave',
        message: 'You are on approved leave. HR/Admin permission required to punch in/out.',
        category: 'attendance',
      });
      return res.status(403).json({ message: 'You are on approved leave. HR/Admin permission required to punch in/out.' });
    }

    // Find today's attendance
    const attendanceIndex = user.attendance.findIndex(
      a => new Date(a.date).toDateString() === today.toDateString()
    );

    if (attendanceIndex === -1 || !user.attendance[attendanceIndex].punchIn) {
      return res.status(400).json({ message: 'Please punch in first' });
    }

    if (user.attendance[attendanceIndex].punchOut?.time) {
      return res.status(400).json({ message: 'Already punched out today' });
    }

    const radiusM = 500;
    const inLoc = user.attendance[attendanceIndex].punchIn?.location;
    let distanceFromPunchInM = null;
    let withinRadius = null;

    if (inLoc?.lat != null && inLoc?.lng != null) {
      distanceFromPunchInM = haversineMeters(inLoc.lat, inLoc.lng, lat, lng);
      withinRadius = distanceFromPunchInM <= radiusM;
      if (!withinRadius) reasons.push(`DISTANCE_${Math.round(distanceFromPunchInM)}m_GT_${radiusM}m`);
    } else {
      reasons.push('NO_PUNCHIN_LOCATION');
    }

    const isSuspect = reasons.length > 0;
    const suspectReason = isSuspect ? reasons.join('|') : '';

    // OT Calculation:
    // - Sunday: all worked minutes are OT
    // - Mon–Sat:
    //   * Time-based OT: after 7:30 PM, minutes after 6:30 PM
    //   * Duration-based OT: minutes beyond 9h 30m worked
    //   * Final OT = max(time-based, duration-based)
    const punchOutTime = now;
    const punchInTime = new Date(user.attendance[attendanceIndex].punchIn.time);
    
    const dutyStartHour = 9; // 9:00 AM
    const dutyStartMin = 0;
    const dutyEndHour = 18; // 6:30 PM
    const dutyEndMin = 30;
    const dutyEndToday = new Date(today);
    dutyEndToday.setHours(dutyEndHour, dutyEndMin, 0, 0);
    
    let overtimeMinutes = 0;
    const totalWorkedMinutes = Math.max(0, Math.floor((punchOutTime - punchInTime) / (1000 * 60)));
    
    // Check if it's Sunday (day = 0)
    const dayOfWeek = punchOutTime.getDay();
    const isSunday = dayOfWeek === 0;
    
    if (isSunday) {
      // All Sunday work is OT
      overtimeMinutes = totalWorkedMinutes;
    } else {
      const minimumThresholdMinutes = 60;
      const thresholdEnd = new Date(dutyEndToday);
      thresholdEnd.setMinutes(thresholdEnd.getMinutes() + minimumThresholdMinutes);

      const timeBasedOT = punchOutTime.getTime() <= thresholdEnd.getTime()
        ? 0
        : Math.max(0, Math.floor((punchOutTime - dutyEndToday) / (1000 * 60)));

      const shiftMinutes = ((dutyEndHour * 60 + dutyEndMin) - (dutyStartHour * 60 + dutyStartMin));
      const durationBasedOT = Math.max(0, totalWorkedMinutes - shiftMinutes);

      overtimeMinutes = Math.max(timeBasedOT, durationBasedOT);
    }

    user.attendance[attendanceIndex].punchOut = {
      time: punchOutTime,
      selfie,
      isSuspect,
      suspectReason: isSuspect ? reasons.join('|') : '',
      distanceFromPunchInM,
      radiusM,
      withinRadius,
      location: { lat, lng, address, accuracy },
      overtimeMinutes,
      overtimeStatus: overtimeMinutes > 0 ? 'pending' : 'none',
      overtimeApprovedBy: null,
      overtimeApprovedAt: null,
      overtimeAdjustedMinutes: null,
      overtimeAdjustmentNote: '',
    };
    
    user.isOnline = false;
    user.lastLocation = {
      lat,
      lng,
      address,
      accuracy,
      isSuspect,
      suspectReason,
      updatedAt: new Date(),
    };
    
    await user.save();

    res.json({ 
      message: 'Punched out successfully', 
      attendance: user.attendance[attendanceIndex],
      location: { lat, lng, address, accuracy },
      overtimeMinutes
    });
  } catch (error) {
    console.error('Punch out error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get today's attendance status
router.get('/today', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const today = getAttendanceDay(now);

    const todayAttendance = user.attendance.find(
      a => new Date(a.date).toDateString() === today.toDateString()
    );

    const closeMissingPunchOut = async (attendance) => {
      const baseDate = new Date(attendance.date || attendance.punchIn.time);
      const cutoff = new Date(baseDate);
      cutoff.setHours(23, 59, 59, 999);

      if (now.getTime() > cutoff.getTime()) {
        attendance.punchOut = {
          time: cutoff,
          isSuspect: true,
          suspectReason: 'MISSING_PUNCH_OUT',
          overtimeStatus: 'none',
          overtimeMinutes: 0,
          distanceFromPunchInM: null,
          radiusM: 500,
          withinRadius: null,
          location: null,
        };
        user.isOnline = false;
        await user.save();
        return true;
      }
      return false;
    };

    if (todayAttendance?.punchIn?.time && !todayAttendance?.punchOut?.time) {
      await closeMissingPunchOut(todayAttendance);
    } else if (!todayAttendance) {
      const openAttendance = user.attendance
        .filter(a => a?.punchIn?.time && !a?.punchOut?.time)
        .sort((a, b) => new Date(b.date || b.punchIn.time) - new Date(a.date || a.punchIn.time))[0];

      if (openAttendance) {
        await closeMissingPunchOut(openAttendance);
      }
    }

    res.json({ 
      attendance: normalizeAttendance(todayAttendance),
      isOnline: user.isOnline
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get attendance history
router.get('/history', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ attendance: user.attendance });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update live location (while punched-in)
router.post('/location', auth, async (req, res) => {
  try {
    const { lat, lng, address, accuracy } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'lat and lng are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isSuspect = typeof accuracy !== 'number' || accuracy > 300;
    const suspectReason =
      typeof accuracy !== 'number'
        ? 'NO_ACCURACY'
        : `LOW_ACCURACY_${Math.round(accuracy)}m`;

    user.lastLocation = {
      lat,
      lng,
      address,
      accuracy,
      isSuspect,
      suspectReason: isSuspect ? suspectReason : '',
      updatedAt: new Date(),
    };

    await user.save();

    res.json({ message: 'Location updated', lastLocation: user.lastLocation });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
