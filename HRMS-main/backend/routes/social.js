const express = require('express')
const multer = require('multer')
const { uploadBufferToStorage } = require('../utils/storageClient')
const router = express.Router()
const FriendRequest = require('../models/FriendRequest')
const Message = require('../models/Message')
const Notification = require('../models/Notification')
const User = require('../models/User')
const Post = require('../models/Post')
const auth = require('../middleware/auth')

const getCurrentUserId = (req) => (
  req.userId || req.user?.userId || req.user?._id || req.user?.id || null
)

const getFriendsOf = async (userId) => {
  const friendships = await FriendRequest.find({
    $or: [
      { from: userId, status: 'accepted' },
      { to: userId, status: 'accepted' }
    ]
  }).populate('from to', 'name email employeeId department designation profilePicUrl')

  return friendships.map(f => (f.from._id.toString() === userId.toString() ? f.to : f.from))
}

const typingState = new Map()
const TYPING_TTL_MS = 6000

const pruneExpiredTypingState = (now = Date.now()) => {
  for (const [key, entry] of typingState) {
    if (!entry || now - entry.updatedAt > TYPING_TTL_MS) {
      typingState.delete(key)
    }
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
})

// Search colleagues
router.get('/search', auth, async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    
    const { q } = req.query
    if (!q || q.length < 2) {
      return res.json([])
    }

    // Get current user to check role and department
    const currentUser = await User.findById(currentUserId).select('role department')
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const regex = new RegExp(q, 'i')
    
    // Build query
    const query = {
      _id: { $ne: currentUserId },
      $or: [
        { name: regex },
        { email: regex },
        { employeeId: regex },
        { department: regex },
        { designation: regex }
      ]
    }

    // If user is not HR/Admin, restrict to same department
    const canViewAllDepartments = ['admin', 'hr'].includes(currentUser.role)
    if (!canViewAllDepartments && currentUser.department) {
      query.department = currentUser.department
    }

    const users = await User.find(query)
      .select('name email employeeId department designation profilePicUrl role')
      .limit(20)

    res.json(users)
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
})

// Get user profile (only if friends or self)
router.get('/profile/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params
    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    const currentUserIdStr = currentUserId.toString()

    // Check if they are friends
    const areFriends = await FriendRequest.findOne({
      $or: [
        { from: currentUserIdStr, to: userId, status: 'accepted' },
        { from: userId, to: currentUserIdStr, status: 'accepted' }
      ]
    })

    const user = await User.findById(userId)
      .select('name email employeeId department designation profilePicUrl role joiningDate')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      ...user.toObject(),
      isFriend: !!areFriends,
      isSelf: userId === currentUserIdStr
    })
  } catch (error) {
    console.error('Profile error:', error)
    res.status(500).json({ error: 'Failed to get profile' })
  }
})

// Get mutual friends list
router.get('/mutual-friends/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params
    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const [currentFriends, targetFriends] = await Promise.all([
      getFriendsOf(currentUserId),
      getFriendsOf(userId)
    ])

    const targetFriendIds = new Set(targetFriends.map(f => f._id.toString()))
    const mutual = currentFriends.filter(f => targetFriendIds.has(f._id.toString()))

    res.json({ count: mutual.length, friends: mutual })
  } catch (error) {
    console.error('Mutual friends error:', error)
    res.status(500).json({ error: 'Failed to get mutual friends' })
  }
})

// Typing status update
router.post('/typing', auth, async (req, res) => {
  try {
    const { toUserId, isTyping } = req.body
    const fromUserId = getCurrentUserId(req)
    pruneExpiredTypingState()
    if (!fromUserId || !toUserId) {
      return res.status(400).json({ error: 'Invalid typing payload' })
    }

    const key = `${fromUserId}:${toUserId}`
    if (isTyping) {
      typingState.set(key, { isTyping: true, updatedAt: Date.now() })
    } else {
      typingState.delete(key)
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Typing update error:', error)
    res.status(500).json({ error: 'Failed to update typing' })
  }
})

// Typing status check
router.get('/typing/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params
    const currentUserId = getCurrentUserId(req)
    pruneExpiredTypingState()
    if (!currentUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const key = `${userId}:${currentUserId}`
    const entry = typingState.get(key)
    const isTyping = !!entry && (Date.now() - entry.updatedAt) <= TYPING_TTL_MS
    if (!isTyping) typingState.delete(key)

    res.json({ isTyping })
  } catch (error) {
    console.error('Typing check error:', error)
    res.status(500).json({ error: 'Failed to check typing' })
  }
})

// Send friend request
router.post('/friend-request', auth, async (req, res) => {
  try {
    const { toUserId } = req.body
    const fromUserId = getCurrentUserId(req)

    if (!fromUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!toUserId) {
      return res.status(400).json({ error: 'Target user ID is required' })
    }

    if (fromUserId.toString() === toUserId.toString()) {
      return res.status(400).json({ error: 'Cannot send request to yourself' })
    }

    // Check if request already exists
    const existing = await FriendRequest.findOne({
      $or: [
        { from: fromUserId, to: toUserId },
        { from: toUserId, to: fromUserId }
      ]
    })

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' })
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'Request already pending' })
      }
      // If rejected, allow resending
      existing.status = 'pending'
      existing.from = fromUserId
      existing.to = toUserId
      existing.updatedAt = new Date()
      await existing.save()
      return res.json({ message: 'Request sent', request: existing })
    }

    const request = new FriendRequest({
      from: fromUserId,
      to: toUserId
    })
    await request.save()

    // Create notification for recipient
    const sender = await User.findById(fromUserId).select('name profilePicUrl')
    await Notification.create({
      recipient: toUserId,
      type: 'connection_request',
      title: 'New Connection Request',
      message: `${sender?.name || 'Someone'} sent you a connection request`,
      category: 'social',
      data: {
        senderId: fromUserId,
        senderName: sender?.name,
        senderProfilePic: sender?.profilePicUrl,
        requestId: request._id,
      }
    })

    res.json({ message: 'Request sent', request })
  } catch (error) {
    console.error('Friend request error:', error)
    res.status(500).json({ error: 'Failed to send request' })
  }
})

// Get pending friend requests (inbox)
router.get('/friend-requests', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Incoming requests
    const incoming = await FriendRequest.find({
      to: userId,
      status: 'pending'
    }).populate('from', 'name email employeeId department designation profilePicUrl')

    // Outgoing requests
    const outgoing = await FriendRequest.find({
      from: userId,
      status: 'pending'
    }).populate('to', 'name email employeeId department designation profilePicUrl')

    res.json({ incoming, outgoing })
  } catch (error) {
    console.error('Get requests error:', error)
    res.status(500).json({ error: 'Failed to get requests' })
  }
})

// Accept/Reject friend request
router.put('/friend-request/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params
    const { action } = req.body // 'accept' or 'reject'

    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const request = await FriendRequest.findById(requestId).populate('from', 'name profilePicUrl')
    if (!request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    if (request.to.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    request.status = action === 'accept' ? 'accepted' : 'rejected'
    request.updatedAt = new Date()
    await request.save()

    // Create notification for the request sender if accepted
    if (action === 'accept') {
      const accepter = await User.findById(currentUserId).select('name profilePicUrl')
      await Notification.create({
        recipient: request.from._id,
        type: 'connection_accepted',
        title: 'Connection Accepted',
        message: `${accepter?.name || 'Someone'} accepted your connection request`,
        category: 'social',
        data: {
          senderId: currentUserId,
          senderName: accepter?.name,
          senderProfilePic: accepter?.profilePicUrl,
          requestId: request._id,
        }
      })
    }

    res.json({ message: `Request ${action}ed`, request })
  } catch (error) {
    console.error('Update request error:', error)
    res.status(500).json({ error: 'Failed to update request' })
  }
})

// Get friends list
router.get('/friends', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const friendships = await FriendRequest.find({
      $or: [
        { from: userId, status: 'accepted' },
        { to: userId, status: 'accepted' }
      ]
    }).populate('from to', 'name email employeeId department designation profilePicUrl')

    const friends = friendships.map(f => {
      const friend = f.from._id.toString() === userId.toString() ? f.to : f.from
      return friend
    })

    res.json(friends)
  } catch (error) {
    console.error('Get friends error:', error)
    res.status(500).json({ error: 'Failed to get friends' })
  }
})

// Get friendship status with a user
router.get('/friendship-status/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params
    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const request = await FriendRequest.findOne({
      $or: [
        { from: currentUserId, to: userId },
        { from: userId, to: currentUserId }
      ]
    })

    if (!request) {
      return res.json({ status: 'none' })
    }

    res.json({
      status: request.status,
      direction: request.from.toString() === currentUserId.toString() ? 'sent' : 'received',
      requestId: request._id
    })
  } catch (error) {
    console.error('Friendship status error:', error)
    res.status(500).json({ error: 'Failed to get status' })
  }
})

// Send message (text/image/attachment/post)
router.post('/messages', auth, upload.single('file'), async (req, res) => {
  try {
    const { toUserId, content = '', postId } = req.body
    const fromUserId = getCurrentUserId(req)
    if (!fromUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Check if they are friends
    const areFriends = await FriendRequest.findOne({
      $or: [
        { from: fromUserId, to: toUserId, status: 'accepted' },
        { from: toUserId, to: fromUserId, status: 'accepted' }
      ]
    })

    if (!areFriends) {
      return res.status(403).json({ error: 'You can only message friends' })
    }

    let messageType = 'text'
    let attachment = null
    let sharedPostId = null

    if (req.file) {
      const fileUrl = await uploadBufferToStorage({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: 'chat',
      })
      if (!fileUrl) {
        return res.status(500).json({ error: 'File upload failed' })
      }
      const isImage = req.file.mimetype?.startsWith('image/')
      messageType = isImage ? 'image' : 'attachment'
      attachment = {
        url: fileUrl,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    }

    if (postId) {
      const post = await Post.findById(postId).select('_id')
      if (!post) {
        return res.status(404).json({ error: 'Post not found' })
      }
      messageType = 'post'
      sharedPostId = post._id
    }

    if (!content.trim() && !req.file && !postId) {
      return res.status(400).json({ error: 'Message content is required' })
    }

    const message = new Message({
      from: fromUserId,
      to: toUserId,
      content: content.trim(),
      type: messageType,
      attachment,
      postId: sharedPostId
    })
    await message.save()

    const sender = await User.findById(fromUserId).select('name profilePicUrl').lean()
    await Notification.create({
      recipient: toUserId,
      type: 'message_received',
      title: 'New Message',
      message: `${sender?.name || 'Someone'} sent you a message`,
      category: 'social',
      data: {
        senderId: fromUserId,
        senderName: sender?.name,
        senderProfilePic: sender?.profilePicUrl,
      }
    })

    res.json(message)
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// Get conversation with a user
router.get('/messages/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params
    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: userId },
        { from: userId, to: currentUserId }
      ],
      deletedFor: { $ne: currentUserId }
    })
    .sort({ createdAt: 1 })
    .limit(100)
    .populate('postId', 'content image author createdAt')
    .populate('from to', 'name email profilePicUrl designation department')

    // Replace content for deleted-for-everyone messages
    const cleaned = messages.map(m => {
      const msg = m.toObject()
      if (msg.deletedForEveryone) {
        msg.content = ''
        msg.attachment = null
        msg.postId = null
        msg.type = 'text'
      }
      return msg
    })

    // Mark messages as read
    await Message.updateMany(
      { from: userId, to: currentUserId, read: false },
      { read: true, readAt: new Date() }
    )

    res.json(cleaned)
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({ error: 'Failed to get messages' })
  }
})

// Delete message for me
router.patch('/messages/:messageId/delete-for-me', auth, async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) return res.status(401).json({ error: 'Not authenticated' })

    const message = await Message.findById(req.params.messageId)
    if (!message) return res.status(404).json({ error: 'Message not found' })

    const isParticipant = [message.from.toString(), message.to.toString()].includes(currentUserId.toString())
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' })

    if (!message.deletedFor.includes(currentUserId)) {
      message.deletedFor.push(currentUserId)
      await message.save()
    }

    res.json({ message: 'Deleted for you' })
  } catch (error) {
    console.error('Delete for me error:', error)
    res.status(500).json({ error: 'Failed to delete message' })
  }
})

// Delete message for everyone (only sender, within 1 hour)
router.patch('/messages/:messageId/delete-for-everyone', auth, async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) return res.status(401).json({ error: 'Not authenticated' })

    const message = await Message.findById(req.params.messageId)
    if (!message) return res.status(404).json({ error: 'Message not found' })

    if (message.from.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'Only sender can delete for everyone' })
    }

    // Allow delete within 1 hour
    const ageMs = Date.now() - new Date(message.createdAt).getTime()
    if (ageMs > 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Can only delete within 1 hour of sending' })
    }

    message.deletedForEveryone = true
    message.deletedForEveryoneAt = new Date()
    message.content = ''
    message.attachment = { url: '', fileName: '', mimeType: '', size: 0 }
    message.postId = null
    await message.save()

    res.json({ message: 'Deleted for everyone' })
  } catch (error) {
    console.error('Delete for everyone error:', error)
    res.status(500).json({ error: 'Failed to delete message' })
  }
})

// Get all conversations (chat list)
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Get all friends
    const friendships = await FriendRequest.find({
      $or: [
        { from: userId, status: 'accepted' },
        { to: userId, status: 'accepted' }
      ]
    }).populate('from to', 'name email employeeId department designation profilePicUrl')

    const conversations = await Promise.all(
      friendships.map(async (f) => {
        const friend = f.from._id.toString() === userId.toString() ? f.to : f.from
        
        // Get last message
        const lastMessage = await Message.findOne({
          $or: [
            { from: userId, to: friend._id },
            { from: friend._id, to: userId }
          ]
        })
        .sort({ createdAt: -1 })
        .populate('postId', 'content image author createdAt')

        // Count unread messages
        const unreadCount = await Message.countDocuments({
          from: friend._id,
          to: userId,
          read: false
        })

        return {
          friend,
          lastMessage,
          unreadCount
        }
      })
    )

    // Sort by last message time
    conversations.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt || new Date(0)
      const timeB = b.lastMessage?.createdAt || new Date(0)
      return timeB - timeA
    })

    res.json(conversations)
  } catch (error) {
    console.error('Get conversations error:', error)
    res.status(500).json({ error: 'Failed to get conversations' })
  }
})

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const unreadMessages = await Message.countDocuments({
      to: userId,
      read: false
    })

    const pendingRequests = await FriendRequest.countDocuments({
      to: userId,
      status: 'pending'
    })

    res.json({ unreadMessages, pendingRequests, total: unreadMessages + pendingRequests })
  } catch (error) {
    console.error('Unread count error:', error)
    res.status(500).json({ error: 'Failed to get unread count' })
  }
})

module.exports = router
