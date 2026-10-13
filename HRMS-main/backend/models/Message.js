const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'attachment', 'post'],
    default: 'text'
  },
  content: {
    type: String,
    trim: true,
    default: ''
  },
  attachment: {
    url: { type: String, default: '' },
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 }
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  deletedForEveryone: {
    type: Boolean,
    default: false
  },
  deletedForEveryoneAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

// Index for efficient querying of conversations
messageSchema.index({ from: 1, to: 1, createdAt: -1 })

module.exports = mongoose.model('Message', messageSchema)
