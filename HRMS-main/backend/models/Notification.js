const mongoose = require('mongoose');
const notificationEmitter = require('../utils/notificationEmitter');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'connection_request',      // Someone sent you a friend request
      'connection_accepted',     // Your friend request was accepted
      'punch_reminder',          // Reminder to punch in/out
      'missed_punch',            // Missed punch in or out
      'leave_applied',           // Leave application submitted
      'leave_approved',          // Leave was approved
      'leave_rejected',          // Leave was rejected
      'leave_revoked',           // Leave was revoked by admin
      'password_reset_requested',// Password reset requested
      'password_reset_ready',    // Temporary password issued
      'password_reset_rejected', // Password reset rejected
      'wfh_applied',             // WFH request submitted
      'wfh_approved',            // WFH approved
      'wfh_rejected',            // WFH rejected
      'profile_submitted',       // Profile submitted for verification
      'profile_approved',        // Profile was verified
      'profile_rejected',        // Profile was rejected
      'profile_unlocked',        // Profile was unlocked for editing
      'attendance_marked',       // Attendance was marked
      'overtime_recorded',       // Overtime was recorded
      'message_received',        // New message received
      'post_pending',            // Post awaiting approval
      'post_approved',           // Post approved
      'post_rejected',           // Post rejected
      'ot_approved',             // OT approved
      'ot_rejected',             // OT rejected
      'system',                  // System notifications
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    // Additional data like sender info, leave id, etc.
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: String,
    senderProfilePic: String,
    leaveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leave' },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'FriendRequest' },
    actionUrl: String,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  category: {
    type: String,
    enum: ['social', 'attendance', 'leave', 'wfh', 'profile', 'system'],
    default: 'system',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Index for faster queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Emit after save (for SSE)
notificationSchema.post('save', function (doc) {
  try {
    notificationEmitter.emit('notification', {
      recipient: doc.recipient?.toString(),
      notification: doc.toObject ? doc.toObject() : doc,
    });
  } catch {
    // ignore
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
