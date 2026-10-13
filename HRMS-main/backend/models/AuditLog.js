const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  actorRole: {
    type: String,
    default: '',
  },
  action: {
    type: String,
    required: true,
  },
  method: {
    type: String,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  statusCode: {
    type: Number,
    default: 0,
  },
  targetId: {
    type: String,
    default: '',
  },
  targetType: {
    type: String,
    default: '',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ip: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

auditLogSchema.index({ createdAt: -1 });

auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
