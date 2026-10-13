const express = require('express');
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');
const { toWords } = require('number-to-words');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const Leave = require('../models/Leave');
const Notification = require('../models/Notification');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const { sendEmail } = require('../services/email');
const { accountStatusEmail, tempPasswordEmail, accountCreatedEmail, profileStatusEmail } = require('../services/emailTemplates');

// Role hierarchy levels (higher number = higher authority)
// Hierarchy: Employee < Manager < HR < CEO
const ROLE_HIERARCHY = {
  'admin': 100,
  'ceo': 90,
  'hr': 80,
  'manager': 70,
  'employee': 50,
};

// Admin middleware
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!['admin', 'ceo'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Check if user has supervisory access (HR, Manager, CEO)
const isSupervisor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    const supervisorRoles = ['admin', 'ceo', 'hr', 'manager'];
    if (!supervisorRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. Supervisory role required.' });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Team view access (Employee + above)
const canViewTeam = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    const allowedRoles = ['admin', 'ceo', 'hr', 'manager', 'employee'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// HR/CEO middleware (HR and above can access)
const isHRorAbove = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    const allowedRoles = ['admin', 'ceo', 'hr'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. HR or above required.' });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

router.post('/send-email', auth, isAdmin, async (req, res) => {
  try {
    const { to, subject, html, text } = req.body || {};
    if (!to) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }

    await sendEmail({ to, subject, html, text });
    return res.json({ success: true });
  } catch (error) {
    console.error('Brevo send email error:', error);
    return res.status(500).json({ message: 'Failed to send email' });
  }
});

const replaceFirst = (str, search, replace) => {
  const idx = str.indexOf(search);
  if (idx === -1) return str;
  return `${str.slice(0, idx)}${replace}${str.slice(idx + search.length)}`;
};

const replaceNth = (str, search, replace, n) => {
  let idx = -1;
  let start = 0;
  for (let i = 0; i < n; i += 1) {
    idx = str.indexOf(search, start);
    if (idx === -1) return str;
    start = idx + search.length;
  }
  return `${str.slice(0, idx)}${replace}${str.slice(idx + search.length)}`;
};

const generateTempPassword = (length = 8) => (
  crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, length)
);

const formatPlain = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '0';
  return Math.round(num).toString();
};

const formatAmount = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getOverrideValue = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return num;
};

const replaceTotalsAndNetPay = (xml, { totalEarnings, totalDeductions, netPayWords }) => {
  let updated = xml;
  const totals = {
    earnings: { value: totalEarnings, formatted: formatAmount(totalEarnings), used: false },
    deductions: { value: totalDeductions, formatted: formatAmount(totalDeductions), used: false },
  };

  // Exact template match for earnings total with leading space in run
  updated = updated.replace(
    /<w:t(?:\s+xml:space="preserve")?>\s*78,669\.00<\/w:t>/,
    (match) => match.replace('78,669.00', totals.earnings.formatted)
  );

  // Exact template match for deductions total inside the TOTAL run
  updated = updated.replace(
    /<w:t>\s*TOTAL:\s*([0-9,]+(?:\.\d+)?)(\s*)<\/w:t>/,
    (match, numberText, spaces) => match.replace(numberText, totals.deductions.formatted)
  );

  // Earnings TOTAL is split across runs with a tab before the number.
  updated = updated.replace(
    /<w:t>TOTAL:<\/w:t><\/w:r><w:r[^>]*><w:tab\/><w:t[^>]*>\s*([0-9,]+(?:\.\d+)?)/,
    (match, numberText) => {
      totals.earnings.used = true;
      return match.replace(numberText, totals.earnings.formatted);
    }
  );

  // Deductions TOTAL appears in a single run with spaces before the number.
  updated = updated.replace(
    /<w:t>\s*TOTAL:([^<]*?)([0-9,]+(?:\.\d+)?)([^<]*)<\/w:t>/,
    (match, before, numberText, after) => {
      totals.deductions.used = true;
      return `<w:t>TOTAL:${before}${totals.deductions.formatted}${after}</w:t>`;
    }
  );

  const pickTotal = (existing) => {
    const existingNum = Number(String(existing || '0').replace(/,/g, '')) || 0;
    const diffE = Math.abs(existingNum - totals.earnings.value);
    const diffD = Math.abs(existingNum - totals.deductions.value);

    if (!totals.earnings.used && !totals.deductions.used) {
      return diffE <= diffD ? 'earnings' : 'deductions';
    }
    if (!totals.earnings.used) return 'earnings';
    if (!totals.deductions.used) return 'deductions';
    return null;
  };

  const replaceMatch = (match, numberText) => {
    const key = pickTotal(numberText);
    if (!key) return match;
    totals[key].used = true;
    return match.replace(numberText, totals[key].formatted);
  };

  // Handle split runs: TOTAL:</w:t><w:t>78,669.00
  updated = updated.replace(/TOTAL:\s*<\/w:t>\s*<w:t[^>]*>\s*([0-9,]+(?:\.\d+)?)/g, replaceMatch);
  // Handle same run: TOTAL: 78,669.00
  updated = updated.replace(/TOTAL:\s*([0-9,]+(?:\.\d+)?)/g, replaceMatch);
  // Handle totals with tabs/other tags between label and number
  updated = updated.replace(/TOTAL:[\s\S]{0,200}?([0-9,]+(?:\.\d+)?)/g, replaceMatch);

  updated = updated.replace(/Net Pay:\s*[^<]*/g, `Net Pay: ${netPayWords}`);
  return updated;
};

const replaceDeductionByLabel = (xml, label, value) => {
  const safeLabel = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `(<w:t[^>]*>\\s*${safeLabel}\\s*<\\/w:t>[\\s\\S]{0,800}?<w:t[^>]*>)([^<]*)(<\\/w:t>)`
  );
  return xml.replace(regex, `$1${formatPlain(value)}$3`);
};

const titleCaseWords = (text) => (
  String(text || '')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
);

const getMonthLabel = (date) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${monthNames[d.getMonth()]}-${d.getFullYear()}`;
};

const getMonthKey = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getAttendanceReportRange = ({ mode, month, days, now = new Date() }) => {
  const safeDays = Math.min(90, Math.max(1, parseInt(days, 10) || 30));
  const rangeMode = (mode || '').toLowerCase() || 'last30';

  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const endOfDay = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  const parseMonthKey = (key) => {
    if (!key || typeof key !== 'string') return null;
    const m = key.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const monthIdx = parseInt(m[2], 10) - 1;
    if (!year || monthIdx < 0 || monthIdx > 11) return null;
    return { year, monthIdx };
  };

  let start;
  let end;
  if (rangeMode === 'month') {
    const parsed = parseMonthKey(month) || { year: now.getFullYear(), monthIdx: now.getMonth() };
    start = startOfDay(new Date(parsed.year, parsed.monthIdx, 1));
    const monthEnd = endOfDay(new Date(parsed.year, parsed.monthIdx + 1, 0));
    // Don't go beyond today for current/future dates.
    end = monthEnd.getTime() > now.getTime() ? endOfDay(now) : monthEnd;
  } else {
    end = endOfDay(now);
    start = startOfDay(new Date(end));
    start.setDate(start.getDate() - (safeDays - 1));
  }

  return { rangeMode, start, end };
};

const buildAttendanceReport = ({ users, mode, month, days, now = new Date(), range }) => {
  const { rangeMode, start, end } = range || getAttendanceReportRange({ mode, month, days, now });

  const dutyStartHour = 9;
  const dutyStartMin = 0;
  const dutyEndHour = 18;
  const dutyEndMin = 30;
  const overtimeGraceMinutes = 60;
  const shiftMinutes = ((dutyEndHour * 60 + dutyEndMin) - (dutyStartHour * 60 + dutyStartMin)); // 570

  const computeOvertimeMinutes = (punchInTime, punchOutTime, attendanceDay) => {
    if (!punchInTime || !punchOutTime) return 0;
    const totalWorkedMinutes = Math.max(0, Math.floor((punchOutTime - punchInTime) / (1000 * 60)));
    // Sunday: full day is OT (based on the attendance date, not the punchOut date)
    if (attendanceDay && attendanceDay.getDay() === 0) return totalWorkedMinutes;

    const dutyEnd = new Date(attendanceDay);
    dutyEnd.setHours(dutyEndHour, dutyEndMin, 0, 0);
    const thresholdEnd = new Date(dutyEnd);
    thresholdEnd.setMinutes(thresholdEnd.getMinutes() + overtimeGraceMinutes);

    const timeBasedOT = punchOutTime.getTime() <= thresholdEnd.getTime()
      ? 0
      : Math.max(0, Math.floor((punchOutTime - dutyEnd) / (1000 * 60)));

    const durationBasedOT = Math.max(0, totalWorkedMinutes - shiftMinutes);
    return Math.max(timeBasedOT, durationBasedOT);
  };

  const isAfterMissedPunchOutCutoff = (dayDate, nowDate) => {
    const cutoff = new Date(dayDate);
    cutoff.setHours(23, 59, 59, 999);
    return nowDate.getTime() > cutoff.getTime();
  };

  const dateKey = (d) => startOfDay(d).toDateString();

  const daysList = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    daysList.push(startOfDay(d));
  }

  const reportUsers = users.map((u) => {
    const attendanceMap = new Map();
    for (const rec of (u.attendance || [])) {
      if (!rec?.date) continue;
      const recDate = new Date(rec.date);
      if (recDate.getTime() < start.getTime() || recDate.getTime() > end.getTime()) continue;
      const key = dateKey(recDate);
      if (!attendanceMap.has(key)) attendanceMap.set(key, rec);
    }

    let totalWorkMinutes = 0;
    let totalOtMinutes = 0;
    let presentDays = 0;
    let absentDays = 0;
    let missedPunchOutDays = 0;

    const dayRows = daysList.map((dayDate) => {
      const key = dateKey(dayDate);
      const rec = attendanceMap.get(key) || null;
      const isSunday = dayDate.getDay() === 0;

      const inTime = rec?.punchIn?.time ? new Date(rec.punchIn.time) : null;
      const outTime = rec?.punchOut?.time ? new Date(rec.punchOut.time) : null;
      const isToday = dateKey(dayDate) === dateKey(now);

      let status = 'absent';
      if (isSunday && !rec) status = 'holiday';
      if (rec && !inTime) status = 'missed_punch_in';
      if (inTime) {
        presentDays += 1;
        if (!outTime) {
          if (isToday) {
            status = 'working';
          } else if (isAfterMissedPunchOutCutoff(dayDate, now)) {
            status = 'missed_punch_out';
            missedPunchOutDays += 1;
          } else {
            status = 'pending';
          }
        } else {
          if (rec?.punchOut?.suspectReason === 'MISSING_PUNCH_OUT') {
            status = 'missed_punch_out';
            missedPunchOutDays += 1;
          } else {
            const isIllegal = !!rec.punchOut?.isSuspect || rec.punchOut?.withinRadius === false;
            status = isIllegal ? 'illegal' : 'completed';
          }
        }
      }

      if (!rec && !isSunday) {
        absentDays += 1;
      }

      // Work/OT minutes
      const effectiveOut = outTime || (inTime && isToday ? now : null);
      const rawWorkedMinutes = inTime && effectiveOut
        ? Math.max(0, Math.floor((effectiveOut - inTime) / (1000 * 60)))
        : 0;

      const storedOt = typeof rec?.punchOut?.overtimeMinutes === 'number' ? rec.punchOut.overtimeMinutes : null;
      const storedOtStatus = rec?.punchOut?.overtimeStatus || (storedOt > 0 ? 'pending' : 'none');
      const adjustedOt = typeof rec?.punchOut?.overtimeAdjustedMinutes === 'number' ? rec.punchOut.overtimeAdjustedMinutes : null;

      // Sunday: all worked minutes are OT (including live/ongoing work)
      const baseWorkMinutes = Math.min(rawWorkedMinutes, shiftMinutes);
      const computedOt = inTime && outTime ? computeOvertimeMinutes(inTime, outTime, dayDate) : 0;

      const workMinutes = isSunday ? 0 : baseWorkMinutes;
      const sundayRunningOt = isSunday ? rawWorkedMinutes : 0;
      const computedOrSundayOt = isSunday ? Math.max(sundayRunningOt, computedOt) : computedOt;
      const overtimeMinutes = typeof storedOt === 'number' ? Math.max(storedOt, computedOrSundayOt) : computedOrSundayOt;
      const approvedOtMinutes = storedOtStatus === 'approved'
        ? (typeof adjustedOt === 'number' ? adjustedOt : overtimeMinutes)
        : 0;

      totalWorkMinutes += workMinutes;
      totalOtMinutes += approvedOtMinutes;

      return {
        date: dayDate.toISOString(),
        isSunday,
        isToday,
        status,
        punchInTime: inTime ? inTime.toISOString() : null,
        punchOutTime: outTime ? outTime.toISOString() : null,
        punchInLocation: rec?.punchIn?.location || null,
        punchOutLocation: rec?.punchOut?.location || null,
        punchInSuspect: rec?.punchIn?.isSuspect || false,
        punchInSuspectReason: rec?.punchIn?.suspectReason || '',
        punchOutSuspect: rec?.punchOut?.isSuspect || false,
        punchOutSuspectReason: rec?.punchOut?.suspectReason || '',
        distanceFromPunchInM: typeof rec?.punchOut?.distanceFromPunchInM === 'number' ? rec.punchOut.distanceFromPunchInM : null,
        withinRadius: typeof rec?.punchOut?.withinRadius === 'boolean' ? rec.punchOut.withinRadius : null,
        workMinutes,
        overtimeMinutes: approvedOtMinutes,
        overtimeRawMinutes: overtimeMinutes,
        overtimeStatus: storedOtStatus,
        overtimeAdjustedMinutes: adjustedOt,
      };
    });

    return {
      _id: u._id,
      name: u.name || (u.email ? u.email.split('@')[0] : ''),
      email: u.email,
      employeeId: u.employeeId,
      role: u.role,
      department: u.department || '',
      profilePicUrl: u.profilePicUrl || '',
      managerName: u.manager?.name || '',
      reportsToName: u.reportsTo?.name || '',
      reportsToRole: u.reportsTo?.role || '',
      summary: {
        presentDays,
        absentDays,
        missedPunchOutDays,
        totalWorkMinutes,
        totalOtMinutes,
        totalWorkHours: Math.round((totalWorkMinutes / 60) * 10) / 10,
        totalOtHours: Math.round((totalOtMinutes / 60) * 10) / 10,
      },
      days: dayRows,
    };
  });

  return {
    mode: rangeMode === 'month' ? 'month' : 'last30',
    start: start.toISOString(),
    end: end.toISOString(),
    days: daysList.length,
    users: reportUsers,
  };
};

// Get all users with their locations and attendance
router.get('/users', auth, isHRorAbove, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password -attendance')
      .populate('manager', 'name department')
      .populate('reportsTo', 'name email role employeeId');
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ USER MANAGEMENT CRUD ============

// Get all roles available
// Hierarchy: Employee < Manager < HR < CEO
router.get('/roles', auth, isAdmin, (req, res) => {
  const roles = [
    { value: 'ceo', label: 'CEO', level: 90 },
    { value: 'hr', label: 'HR', level: 80 },
    { value: 'manager', label: 'Manager', level: 70 },
    { value: 'employee', label: 'Employee', level: 50 },
  ];
  res.json(roles);
});

// Get potential supervisors for a role (people who can be "reportsTo")
router.get('/potential-supervisors/:role', auth, isHRorAbove, async (req, res) => {
  try {
    const { role } = req.params;
    const roleLevel = ROLE_HIERARCHY[role] || 50;
    
    // Get users with higher role level who can be supervisors
    const supervisorRoles = Object.entries(ROLE_HIERARCHY)
      .filter(([r, level]) => level > roleLevel && r !== 'admin')
      .map(([r]) => r);
    
    const supervisors = await User.find({ 
      role: { $in: supervisorRoles },
      isActive: true 
    })
    .select('name email role employeeId department')
    .sort('role name');
    
    res.json(supervisors);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new user (Admin only)
router.post('/users', auth, isAdmin, async (req, res) => {
  try {
    const { name, email, password, employeeId, role, reportsTo, department, designation, manager } = req.body;
    
    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    // Check if employeeId exists
    const existingEmpId = await User.findOne({ employeeId });
    if (existingEmpId) {
      return res.status(400).json({ message: 'Employee ID already exists' });
    }
    
    const newUser = new User({
      name,
      email,
      password,
      employeeId,
      role: role || 'employee',
      reportsTo: reportsTo || null,
      department: department || '',
      designation: designation || '',
      manager: manager || null,
      isActive: true,
    });
    
    await newUser.save();

    try {
      if (newUser.email) {
        const { subject, html, text } = accountCreatedEmail({
          userName: newUser.name || newUser.email?.split('@')[0],
          tempPassword: password || null,
        });
        await sendEmail({ to: newUser.email, subject, html, text });
      }
    } catch (mailError) {
      console.error('Account created email failed:', mailError.message);
    }
    
    const userResponse = await User.findById(newUser._id)
      .select('-password -attendance')
      .populate('reportsTo', 'name email role');
    
    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user (Admin only)
router.put('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const { name, email, role, reportsTo, department, designation, isActive, manager, password } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check email uniqueness if changed
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    
    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (department !== undefined) user.department = department;
    if (designation !== undefined) user.designation = designation;
    if (isActive !== undefined) user.isActive = isActive;
    if (manager !== undefined) user.manager = manager;
    if (reportsTo !== undefined) user.reportsTo = reportsTo || null;
    if (password) user.password = password; // Will be hashed by pre-save hook
    
    await user.save();
    
    const updatedUser = await User.findById(user._id)
      .select('-password -attendance')
      .populate('reportsTo', 'name email role')
      .populate('manager', 'name department');
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (Admin only)
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin user' });
    }
    
    // Update users who report to this user to report to no one
    await User.updateMany({ reportsTo: user._id }, { reportsTo: null });
    
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ BULK ACTIONS ============

// Bulk delete users
router.post('/users/bulk-delete', auth, isAdmin, async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No users selected' });
    }
    
    // Don't allow deleting admins
    const adminUsers = await User.find({ _id: { $in: userIds }, role: 'admin' });
    if (adminUsers.length > 0) {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }
    
    // Update users who report to deleted users
    await User.updateMany({ reportsTo: { $in: userIds } }, { reportsTo: null });
    
    // Delete users
    const result = await User.deleteMany({ _id: { $in: userIds }, role: { $ne: 'admin' } });
    
    res.json({ message: `${result.deletedCount} users deleted successfully` });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk update role
router.post('/users/bulk-update-role', auth, isAdmin, async (req, res) => {
  try {
    const { userIds, role } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No users selected' });
    }
    
    if (!role || !['ceo', 'hr', 'manager', 'employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    // Don't update admins
    const result = await User.updateMany(
      { _id: { $in: userIds }, role: { $ne: 'admin' } },
      { $set: { role } }
    );
    
    res.json({ message: `${result.modifiedCount} users updated to ${role}` });
  } catch (error) {
    console.error('Bulk update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk update status (activate/deactivate)
router.post('/users/bulk-update-status', auth, isAdmin, async (req, res) => {
  try {
    const { userIds, isActive } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No users selected' });
    }
    
    // Don't update admins
    const result = await User.updateMany(
      { _id: { $in: userIds }, role: { $ne: 'admin' } },
      { $set: { isActive } }
    );
    
    res.json({ message: `${result.modifiedCount} users ${isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    console.error('Bulk update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk update department
router.post('/users/bulk-update-department', auth, isAdmin, async (req, res) => {
  try {
    const { userIds, department } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No users selected' });
    }
    
    // Don't update admins
    const result = await User.updateMany(
      { _id: { $in: userIds }, role: { $ne: 'admin' } },
      { $set: { department } }
    );
    
    res.json({ message: `${result.modifiedCount} users moved to ${department || 'no department'}` });
  } catch (error) {
    console.error('Bulk update department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk assign reportsTo
router.post('/users/bulk-assign-supervisor', auth, isAdmin, async (req, res) => {
  try {
    const { userIds, reportsTo } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No users selected' });
    }
    
    // Don't update admins
    const result = await User.updateMany(
      { _id: { $in: userIds }, role: { $ne: 'admin' } },
      { $set: { reportsTo: reportsTo || null } }
    );
    
    res.json({ message: `${result.modifiedCount} users assigned to supervisor` });
  } catch (error) {
    console.error('Bulk assign supervisor error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get team members (for HR, Manager, Team Lead)
router.get('/my-team', auth, canViewTeam, async (req, res) => {
  try {
    const currentUser = req.currentUser;

    // Supervisor (who current user reports to)
    let supervisor = null;
    if (currentUser.reportsTo) {
      supervisor = await User.findById(currentUser.reportsTo)
        .select('name email role employeeId department designation profilePicUrl');
    }

    // Peers (people who report to the same supervisor as current user)
    let peers = [];
    if (currentUser.reportsTo) {
      peers = await User.find({
        reportsTo: currentUser.reportsTo,
        _id: { $ne: currentUser._id },
        isActive: true,
        role: { $ne: 'admin' },
      })
        .select('-password')
        .populate('reportsTo', 'name email role')
        .populate('manager', 'name department');
    }
    
    // Find all users who report to current user
    const directReports = await User.find({ 
      reportsTo: currentUser._id,
      isActive: true 
    })
    .select('-password')
    .populate('reportsTo', 'name email role')
    .populate('manager', 'name department');
    
    // For HR - also get all employees in the organization
    let allEmployees = [];
    if (currentUser.role === 'hr' || currentUser.role === 'ceo') {
      allEmployees = await User.find({ 
        role: { $in: ['employee', 'manager'] },
        isActive: true 
      })
      .select('-password')
      .populate('reportsTo', 'name email role')
      .populate('manager', 'name department');
    }
    
    res.json({
      currentUser: {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        employeeId: currentUser.employeeId,
        department: currentUser.department,
        designation: currentUser.designation,
        profilePicUrl: currentUser.profilePicUrl,
      },
      supervisor,
      peers,
      directReports,
      allEmployees: currentUser.role === 'hr' || currentUser.role === 'ceo' ? allEmployees : [],
      currentUserRole: currentUser.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get organization hierarchy tree
router.get('/org-hierarchy', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' }, isActive: true })
      .select('name email role employeeId department designation reportsTo')
      .populate('reportsTo', 'name email role')
      .lean();
    
    // Build hierarchy tree
    const buildTree = (users, parentId = null) => {
      return users
        .filter(u => {
          if (parentId === null) {
            return !u.reportsTo;
          }
          return u.reportsTo?._id?.toString() === parentId?.toString();
        })
        .map(u => ({
          ...u,
          subordinates: buildTree(users, u._id),
        }));
    };
    
    const hierarchy = buildTree(users);
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all online users with locations (for map)
router.get('/online-users', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({ isOnline: true })
      .select('email employeeId isOnline lastLocation')
      .lean();
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all attendance records for today
router.get('/today-attendance', auth, isHRorAbove, async (req, res) => {
  try {
    const requestedDate = req.query?.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(requestedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date. Use YYYY-MM-DD.' });
    }
    const today = new Date(requestedDate);
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Filter each user's attendance array down to today's entry inside MongoDB
    // instead of pulling the whole (selfie-laden) history to Node on every poll.
    const users = await User.aggregate([
      { $match: { role: { $nin: ['admin'] } } },
      {
        $project: {
          name: 1, email: 1, employeeId: 1, lastLocation: 1, isOnline: 1,
          manager: 1, role: 1, department: 1, reportsTo: 1, profilePicUrl: 1,
          todayRecord: {
            $first: {
              $filter: {
                input: '$attendance',
                as: 'a',
                cond: { $and: [{ $gte: ['$$a.date', today] }, { $lte: ['$$a.date', endOfDay] }] },
              },
            },
          },
        },
      },
    ]);
    await User.populate(users, [
      { path: 'manager', select: 'name' },
      { path: 'reportsTo', select: 'name role' },
    ]);

    const isAfterMissedPunchOutCutoff = (dayDate, nowDate) => {
      const cutoff = new Date(dayDate);
      cutoff.setHours(23, 59, 59, 999);
      return nowDate.getTime() > cutoff.getTime();
    };

    const now = new Date();
    const todayAttendance = users.map(user => {
      const todayRecord = user.todayRecord || null;

      const status = (() => {
        if (!todayRecord?.punchIn) return 'absent';
        if (!todayRecord?.punchOut) {
          return isAfterMissedPunchOutCutoff(today, now) ? 'missed_punch_out' : 'pending';
        }
        const isIllegal = !!todayRecord.punchOut.isSuspect || todayRecord.punchOut.withinRadius === false;
        return isIllegal ? 'illegal' : 'approved';
      })();
      
      return {
        _id: user._id,
        name: user.name || (user.email ? user.email.split('@')[0] : ''),
        profilePicUrl: user.profilePicUrl || '',
        email: user.email,
        employeeId: user.employeeId,
        managerName: user.manager?.name || '',
        role: user.role,
        department: user.department || '',
        reportsToName: user.reportsTo?.name || '',
        isOnline: user.isOnline,
        lastLocation: user.lastLocation,
        punchIn: todayRecord?.punchIn || null,
        punchOut: todayRecord?.punchOut || null,
        attendanceDate: todayRecord?.date || today,
        status,
      };
    });

    res.json(todayAttendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete attendance selfie (admin only)
router.delete('/attendance-selfie', auth, isHRorAbove, async (req, res) => {
  try {
    const body = req.body || {};
    const query = req.query || {};
    const userId = body.userId || query.userId;
    const dateValue = body.date || query.date;
    const type = (body.type || query.type || '').toLowerCase();

    if (!userId || !dateValue || !['in', 'out'].includes(type)) {
      return res.status(400).json({ message: 'userId, date, and type (in|out) are required' });
    }

    const targetDate = new Date(dateValue);
    if (Number.isNaN(targetDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const record = user.attendance?.find(
      a => new Date(a.date).toDateString() === targetDate.toDateString()
    );

    if (!record) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (type === 'in') {
      if (!record.punchIn?.selfie) {
        return res.status(404).json({ message: 'Punch in selfie not found' });
      }
      record.punchIn.selfie = '';
    } else {
      if (!record.punchOut?.selfie) {
        return res.status(404).json({ message: 'Punch out selfie not found' });
      }
      record.punchOut.selfie = '';
    }

    await user.save();

    res.json({ message: 'Selfie deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get team attendance records for a manager (by date)
router.get('/team-today-attendance', auth, isSupervisor, async (req, res) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser || currentUser.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager only.' });
    }

    const requestedDate = req.query?.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(requestedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date. Use YYYY-MM-DD.' });
    }
    const today = new Date(requestedDate);
    today.setHours(0, 0, 0, 0);

    const users = await User.find({
      reportsTo: currentUser._id,
      isActive: true,
      role: { $nin: ['admin', 'ceo', 'hr'] },
    })
      .select('name email employeeId attendance lastLocation isOnline manager role department reportsTo profilePicUrl')
      .populate('manager', 'name')
      .populate('reportsTo', 'name role')
      .lean();

    const isAfterMissedPunchOutCutoff = (dayDate, nowDate) => {
      const cutoff = new Date(dayDate);
      cutoff.setHours(23, 59, 59, 999);
      return nowDate.getTime() > cutoff.getTime();
    };

    const now = new Date();
    const todayAttendance = users.map(user => {
      const todayRecord = user.attendance?.find(
        a => new Date(a.date).toDateString() === today.toDateString()
      );

      const status = (() => {
        if (!todayRecord?.punchIn) return 'absent';
        if (!todayRecord?.punchOut) {
          return isAfterMissedPunchOutCutoff(today, now) ? 'missed_punch_out' : 'pending';
        }
        const isIllegal = !!todayRecord.punchOut?.isSuspect || todayRecord.punchOut?.withinRadius === false;
        return isIllegal ? 'illegal' : 'approved';
      })();

      return {
        _id: user._id,
        name: user.name || (user.email ? user.email.split('@')[0] : ''),
        profilePicUrl: user.profilePicUrl || '',
        email: user.email,
        employeeId: user.employeeId,
        managerName: user.manager?.name || '',
        role: user.role,
        department: user.department || '',
        reportsToName: user.reportsTo?.name || '',
        isOnline: user.isOnline,
        lastLocation: user.lastLocation,
        punchIn: todayRecord?.punchIn || null,
        punchOut: todayRecord?.punchOut || null,
        status,
      };
    });

    res.json(todayAttendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave summary for dashboard (HR and above)
router.get('/leave-summary', auth, isHRorAbove, async (req, res) => {
  try {
    const now = new Date();
    const day = req.query?.date ? new Date(req.query.date) : now;
    if (Number.isNaN(day.getTime())) {
      return res.status(400).json({ message: 'Invalid date. Use YYYY-MM-DD.' });
    }

    const startOfDay = (d) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const endOfDay = (d) => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    };

    const from = startOfDay(day);
    const to = endOfDay(day);

    // What roles are visible for current user (HR sees employee+manager; CEO/Admin sees everyone below)
    const ROLE_LEVELS = {
      employee: 1,
      manager: 2,
      hr: 3,
      ceo: 4,
      admin: 5,
    };
    const currentRole = req.currentUser?.role || 'hr';
    const currentLevel = ROLE_LEVELS[currentRole] || 0;
    const visibleApplicantRoles = Object.entries(ROLE_LEVELS)
      .filter(([role, level]) => level < currentLevel && role !== 'admin')
      .map(([role]) => role);

    const [onLeaveToday, appliedToday, pending] = await Promise.all([
      Leave.find({
        applicantRole: { $in: visibleApplicantRoles },
        status: 'approved',
        startDate: { $lte: to },
        endDate: { $gte: from },
      })
        .populate('applicant', 'name email employeeId role department')
        .populate('approver', 'name email role')
        .sort({ startDate: 1, createdAt: -1 })
        .lean(),
      Leave.find({
        applicantRole: { $in: visibleApplicantRoles },
        createdAt: { $gte: from, $lte: to },
      })
        .populate('applicant', 'name email employeeId role department')
        .populate('approver', 'name email role')
        .sort({ createdAt: -1 })
        .lean(),
      Leave.find({
        applicantRole: { $in: visibleApplicantRoles },
        status: 'pending',
      })
        .populate('applicant', 'name email employeeId role department')
        .populate('approver', 'name email role')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    res.json({
      date: from.toISOString(),
      counts: {
        onLeaveToday: onLeaveToday.length,
        appliedToday: appliedToday.length,
        pending: pending.length,
      },
      onLeaveToday,
      appliedToday,
      pending,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get attendance by date range
router.get('/attendance-report', auth, isHRorAbove, async (req, res) => {
  try {
    const { mode, month, days } = req.query;
    const range = getAttendanceReportRange({ mode, month, days });

    const users = await User.aggregate([
      { $match: { role: { $nin: ['admin', 'ceo', 'hr'] } } },
      {
        $project: {
          name: 1, email: 1, employeeId: 1, role: 1, department: 1,
          profilePicUrl: 1, manager: 1, reportsTo: 1,
          attendance: {
            $filter: {
              input: { $ifNull: ['$attendance', []] },
              as: 'record',
              cond: {
                $and: [
                  { $gte: ['$$record.date', range.start] },
                  { $lte: ['$$record.date', range.end] },
                ],
              },
            },
          },
        },
      },
    ]);
    await User.populate(users, [
      { path: 'manager', select: 'name' },
      { path: 'reportsTo', select: 'name role' },
    ]);

    const report = buildAttendanceReport({ users, mode, month, days, range });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Manager team attendance report (direct reports only)
router.get('/team-attendance-report', auth, isSupervisor, async (req, res) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser || currentUser.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager only.' });
    }

    const { mode, month, days } = req.query;
    const range = getAttendanceReportRange({ mode, month, days });

    const users = await User.aggregate([
      {
        $match: {
          reportsTo: currentUser._id,
          isActive: true,
          role: { $nin: ['admin', 'ceo', 'hr'] },
        },
      },
      {
        $project: {
          name: 1, email: 1, employeeId: 1, role: 1, department: 1,
          profilePicUrl: 1, manager: 1, reportsTo: 1,
          attendance: {
            $filter: {
              input: { $ifNull: ['$attendance', []] },
              as: 'record',
              cond: {
                $and: [
                  { $gte: ['$$record.date', range.start] },
                  { $lte: ['$$record.date', range.end] },
                ],
              },
            },
          },
        },
      },
    ]);
    await User.populate(users, [
      { path: 'manager', select: 'name' },
      { path: 'reportsTo', select: 'name role' },
    ]);

    const report = buildAttendanceReport({ users, mode, month, days, range });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard stats
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [totalUsers, onlineUsers, roleCounts, punchCountResults] = await Promise.all([
      User.countDocuments({ role: { $nin: ['admin'] } }),
      User.countDocuments({ isOnline: true, role: { $nin: ['admin'] } }),
      User.aggregate([
        { $match: { role: { $nin: ['admin'] } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: { $nin: ['admin'] } } },
        {
          $project: {
            todayRecord: {
              $first: {
                $filter: {
                  input: '$attendance',
                  as: 'a',
                  cond: { $and: [{ $gte: ['$$a.date', today] }, { $lte: ['$$a.date', endOfDay] }] },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            punchedIn: { $sum: { $cond: [{ $ifNull: ['$todayRecord.punchIn', false] }, 1, 0] } },
            punchedOut: { $sum: { $cond: [{ $ifNull: ['$todayRecord.punchOut', false] }, 1, 0] } },
          },
        },
      ]),
    ]);
    const [punchCounts] = punchCountResults;
    const punchedIn = punchCounts?.punchedIn || 0;
    const punchedOut = punchCounts?.punchedOut || 0;

    res.json({
      totalUsers,
      onlineUsers,
      punchedIn,
      punchedOut,
      notPunchedIn: totalUsers - punchedIn,
      roleCounts: roleCounts.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {}),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific user's attendance history (for admin calendar view)
router.get('/user-attendance/:userId', auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('name email employeeId attendance')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return attendance with computed status for each day
    const attendanceWithStatus = (user.attendance || []).map(record => {
      const hasIn = !!record.punchIn?.time;
      const hasOut = !!record.punchOut?.time;
      const isIllegal = hasOut && (record.punchOut?.isSuspect || record.punchOut?.withinRadius === false);
      
      return {
        date: record.date,
        punchIn: record.punchIn,
        punchOut: record.punchOut,
        status: !hasIn ? 'absent' : !hasOut ? 'pending' : isIllegal ? 'illegal' : 'approved',
      };
    });

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
      },
      attendance: attendanceWithStatus,
    });
  } catch (error) {
    console.error('Error fetching user attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ EMPLOYEE PROFILE VERIFICATION (HR) ============

// Get all pending profile verifications (HR view)
router.get('/pending-profiles', auth, isHRorAbove, async (req, res) => {
  try {
    const { status } = req.query; // 'pending', 'approved', 'rejected', 'all'
    
    let query = { role: { $ne: 'admin' } };
    if (status && status !== 'all') {
      query.profileStatus = status;
    } else if (!status) {
      query.profileStatus = 'pending'; // Default to pending
    }

    const profiles = await User.find(query)
      .select('name email employeeId profilePicUrl department designation role profileStatus profileSubmittedAt profileVerifiedAt isVerifiedEmployee createdAt aadharNumber panNumber')
      .sort({ profileSubmittedAt: -1 });

    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get full profile details for verification (HR view)
router.get('/profile-details/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -attendance')
      .populate('reportsTo', 'name email role employeeId')
      .populate('profileVerifiedBy', 'name email role');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve or Reject profile (HR/Admin action with hierarchy)
// HR can approve: employee, manager profiles
// Admin can approve: HR profiles (and all others)
router.put('/verify-profile/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'
    
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Use "approve" or "reject"' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.profileStatus !== 'pending') {
      return res.status(400).json({ message: 'Profile is not pending verification' });
    }

    // Get current user (approver)
    const approver = await User.findById(req.user.userId);
    
    // Hierarchy check: HR can approve employee/manager, Admin can approve HR (and all)
    // HR profile can ONLY be approved by Admin
    if (targetUser.role === 'hr' && approver.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Only Admin can approve/reject HR profiles' 
      });
    }
    
    // CEO profile can ONLY be approved by Admin
    if (targetUser.role === 'ceo' && approver.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Only Admin can approve/reject CEO profiles' 
      });
    }

    if (action === 'approve') {
      targetUser.profileStatus = 'approved';
      targetUser.isVerifiedEmployee = true;
      targetUser.profileVerifiedAt = new Date();
      targetUser.profileVerifiedBy = req.user.userId;
      targetUser.rejectionReason = '';

      // Create notification
      await Notification.create({
        recipient: targetUser._id,
        type: 'profile_approved',
        title: 'Profile Verified ✓',
        message: `Your profile has been verified by ${approver.role === 'admin' ? 'Admin' : approver.name}`,
        category: 'profile',
        data: {
          senderId: approver._id,
          senderName: approver.name,
        }
      });

      try {
        if (targetUser.email) {
          const { subject, html, text } = profileStatusEmail({
            userName: targetUser.name || targetUser.email?.split('@')[0],
            status: 'approved',
            reviewerName: approver.name || 'HR',
          });
          await sendEmail({ to: targetUser.email, subject, html, text });
        }
      } catch (mailError) {
        console.error('Profile approved email failed:', mailError.message);
      }
    } else {
      if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }
      targetUser.profileStatus = 'rejected';
      targetUser.isVerifiedEmployee = false;
      targetUser.rejectionReason = rejectionReason;
      targetUser.profileVerifiedBy = req.user.userId;

      // Create notification
      await Notification.create({
        recipient: targetUser._id,
        type: 'profile_rejected',
        title: 'Profile Rejected',
        message: `Your profile was rejected: ${rejectionReason}`,
        category: 'profile',
        data: {
          senderId: approver._id,
          senderName: approver.name,
        }
      });

      try {
        if (targetUser.email) {
          const { subject, html, text } = profileStatusEmail({
            userName: targetUser.name || targetUser.email?.split('@')[0],
            status: 'rejected',
            reviewerName: approver.name || 'HR',
            rejectionReason,
          });
          await sendEmail({ to: targetUser.email, subject, html, text });
        }
      } catch (mailError) {
        console.error('Profile rejected email failed:', mailError.message);
      }
    }

    await targetUser.save();

    res.json({
      message: action === 'approve' 
        ? 'Profile approved! Employee is now verified.' 
        : 'Profile rejected. Employee will be notified.',
      profileStatus: targetUser.profileStatus,
      isVerifiedEmployee: targetUser.isVerifiedEmployee,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get verification stats (HR dashboard)
router.get('/verification-stats', auth, isHRorAbove, async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { role: { $ne: 'admin' } } },
      {
        $group: {
          _id: '$profileStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    };

    stats.forEach(s => {
      if (s._id) result[s._id] = s.count;
      result.total += s.count;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unlock profile for editing (HR can unlock approved profiles)
router.put('/unlock-profile/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.profileStatus !== 'approved') {
      return res.status(400).json({ message: 'Profile is not in approved/locked state' });
    }

    // Get current user (unlocker)
    const unlocker = await User.findById(req.user.userId);
    
    // Hierarchy check: HR can unlock employee/manager, Admin can unlock HR/CEO
    if ((targetUser.role === 'hr' || targetUser.role === 'ceo') && unlocker.role !== 'admin') {
      return res.status(403).json({ 
        message: `Only Admin can unlock ${targetUser.role.toUpperCase()} profiles` 
      });
    }

    // Set status to 'draft' so user can edit and resubmit
    targetUser.profileStatus = 'draft';
    targetUser.profileUnlockedAt = new Date();
    targetUser.profileUnlockedBy = req.user.userId;
    
    await targetUser.save();

    // Create notification
    await Notification.create({
      recipient: targetUser._id,
      type: 'profile_unlocked',
      title: 'Profile Unlocked',
      message: `Your profile has been unlocked by ${unlocker.role === 'admin' ? 'Admin' : unlocker.name}. You can now edit and resubmit.`,
      category: 'profile',
      data: {
        senderId: unlocker._id,
        senderName: unlocker.name,
      }
    });

    res.json({
      message: 'Profile unlocked! User can now edit and resubmit for verification.',
      profileStatus: targetUser.profileStatus,
    });
  } catch (error) {
    console.error('Unlock profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== OT MANAGEMENT =====
const buildOvertimeList = ({ users, statusFilter = 'all' }) => {
  const list = [];
  const statusKey = String(statusFilter || 'all').toLowerCase();

  users.forEach((user) => {
    const attendance = Array.isArray(user.attendance) ? user.attendance : [];
    attendance.forEach((rec) => {
      if (!rec?.punchOut?.time) return;
      const otMinutes = typeof rec.punchOut.overtimeMinutes === 'number' ? rec.punchOut.overtimeMinutes : 0;
      if (otMinutes <= 0) return;

      const status = rec.punchOut.overtimeStatus || (otMinutes > 0 ? 'pending' : 'none');
      if (statusKey !== 'all' && status !== statusKey) return;

      const adjusted = typeof rec.punchOut.overtimeAdjustedMinutes === 'number'
        ? rec.punchOut.overtimeAdjustedMinutes
        : null;

      const finalMinutes = status === 'approved'
        ? (typeof adjusted === 'number' ? adjusted : otMinutes)
        : 0;

      list.push({
        userId: user._id,
        attendanceId: rec._id,
        date: rec.date,
        punchInTime: rec.punchIn?.time || null,
        punchOutTime: rec.punchOut?.time || null,
        overtimeMinutes: otMinutes,
        overtimeAdjustedMinutes: adjusted,
        overtimeFinalMinutes: finalMinutes,
        overtimeStatus: status,
        overtimeAdjustmentNote: rec.punchOut?.overtimeAdjustmentNote || '',
        employeeId: user.employeeId,
        name: user.name || (user.email ? user.email.split('@')[0] : ''),
        email: user.email,
        role: user.role,
        department: user.department || '',
        managerName: user.manager?.name || '',
        reportsToName: user.reportsTo?.name || '',
      });
    });
  });

  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Get OT list for HR/Admin/CEO
router.get('/ot-requests', auth, isHRorAbove, async (req, res) => {
  try {
    const statusFilter = req.query?.status || 'all';
    const users = await User.find({ role: { $nin: ['admin'] } })
      .select('name email employeeId role department attendance manager reportsTo')
      .populate('manager', 'name')
      .populate('reportsTo', 'name')
      .lean();

    const list = buildOvertimeList({ users, statusFilter });
    res.json({ items: list });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get OT list for Manager (team only)
router.get('/team-ot-requests', auth, isSupervisor, async (req, res) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser || currentUser.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager only.' });
    }

    const statusFilter = req.query?.status || 'all';
    const users = await User.find({ reportsTo: currentUser._id, isActive: true })
      .select('name email employeeId role department attendance manager reportsTo')
      .populate('manager', 'name')
      .populate('reportsTo', 'name')
      .lean();

    const list = buildOvertimeList({ users, statusFilter });
    res.json({ items: list });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update OT approval/adjustment
router.patch('/ot-requests/:userId/:attendanceId', auth, isSupervisor, async (req, res) => {
  try {
    const { userId, attendanceId } = req.params;
    const { status, adjustedMinutes, note } = req.body || {};

    const currentUser = req.currentUser;
    if (!currentUser) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Manager can only manage direct reports
    if (currentUser.role === 'manager' && String(targetUser.reportsTo) !== String(currentUser._id)) {
      return res.status(403).json({ message: 'Access denied. Team members only.' });
    }

    const rec = targetUser.attendance.id(attendanceId);
    if (!rec || !rec.punchOut) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const nextStatus = status || rec.punchOut.overtimeStatus || (rec.punchOut.overtimeMinutes > 0 ? 'pending' : 'none');
    if (!['pending', 'approved', 'rejected', 'none'].includes(nextStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    if (typeof adjustedMinutes === 'number') {
      rec.punchOut.overtimeAdjustedMinutes = Math.max(0, Math.floor(adjustedMinutes));
    }
    if (typeof note === 'string') {
      rec.punchOut.overtimeAdjustmentNote = note;
    }

    rec.punchOut.overtimeStatus = nextStatus;
    if (nextStatus === 'approved' || nextStatus === 'rejected') {
      rec.punchOut.overtimeApprovedBy = currentUser._id;
      rec.punchOut.overtimeApprovedAt = new Date();
    }

    await targetUser.save();

    if (nextStatus === 'approved' || nextStatus === 'rejected') {
      await Notification.create({
        recipient: targetUser._id,
        type: nextStatus === 'approved' ? 'ot_approved' : 'ot_rejected',
        title: nextStatus === 'approved' ? 'OT Approved' : 'OT Rejected',
        message: nextStatus === 'approved'
          ? 'Your OT request has been approved.'
          : 'Your OT request has been rejected.',
        category: 'attendance',
        data: {
          senderId: currentUser._id,
          senderName: currentUser.name,
          attendanceId: rec._id,
        },
      });
    }

    res.json({ message: 'OT updated', attendance: rec });
  } catch (error) {
    console.error('OT update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending user activations (HR/Admin only)
router.get('/pending-activations', auth, isHRorAbove, async (req, res) => {
  try {
    const pendingUsers = await User.find({
      isActive: false,
      $or: [
        { activationStatus: { $ne: 'rejected' } },
        { activationStatus: { $exists: false } },
      ],
    })
      .select('name email employeeId department reportsTo salaryStructure createdAt')
      .populate('reportsTo', 'name email employeeId role')
      .sort({ createdAt: -1 });

    res.json({ users: pendingUsers });
  } catch (error) {
    console.error('Pending activations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Activate/Deactivate user account (HR/Admin only)
router.put('/activate-user/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const { userId } = req.params;
    const { activate, reportsTo, salaryStructure } = req.body; // true to activate, false to deactivate

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = activate === true;
    user.activationStatus = activate === true ? 'approved' : 'rejected';
    
    // Update manager if provided
    if (reportsTo) {
      user.reportsTo = reportsTo;
    }

    if (salaryStructure && typeof salaryStructure === 'object') {
      user.salaryStructure = {
        ...user.salaryStructure,
        ...salaryStructure,
      };
    }
    
    await user.save();

    // Send notification to user
    await Notification.create({
      recipient: user._id,
      type: 'system',
      title: activate ? 'Account Activated' : 'Account Deactivated',
      message: activate
        ? 'Your account has been activated. You can now login.'
        : 'Your account has been deactivated. Please contact HR.',
      category: 'system',
      data: {
        activatedBy: req.currentUser._id,
        activatedByName: req.currentUser.name,
      },
    });

    try {
      if (user.email) {
        const { subject, html, text } = accountStatusEmail({
          userName: user.name || user.email?.split('@')[0],
          active: user.isActive,
          activatedBy: req.currentUser?.name || 'HR',
        });
        await sendEmail({ to: user.email, subject, html, text });
      }
    } catch (mailError) {
      console.error('Account status email failed:', mailError.message);
    }

    res.json({ 
      message: activate ? 'User activated successfully' : 'User deactivated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      }
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get salary structure for a user (HR/Admin only)
router.get('/salary/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('salaryStructure');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ salaryStructure: user.salaryStructure || {} });
  } catch (error) {
    console.error('Salary fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update salary structure for a user (HR/Admin only)
router.put('/salary/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const { salaryStructure } = req.body;
    if (!salaryStructure || typeof salaryStructure !== 'object') {
      return res.status(400).json({ message: 'Invalid salary structure' });
    }
    user.salaryStructure = {
      ...user.salaryStructure,
      ...salaryStructure,
    };
    await user.save();
    res.json({ message: 'Salary structure updated', salaryStructure: user.salaryStructure });
  } catch (error) {
    console.error('Salary update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get users for payslip management (HR/Admin only)
router.get('/payslip-users', auth, isHRorAbove, async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name email employeeId department designation bankName accountNumber pfAccountNumber panNumber uanNumber esiNumber workLocation city salaryStructure payslipApprovals payslipSalaries payslipAccessEnabled')
      .sort({ name: 1 });

    res.json({ users });
  } catch (error) {
    console.error('Payslip users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enable/Disable payslip access for a user (HR/Admin only)
router.put('/payslip-access/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'Invalid enabled flag' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.payslipAccessEnabled = enabled;
    await user.save();
    res.json({ message: 'Payslip access updated', payslipAccessEnabled: user.payslipAccessEnabled });
  } catch (error) {
    console.error('Payslip access update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payslip salary structure for a specific month (HR/Admin only)
router.get('/payslip-salary/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const { month } = req.query || {};
    if (!month || !/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      return res.status(400).json({ message: 'Invalid month' });
    }

    const user = await User.findById(req.params.userId)
      .select('payslipSalaries salaryStructure');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const match = (user.payslipSalaries || []).find((m) => m?.month === month);
    res.json({
      month,
      salaryStructure: match?.salaryStructure || null,
      fallbackSalaryStructure: user.salaryStructure || {},
    });
  } catch (error) {
    console.error('Payslip salary fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update payslip salary structure for a specific month (HR/Admin only)
router.put('/payslip-salary/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const { month, salaryStructure } = req.body || {};
    if (!month || !/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      return res.status(400).json({ message: 'Invalid month' });
    }
    if (!salaryStructure || typeof salaryStructure !== 'object') {
      return res.status(400).json({ message: 'Invalid salary structure' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingIndex = user.payslipSalaries.findIndex((m) => m.month === month);
    const entry = {
      month,
      salaryStructure: {
        ...user.salaryStructure,
        ...salaryStructure,
      },
      updatedAt: new Date(),
      updatedBy: req.user.userId,
    };

    if (existingIndex >= 0) {
      user.payslipSalaries[existingIndex] = { ...user.payslipSalaries[existingIndex].toObject?.() || user.payslipSalaries[existingIndex], ...entry };
    } else {
      user.payslipSalaries.push(entry);
    }

    await user.save();
    res.json({ message: 'Payslip salary updated', payslipSalaries: user.payslipSalaries });
  } catch (error) {
    console.error('Payslip salary update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update payslip profile details (HR/Admin only)
router.put('/payslip-profile/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allowedFields = [
      'designation',
      'bankName',
      'accountNumber',
      'pfAccountNumber',
      'panNumber',
      'uanNumber',
      'esiNumber',
      'workLocation',
      'city',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    res.json({
      message: 'Payslip profile updated',
      user: {
        _id: user._id,
        name: user.name,
        employeeId: user.employeeId,
        designation: user.designation,
        bankName: user.bankName,
        accountNumber: user.accountNumber,
        pfAccountNumber: user.pfAccountNumber,
        panNumber: user.panNumber,
        uanNumber: user.uanNumber,
        esiNumber: user.esiNumber,
        workLocation: user.workLocation,
        city: user.city,
      },
    });
  } catch (error) {
    console.error('Payslip profile update error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Update payslip settings (HR/Admin only)
router.put('/payslip-settings/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { mode, delayMonths } = req.body || {};
    if (mode && !['locked', 'unlocked'].includes(mode)) {
      return res.status(400).json({ message: 'Invalid mode' });
    }

    if (mode) user.payslipSettings.mode = mode;
    if (typeof delayMonths === 'number' && delayMonths >= 0) {
      user.payslipSettings.delayMonths = Math.floor(delayMonths);
    }

    await user.save();
    res.json({ message: 'Payslip settings updated', payslipSettings: user.payslipSettings });
  } catch (error) {
    console.error('Payslip settings update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/Unapprove payslip for a month (HR/Admin only)
router.post('/payslip-approval/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { month, approved } = req.body || {};
    if (!month || !/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      return res.status(400).json({ message: 'Invalid month' });
    }

    const existingIndex = user.payslipApprovals.findIndex((m) => m.month === month);
    const approvedFlag = approved === true;
    if (existingIndex >= 0) {
      user.payslipApprovals[existingIndex].approved = approvedFlag;
      user.payslipApprovals[existingIndex].approvedAt = approvedFlag ? new Date() : null;
    } else {
      user.payslipApprovals.push({
        month,
        approved: approvedFlag,
        approvedAt: approvedFlag ? new Date() : null,
      });
    }

    await user.save();
    res.json({ message: 'Payslip approval updated', payslipApprovals: user.payslipApprovals });
  } catch (error) {
    console.error('Payslip approval error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const getSalaryForMonth = (user, monthKey) => {
  const list = user.payslipSalaries || [];
  const match = list.find((m) => m?.month === monthKey);
  return match?.salaryStructure || user.salaryStructure || {};
};

// Generate pay slip (HR/Admin only)
router.get('/payslip/:userId', auth, isHRorAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      'name employeeId dateOfJoining designation panNumber bankName accountNumber pfAccountNumber workLocation city uanNumber esiNumber salaryStructure payslipSalaries'
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const templatePath = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'Pay Slip Format.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ message: 'Pay slip template not found' });
    }

    const monthParam = req.query.month || '';
    const paidDaysParam = req.query.paidDays || '';
    const monthDate = monthParam ? new Date(`${monthParam}-01T00:00:00`) : new Date();
    const monthLabel = getMonthLabel(monthDate) || getMonthLabel(new Date());
    const paidDays = Number(paidDaysParam) || new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

    const salary = getSalaryForMonth(user, monthParam || getMonthKey(monthDate));
    const basisSalary = Number(salary.basisSalary || 0);
    const houseRentAllowance = Number(salary.houseRentAllowance || 0);
    const medicalAllowance = Number(salary.medicalAllowance || 0);
    const educationAllowance = Number(salary.educationAllowance || 0);
    const otherAllowance = Number(salary.otherAllowance || 0);
    const epf = Number(salary.epf || 0);
    const esic = Number(salary.esic || 0);
    const tds = Number(salary.tds || 0);
    const otherDeductions = Number(salary.otherDeductions || 0);

    const totalEarningsRaw = basisSalary + houseRentAllowance + medicalAllowance + educationAllowance + otherAllowance;
    const totalDeductionsRaw = epf + esic + tds + otherDeductions;
    const totalEarnings = getOverrideValue(salary.totalEarningsOverride, totalEarningsRaw);
    const totalDeductions = getOverrideValue(salary.totalDeductionsOverride, totalDeductionsRaw);
    const netPay = getOverrideValue(salary.netPayOverride, Math.max(0, totalEarnings - totalDeductions));
    const netPayWords = `${titleCaseWords(toWords(Math.round(netPay)))} Rupees`;

    const docBuffer = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(docBuffer);
    const xml = await zip.file('word/document.xml').async('string');

    let updatedXml = xml;
    updatedXml = updatedXml.split('JHKRBIM0060').join(user.employeeId || '');
    updatedXml = updatedXml.split('Rupesh K.').join(user.name || '');
    updatedXml = updatedXml.split('07-10-2023').join(user.dateOfJoining ? new Date(user.dateOfJoining).toLocaleDateString('en-GB') : '');
    updatedXml = updatedXml.split('Sr. Bim Engineer').join(user.designation || '');
    updatedXml = updatedXml.split('EJXPR1201J').join(user.panNumber || '');
    updatedXml = updatedXml.split('Axis Bank Ltd.').join(user.bankName || '');
    updatedXml = updatedXml.split('921010020740710').join(user.accountNumber || '');
    updatedXml = updatedXml.split('Navi Mumbai').join(user.workLocation || user.city || '');
    updatedXml = updatedXml.split('Mar-2024').join(monthLabel);
    updatedXml = replaceFirst(updatedXml, '<w:t>31</w:t>', `<w:t>${paidDays}</w:t>`);

    updatedXml = replaceNth(updatedXml, '<w:t>---------</w:t>', `<w:t>${user.pfAccountNumber || '---------'}</w:t>`, 1);
    updatedXml = replaceNth(updatedXml, '<w:t>---------</w:t>', `<w:t>${user.uanNumber || '---------'}</w:t>`, 2);
    updatedXml = replaceNth(updatedXml, '<w:t>---------</w:t>', `<w:t>${user.esiNumber || '---------'}</w:t>`, 3);

    updatedXml = updatedXml.split('                35000').join(`                ${formatPlain(basisSalary)}`);
    updatedXml = updatedXml.split('                15000').join(`                ${formatPlain(houseRentAllowance)}`);
    updatedXml = updatedXml.split('                4500').join(`                ${formatPlain(medicalAllowance)}`);
    updatedXml = updatedXml.split('                24169').join(`                ${formatPlain(otherAllowance)}`);

    const eduValue = educationAllowance > 0 ? formatPlain(educationAllowance) : '*****';
    updatedXml = updatedXml.split('Education Allowance                           *****').join(`Education Allowance                           ${eduValue}`);

    updatedXml = replaceNth(updatedXml, '<w:t>*****</w:t>', `<w:t>${epf > 0 ? formatPlain(epf) : '*****'}</w:t>`, 1);
    updatedXml = replaceNth(updatedXml, '<w:t>*****</w:t>', `<w:t>${formatPlain(esic)}</w:t>`, 2);
    updatedXml = replaceNth(updatedXml, '<w:t>*****</w:t>', `<w:t>${tds > 0 ? formatPlain(tds) : '*****'}</w:t>`, 3);
    updatedXml = replaceNth(updatedXml, '<w:t>*****</w:t>', `<w:t>${formatPlain(otherDeductions)}</w:t>`, 4);

    updatedXml = replaceDeductionByLabel(updatedXml, 'EPF', epf);
    updatedXml = replaceDeductionByLabel(updatedXml, 'ESIC', esic);
    updatedXml = replaceDeductionByLabel(updatedXml, 'TDS', tds);
    updatedXml = replaceDeductionByLabel(updatedXml, 'OTHER DEDUCTIONS', otherDeductions);

    updatedXml = updatedXml.split('TOTAL: 78,669.00').join(`TOTAL: ${formatAmount(totalEarnings)}`);
    updatedXml = updatedXml.split('TOTAL:                                                                      00.00').join(`TOTAL:                                                                      ${formatAmount(totalDeductions)}`);
    updatedXml = updatedXml.split('Net Pay: Seventy Eight Thousand Six Hundred Sixty Nine Rupees').join(`Net Pay: ${netPayWords}`);
    updatedXml = replaceTotalsAndNetPay(updatedXml, { totalEarnings, totalDeductions, netPayWords });

    zip.file('word/document.xml', updatedXml);
    const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=PaySlip-${user.employeeId || 'employee'}-${monthLabel}.docx`);
    res.send(outputBuffer);
  } catch (error) {
    console.error('Payslip generation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== Password Reset Requests (Admin) =====
router.get('/password-reset-requests', auth, isAdmin, async (req, res) => {
  try {
    const requests = await PasswordResetRequest.find({ status: 'pending' })
      .populate('user', 'name email employeeId role')
      .sort({ requestedAt: -1 });
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/password-reset-requests/:id/approve', auth, isAdmin, async (req, res) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id).populate('user');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });

    const tempPassword = generateTempPassword(8);
    const user = await User.findById(request.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = tempPassword;
    await user.save();

    request.status = 'approved';
    request.processedAt = new Date();
    request.processedBy = req.user.userId;
    request.note = 'Temporary password issued';
    await request.save();

    await Notification.create({
      recipient: user._id,
      type: 'password_reset_ready',
      title: 'Temporary Password Issued',
      message: `Your temporary password is: ${tempPassword}. Use it as Old Password and change your password immediately.`,
      category: 'system',
      data: { senderId: req.user.userId, senderName: 'Admin' },
    });

    try {
      if (user.email) {
        const { subject, html, text } = tempPasswordEmail({
          userName: user.name || user.email?.split('@')[0],
          tempPassword,
          purpose: 'a temporary password has been issued for your account',
        });
        await sendEmail({ to: user.email, subject, html, text });
      }
    } catch (mailError) {
      console.error('Temp password email failed:', mailError.message);
    }

    res.json({ message: 'Password reset approved', tempPassword });
  } catch (error) {
    console.error('Approve password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/password-reset-requests/:id/reject', auth, isAdmin, async (req, res) => {
  try {
    const { note } = req.body;
    const request = await PasswordResetRequest.findById(req.params.id).populate('user');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });

    request.status = 'rejected';
    request.processedAt = new Date();
    request.processedBy = req.user.userId;
    request.note = note || 'Rejected by admin';
    await request.save();

    await Notification.create({
      recipient: request.user._id,
      type: 'password_reset_rejected',
      title: 'Password Reset Rejected',
      message: note ? `Your password reset request was rejected: ${note}` : 'Your password reset request was rejected.',
      category: 'system',
      data: { senderId: req.user.userId, senderName: 'Admin' },
    });

    res.json({ message: 'Password reset rejected' });
  } catch (error) {
    console.error('Reject password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
