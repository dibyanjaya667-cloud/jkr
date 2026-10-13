const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  // Who applied for leave
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Leave type
  leaveType: {
    type: String,
    enum: ['casual', 'sick', 'earned', 'maternity', 'paternity', 'unpaid', 'other'],
    required: true,
  },
  // Start and end date
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  // Number of days
  totalDays: {
    type: Number,
    required: true,
  },
  // Reason for leave
  reason: {
    type: String,
    required: true,
  },
  // Current status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'reapply_requested', 'revoked'],
    default: 'pending',
  },
  // Who should approve (based on hierarchy)
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Approver's role level needed
  approverRole: {
    type: String,
    enum: ['manager', 'hr', 'ceo'],
  },
  // Action history
  actionHistory: [{
    action: {
      type: String,
      enum: ['applied', 'approved', 'rejected', 'reapply_requested', 'reapplied', 'revoked'],
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actionByRole: String,
    note: String,
    actionDate: {
      type: Date,
      default: Date.now,
    },
  }],
  // Note from approver (for rejection or reapply request)
  approverNote: {
    type: String,
    default: '',
  },
  // Applicant's role at the time of application
  applicantRole: {
    type: String,
    enum: ['employee', 'manager', 'hr', 'ceo'],
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

// Update timestamp on save
leaveSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Leave', leaveSchema);
