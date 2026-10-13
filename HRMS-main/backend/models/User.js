const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const attendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  punchIn: {
    time: Date,
    selfie: {
      type: String,
      default: '',
    },
    isSuspect: {
      type: Boolean,
      default: false,
    },
    suspectReason: {
      type: String,
      default: '',
    },
    location: {
      lat: Number,
      lng: Number,
      address: String,
      accuracy: Number,
    },
  },
  punchOut: {
    time: Date,
    selfie: {
      type: String,
      default: '',
    },
    isSuspect: {
      type: Boolean,
      default: false,
    },
    suspectReason: {
      type: String,
      default: '',
    },
    overtimeStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    overtimeApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    overtimeApprovedAt: {
      type: Date,
      default: null,
    },
    overtimeAdjustedMinutes: {
      type: Number,
      default: null,
    },
    overtimeAdjustmentNote: {
      type: String,
      default: '',
    },
    overtimeMinutes: {
      type: Number,
      default: 0,
    },
    // Distance check vs punch-in location (meters)
    distanceFromPunchInM: {
      type: Number,
      default: null,
    },
    radiusM: {
      type: Number,
      default: 500,
    },
    withinRadius: {
      type: Boolean,
      default: null,
    },
    location: {
      lat: Number,
      lng: Number,
      address: String,
      accuracy: Number,
    },
  },
});

// Education Schema
const educationSchema = new mongoose.Schema({
  degree: { type: String, default: '' },
  institution: { type: String, default: '' },
  yearOfPassing: { type: Number },
  percentage: { type: Number },
});

// Work Experience Schema
const experienceSchema = new mongoose.Schema({
  company: { type: String, default: '' },
  designation: { type: String, default: '' },
  fromDate: { type: Date },
  toDate: { type: Date },
  reasonForLeaving: { type: String, default: '' },
});

const userSchema = new mongoose.Schema({
  // ============ BASIC INFO ============
  name: {
    type: String,
    trim: true,
  },
  profilePicUrl: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  
  // ============ PERSONAL INFO ============
  dateOfBirth: {
    type: Date,
    default: null,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', ''],
    default: '',
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', ''],
    default: '',
  },
  maritalStatus: {
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed', ''],
    default: '',
  },
  nationality: {
    type: String,
    default: 'Indian',
  },
  
  // ============ CONTACT INFO ============
  phone: {
    type: String,
    default: '',
  },
  alternatePhone: {
    type: String,
    default: '',
  },
  personalEmail: {
    type: String,
    default: '',
  },
  currentAddress: {
    type: String,
    default: '',
  },
  permanentAddress: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: '',
  },
  pincode: {
    type: String,
    default: '',
  },
  
  // ============ EMPLOYMENT INFO ============
  employeeId: {
    type: String,
    required: true,
    unique: true,
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manager',
    default: null,
  },
  // Hierarchical Role System: Employee < Manager < HR < CEO
  role: {
    type: String,
    enum: ['admin', 'ceo', 'hr', 'manager', 'employee'],
    default: 'employee',
  },
  // Who this user reports to (for hierarchy)
  reportsTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Department
  department: {
    type: String,
    enum: [
      'MANAGEMENT',
      'ADMINISTRATION & HR',
      'LEGAL',
      'ACCOUNTS',
      'BUSINESS DEVELOPMENT',
      'BIM',
      'DESIGN',
      'GIS',
      'PMC',
      'TRAINING & DEVELOPMENT',
      'OTHER',
      ''
    ],
    default: '',
  },
  // Designation/Job Title
  designation: {
    type: String,
    default: '',
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'intern', ''],
    default: 'full-time',
  },
  dateOfJoining: {
    type: Date,
    default: null,
  },
  workLocation: {
    type: String,
    default: '',
  },
  shift: {
    type: String,
    default: 'General (9 AM - 6 PM)',
  },
  
  // ============ IDENTITY DOCUMENTS ============
  aadharNumber: {
    type: String,
    default: '',
  },
  panNumber: {
    type: String,
    default: '',
  },
  passportNumber: {
    type: String,
    default: '',
  },
  drivingLicense: {
    type: String,
    default: '',
  },
  voterId: {
    type: String,
    default: '',
  },
  // Document uploads
  aadharFrontUrl: {
    type: String,
    default: '',
  },
  aadharBackUrl: {
    type: String,
    default: '',
  },
  panCardUrl: {
    type: String,
    default: '',
  },
  
  // ============ BANK DETAILS ============
  bankName: {
    type: String,
    default: '',
  },
  accountNumber: {
    type: String,
    default: '',
  },
  pfAccountNumber: {
    type: String,
    default: '',
  },
  ifscCode: {
    type: String,
    default: '',
  },
  uanNumber: {
    type: String,
    default: '',
  },
  esiNumber: {
    type: String,
    default: '',
  },
  
  // ============ SALARY STRUCTURE (Monthly) ============
  salaryStructure: {
    ctcAnnual: { type: Number, default: 0 },
    basisSalary: { type: Number, default: 0 },
    houseRentAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    educationAllowance: { type: Number, default: 0 },
    otherAllowance: { type: Number, default: 0 },
    epf: { type: Number, default: 0 },
    esic: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    totalEarningsOverride: { type: Number, default: null },
    totalDeductionsOverride: { type: Number, default: null },
    netPayOverride: { type: Number, default: null },
  },
  // Payslip salary snapshots by month (YYYY-MM)
  payslipSalaries: [
    {
      month: { type: String, default: '' },
      salaryStructure: {
        ctcAnnual: { type: Number, default: 0 },
        basisSalary: { type: Number, default: 0 },
        houseRentAllowance: { type: Number, default: 0 },
        medicalAllowance: { type: Number, default: 0 },
        educationAllowance: { type: Number, default: 0 },
        otherAllowance: { type: Number, default: 0 },
        epf: { type: Number, default: 0 },
        esic: { type: Number, default: 0 },
        tds: { type: Number, default: 0 },
        otherDeductions: { type: Number, default: 0 },
        totalEarningsOverride: { type: Number, default: null },
        totalDeductionsOverride: { type: Number, default: null },
        netPayOverride: { type: Number, default: null },
      },
      updatedAt: { type: Date, default: null },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  ],
  // Payslip access settings and approvals
  payslipSettings: {
    mode: { type: String, enum: ['locked', 'unlocked'], default: 'locked' },
    delayMonths: { type: Number, default: 2 },
  },
  payslipAccessEnabled: {
    type: Boolean,
    default: true,
  },
  payslipApprovals: [
    {
      month: { type: String, default: '' }, // YYYY-MM
      approved: { type: Boolean, default: false },
      approvedAt: { type: Date, default: null },
    },
  ],
  
  // ============ EMERGENCY CONTACT ============
  emergencyContact: {
    name: { type: String, default: '' },
    relationship: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  
  // ============ EDUCATION ============
  education: [educationSchema],
  
  // ============ WORK EXPERIENCE ============
  experience: [experienceSchema],
  
  // ============ SYSTEM FIELDS ============
  // Is this user active? (HR activation required after registration)
  isActive: {
    type: Boolean,
    default: false,
  },
  activationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailOtpHash: {
    type: String,
    default: '',
  },
  emailOtpExpiresAt: {
    type: Date,
    default: null,
  },
  emailOtpSentAt: {
    type: Date,
    default: null,
  },
  
  // ============ PROFILE VERIFICATION ============
  profileStatus: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft',
  },
  profileSubmittedAt: {
    type: Date,
    default: null,
  },
  profileVerifiedAt: {
    type: Date,
    default: null,
  },
  profileVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  rejectionReason: {
    type: String,
    default: '',
  },
  isVerifiedEmployee: {
    type: Boolean,
    default: false,
  },
  
  lastLocation: {
    lat: Number,
    lng: Number,
    address: String,
    accuracy: Number,
    isSuspect: {
      type: Boolean,
      default: false,
    },
    suspectReason: {
      type: String,
      default: '',
    },
    updatedAt: Date,
  },
  attendance: [attendanceSchema],

  // ============ USER SETTINGS ============
  settings: {
    notificationsEnabled: { type: Boolean, default: true },
    emailAlerts: { type: Boolean, default: false },
    privacy: {
      showProfileToTeam: { type: Boolean, default: true },
      showOnlineStatus: { type: Boolean, default: true },
      shareLocation: { type: Boolean, default: false },
    },
  },

  // Allow punch in/out during approved leave (HR/Admin granted)
  leavePunchPermission: {
    allowed: { type: Boolean, default: false },
    note: { type: String, default: '' },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    grantedAt: { type: Date, default: null },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
