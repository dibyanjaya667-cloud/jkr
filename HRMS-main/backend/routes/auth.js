const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const JSZip = require('jszip');
const { toWords } = require('number-to-words');
const User = require('../models/User');
const Notification = require('../models/Notification');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { sendEmail } = require('../services/email');
const { emailVerifiedEmail, passwordChangedEmail, otpVerificationEmail } = require('../services/emailTemplates');

const router = express.Router();

const PROFILE_PICS_DIR = path.join(__dirname, '..', 'uploads', 'profile-pics');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PROFILE_PICS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${req.user.userId}-${Date.now()}${safeExt}`);
  },
});

const uploadProfilePic = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (mime.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

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

const OTP_TTL_MINUTES = 10;

const generateEmailOtp = () => (
  Math.floor(100000 + Math.random() * 900000).toString()
);

const hashEmailOtp = (otp) => {
  const salt = process.env.JWT_SECRET || 'otp';
  return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
};

const sendVerificationEmail = async (user, otp) => {
  const { subject, html, text } = otpVerificationEmail({
    userName: user.name || user.email?.split('@')[0],
    otp,
    expiresInMinutes: OTP_TTL_MINUTES,
  });

  return sendEmail({ to: user.email, subject, html, text });
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

const isValidMonthKey = (value) => (/^\d{4}-\d{2}$/.test(String(value || '')));

const parseMonthKey = (monthKey) => {
  if (!isValidMonthKey(monthKey)) return null;
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const date = new Date(year, monthIndex, 1);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getAllowedMonthKey = () => {
  const delay = 2; // Payslip is available after 2 months from paid month
  const base = new Date();
  base.setMonth(base.getMonth() - Math.max(0, delay));
  return getMonthKey(base);
};

const isMonthAllowedForUser = (user, monthKey) => {
  if (!isValidMonthKey(monthKey)) return false;
  const allowedKey = getAllowedMonthKey();
  const allowedDate = parseMonthKey(allowedKey);
  const requestedDate = parseMonthKey(monthKey);
  if (!allowedDate || !requestedDate) return false;
  return requestedDate.getTime() <= allowedDate.getTime();
};

const getEligiblePayslipMonth = (user) => {
  const approvals = (user.payslipApprovals || [])
    .filter(a => a?.approved && isValidMonthKey(a?.month));
  if (approvals.length === 0) return null;

  const allowedKey = getAllowedMonthKey();
  const allowedDate = allowedKey ? parseMonthKey(allowedKey) : null;

  const filtered = approvals.filter(a => {
    if (!allowedDate) return true;
    const d = parseMonthKey(a.month);
    return d && d.getTime() <= allowedDate.getTime();
  });

  if (filtered.length === 0) return null;
  filtered.sort((a, b) => parseMonthKey(b.month).getTime() - parseMonthKey(a.month).getTime());
  return filtered[0].month;
};

const getSalaryForMonth = (user, monthKey) => {
  if (!isValidMonthKey(monthKey)) return user.salaryStructure || {};
  const list = user.payslipSalaries || [];
  const match = list.find((m) => m?.month === monthKey);
  return match?.salaryStructure || user.salaryStructure || {};
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, employeeId, reportsTo, manager, department } = req.body;

    // Validation
    if (!email || !password || !employeeId || !reportsTo || !department) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if employee ID exists
    const employeeExists = await User.findOne({ employeeId });
    if (employeeExists) {
      return res.status(400).json({ message: 'Employee ID already registered' });
    }

    const otp = generateEmailOtp();
    const otpHash = hashEmailOtp(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Create user (isActive defaults to false - needs HR activation)
    const user = new User({
      name,
      email,
      password,
      employeeId,
      reportsTo,
      department,
      manager: manager || null,
      isActive: false,
      emailVerified: false,
      emailOtpHash: otpHash,
      emailOtpExpiresAt: otpExpiresAt,
      emailOtpSentAt: new Date(),
    });

    await user.save();

    let otpSent = true;
    try {
      await sendVerificationEmail(user, otp);
    } catch (mailError) {
      otpSent = false;
      console.error('Register email send failed:', mailError.message || mailError);
    }

    res.status(201).json({
      message: otpSent
        ? 'Registration successful. Verify your email with the OTP sent to your inbox.'
        : 'Registration successful. OTP could not be sent. Please use Resend OTP.',
      otpSent,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        department: user.department,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.emailVerified) return res.json({ message: 'Email already verified' });

    if (!user.emailOtpHash || !user.emailOtpExpiresAt) {
      return res.status(400).json({ message: 'OTP not found. Please request a new code.' });
    }
    if (new Date() > new Date(user.emailOtpExpiresAt)) {
      return res.status(400).json({ message: 'OTP expired. Please request a new code.' });
    }

    const incomingHash = hashEmailOtp(String(otp));
    if (incomingHash !== user.emailOtpHash) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.emailVerified = true;
    user.emailOtpHash = '';
    user.emailOtpExpiresAt = null;
    await user.save();

    try {
      const { subject, html, text } = emailVerifiedEmail({
        userName: user.name || user.email?.split('@')[0],
      });
      await sendEmail({ to: user.email, subject, html, text });
    } catch (mailError) {
      console.error('Email verified notification failed:', mailError.message);
    }

    return res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/resend-email-otp', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.emailVerified) return res.json({ message: 'Email already verified' });

    const otp = generateEmailOtp();
    user.emailOtpHash = hashEmailOtp(otp);
    user.emailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    user.emailOtpSentAt = new Date();
    await user.save();

    let otpSent = true;
    try {
      await sendVerificationEmail(user, otp);
    } catch (mailError) {
      otpSent = false;
      console.error('Resend OTP email failed:', mailError.message || mailError);
    }

    return res.json({
      message: otpSent ? 'OTP sent successfully' : 'OTP saved. Email failed, try again later.',
      otpSent,
    });
  } catch (error) {
    console.error('Resend email OTP error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Upload / set profile picture
router.post('/profile-pic', authMiddleware, uploadProfilePic.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const relativeUrl = `/uploads/profile-pics/${req.file.filename}`;
    user.profilePicUrl = relativeUrl;
    await user.save();

    res.json({
      message: 'Profile picture updated',
      profilePicUrl: relativeUrl,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set profile picture by URL (external storage)
router.post('/profile-pic-url', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string' || !isHttpUrl(url)) {
      return res.status(400).json({ message: 'Valid URL is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profilePicUrl = url;
    await user.save();

    res.json({
      message: 'Profile picture updated',
      profilePicUrl: url,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).populate('manager');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        emailNotVerified: true,
      });
    }

    // Check if account is activated
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Your account is pending HR activation. Please contact HR department.',
        accountPending: true 
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        profilePicUrl: user.profilePicUrl,
        email: user.email,
        employeeId: user.employeeId,
        manager: user.manager,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Request password reset (no auth)
router.post('/password-reset-request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return res.json({ message: 'If the account exists, a reset request has been sent.' });
    }

    const existing = await PasswordResetRequest.findOne({ user: user._id, status: 'pending' });
    if (existing) {
      return res.json({ message: 'A password reset request is already pending.' });
    }

    const request = await PasswordResetRequest.create({
      user: user._id,
      email: user.email,
      status: 'pending',
    });

    const admins = await User.find({ role: 'admin' }).select('_id name').lean();
    await Promise.all(
      admins.map((a) => Notification.create({
        recipient: a._id,
        type: 'password_reset_requested',
        title: 'Password Reset Request',
        message: `${user.name || user.email} requested a password reset.`,
        category: 'system',
        data: {
          senderId: user._id,
          senderName: user.name || user.email,
          actionUrl: '/admin',
        },
      }))
    );

    res.json({ message: 'Reset request submitted', requestId: request._id });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change password (auth required)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new passwords are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await user.matchPassword(oldPassword);
    if (!ok) return res.status(400).json({ message: 'Old password is incorrect' });

    user.password = newPassword;
    await user.save();

    try {
      const { subject, html, text } = passwordChangedEmail({
        userName: user.name || user.email?.split('@')[0],
        changedAt: new Date(),
      });
      await sendEmail({ to: user.email, subject, html, text });
    } catch (mailError) {
      console.error('Password changed email failed:', mailError.message);
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password -attendance')
      .populate('manager')
      .populate('reportsTo', 'name email role profilePicUrl');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('settings');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ settings: user.settings || {} });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user settings
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const next = req.body || {};
    user.settings = {
      notificationsEnabled: typeof next.notificationsEnabled === 'boolean'
        ? next.notificationsEnabled
        : user.settings?.notificationsEnabled ?? true,
      emailAlerts: typeof next.emailAlerts === 'boolean'
        ? next.emailAlerts
        : user.settings?.emailAlerts ?? false,
      privacy: {
        showProfileToTeam: typeof next?.privacy?.showProfileToTeam === 'boolean'
          ? next.privacy.showProfileToTeam
          : user.settings?.privacy?.showProfileToTeam ?? true,
        showOnlineStatus: typeof next?.privacy?.showOnlineStatus === 'boolean'
          ? next.privacy.showOnlineStatus
          : user.settings?.privacy?.showOnlineStatus ?? true,
        shareLocation: typeof next?.privacy?.shareLocation === 'boolean'
          ? next.privacy.shareLocation
          : user.settings?.privacy?.shareLocation ?? false,
      },
    };

    await user.save();
    res.json({ message: 'Settings updated', settings: user.settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Payslip availability for current user
router.get('/payslip-availability', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('payslipSettings payslipApprovals');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const eligibleMonth = getEligiblePayslipMonth(user);
    if (!eligibleMonth) {
      return res.json({ canDownload: false, month: null });
    }
    res.json({ canDownload: true, month: eligibleMonth });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate pay slip for current user
router.get('/payslip', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      'name employeeId dateOfJoining designation panNumber bankName accountNumber pfAccountNumber workLocation city uanNumber esiNumber salaryStructure payslipApprovals payslipSalaries'
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const templatePath = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'Pay Slip Format.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ message: 'Pay slip template not found' });
    }

    const requestedMonth = isValidMonthKey(req.query.month) ? req.query.month : null;
    const eligibleMonth = getEligiblePayslipMonth(user);
    const monthToServe = requestedMonth || eligibleMonth;
    if (!monthToServe) {
      return res.status(403).json({ message: 'Payslip not approved for release' });
    }
    if (!isMonthAllowedForUser(user, monthToServe)) {
      return res.status(403).json({ message: 'Payslip is locked for this month' });
    }
    if (requestedMonth) {
      const isApproved = (user.payslipApprovals || []).some(a => a?.month === requestedMonth && a?.approved === true);
      if (!isApproved) {
        return res.status(403).json({ message: 'Payslip not approved for release' });
      }
    }

    const paidDaysParam = req.query.paidDays || '';
    const monthDate = new Date(`${monthToServe}-01T00:00:00`);
    const monthLabel = getMonthLabel(monthDate) || getMonthLabel(new Date());
    const paidDays = Number(paidDaysParam) || new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

    const salary = getSalaryForMonth(user, monthToServe);
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
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Update user profile details
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if profile is already submitted/pending/approved - cannot edit
    if (user.profileStatus === 'pending' || user.profileStatus === 'approved') {
      return res.status(403).json({ 
        message: 'Profile is locked. Cannot edit after submission.',
        profileStatus: user.profileStatus 
      });
    }

    // Fields that can be updated by user
    const allowedFields = [
      // Personal Info
      'name', 'dateOfBirth', 'gender', 'bloodGroup', 'maritalStatus', 'nationality',
      'department',
      // Contact Info
      'phone', 'alternatePhone', 'personalEmail', 'currentAddress', 'permanentAddress',
      'city', 'state', 'pincode',
      // Identity Documents (numbers only, not verified)
      'aadharNumber', 'panNumber', 'passportNumber', 'drivingLicense', 'voterId',
      // Bank Details
      'bankName', 'accountNumber', 'ifscCode', 'uanNumber', 'esiNumber',
      // Emergency Contact
      'emergencyContact',
      // Education & Experience
      'education', 'experience',
    ];

    // Update only allowed fields
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    // Check if profile is complete
    const requiredFields = ['name', 'dateOfBirth', 'gender', 'phone', 'currentAddress'];
    const isComplete = requiredFields.every(field => {
      const val = user[field];
      return val && val !== '';
    });
    user.profileCompleted = isComplete;
    user.updatedAt = new Date();

    await user.save();

    // Return updated user without sensitive fields
    const updatedUser = await User.findById(user._id)
      .select('-password -attendance')
      .populate('manager')
      .populate('reportsTo', 'name email role profilePicUrl');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload document (Aadhar, PAN, etc.)
const docsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'documents')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext) ? ext : '.jpg';
    const docType = req.body.docType || 'document';
    cb(null, `${req.user.userId}-${docType}-${Date.now()}${safeExt}`);
  },
});

const uploadDoc = multer({
  storage: docsStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (mime.startsWith('image/') || mime === 'application/pdf') return cb(null, true);
    cb(new Error('Only image or PDF files are allowed'));
  },
});

// Save document URL (external storage)
router.post('/upload-document-url', authMiddleware, async (req, res) => {
  try {
    const { docType, url } = req.body || {};
    if (!docType) {
      return res.status(400).json({ message: 'docType is required' });
    }
    if (!url || typeof url !== 'string' || !isHttpUrl(url)) {
      return res.status(400).json({ message: 'Valid URL is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (docType === 'aadharFront') user.aadharFrontUrl = url;
    else if (docType === 'aadharBack') user.aadharBackUrl = url;
    else if (docType === 'panCard') user.panCardUrl = url;
    else {
      return res.status(400).json({ message: 'Invalid docType' });
    }

    await user.save();

    res.json({
      message: 'Document uploaded successfully',
      docType,
      url,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/upload-document', authMiddleware, uploadDoc.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { docType } = req.body; // 'aadharFront', 'aadharBack', 'panCard'
    const relativeUrl = `/uploads/documents/${req.file.filename}`;

    // Update the appropriate field
    if (docType === 'aadharFront') user.aadharFrontUrl = relativeUrl;
    else if (docType === 'aadharBack') user.aadharBackUrl = relativeUrl;
    else if (docType === 'panCard') user.panCardUrl = relativeUrl;

    await user.save();

    res.json({
      message: 'Document uploaded successfully',
      docType,
      url: relativeUrl,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit profile for verification
router.post('/submit-profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already submitted
    if (user.profileStatus === 'pending') {
      return res.status(400).json({ message: 'Profile already submitted and pending verification' });
    }
    if (user.profileStatus === 'approved') {
      return res.status(400).json({ message: 'Profile already verified' });
    }

    // Validate required fields before submission
    const requiredFields = {
      name: 'Full Name',
      dateOfBirth: 'Date of Birth',
      gender: 'Gender',
      phone: 'Phone Number',
      currentAddress: 'Current Address',
      aadharNumber: 'Aadhar Number',
      panNumber: 'PAN Number',
      bankName: 'Bank Name',
      accountNumber: 'Account Number',
      ifscCode: 'IFSC Code',
      'emergencyContact.name': 'Emergency Contact Name',
      'emergencyContact.phone': 'Emergency Contact Phone',
    };

    const missingFields = [];
    for (const [field, label] of Object.entries(requiredFields)) {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (!user[parent] || !user[parent][child]) {
          missingFields.push(label);
        }
      } else if (!user[field] || user[field] === '') {
        missingFields.push(label);
      }
    }

    // Check document uploads
    if (!user.aadharFrontUrl) missingFields.push('Aadhar Card (Front)');
    if (!user.aadharBackUrl) missingFields.push('Aadhar Card (Back)');
    if (!user.panCardUrl) missingFields.push('PAN Card');

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Please complete all required fields before submitting',
        missingFields,
      });
    }

    // Submit profile
    user.profileSubmittedAt = new Date();
    user.profileCompleted = true;
    user.rejectionReason = '';

    if (['admin', 'ceo'].includes(user.role)) {
      user.profileStatus = 'approved';
      user.isVerifiedEmployee = true;
      user.profileVerifiedAt = new Date();
      user.profileVerifiedBy = user._id;
      await user.save();

      return res.json({
        message: 'Profile auto-verified.',
        profileStatus: 'approved',
        submittedAt: user.profileSubmittedAt,
      });
    }

    user.profileStatus = 'pending';
    await user.save();

    res.json({
      message: 'Profile submitted successfully! HR will verify your details.',
      profileStatus: 'pending',
      submittedAt: user.profileSubmittedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resubmit profile after rejection
router.post('/resubmit-profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.profileStatus !== 'rejected') {
      return res.status(400).json({ message: 'Profile can only be resubmitted if rejected' });
    }

    // Reset to draft for editing
    user.profileStatus = 'draft';
    user.rejectionReason = '';
    await user.save();

    res.json({
      message: 'Profile unlocked for editing. Make changes and submit again.',
      profileStatus: 'draft',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
