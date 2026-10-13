const mongoose = require('mongoose');

const wfhRequestSchema = new mongoose.Schema({
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  totalDays: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approverNote: {
    type: String,
    default: '',
  },
  applicantRole: {
    type: String,
    enum: ['employee', 'manager', 'hr', 'ceo'],
  },
  actionHistory: [{
    action: {
      type: String,
      enum: ['applied', 'approved', 'rejected'],
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

wfhRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('WfhRequest', wfhRequestSchema);
