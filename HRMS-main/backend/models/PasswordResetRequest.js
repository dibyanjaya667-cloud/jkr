const mongoose = require('mongoose');

const passwordResetRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  note: {
    type: String,
    default: '',
  },
});

passwordResetRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);