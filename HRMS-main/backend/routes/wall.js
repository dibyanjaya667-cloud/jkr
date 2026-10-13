const express = require('express')
const path = require('path')
const router = express.Router()
const Post = require('../models/Post')
const User = require('../models/User')
const Notification = require('../models/Notification')
const auth = require('../middleware/auth')
const multer = require('multer')
const { uploadBufferToStorage } = require('../utils/storageClient')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (extname && mimetype) {
      return cb(null, true)
    }
    cb(new Error('Only image files are allowed'))
  }
})

const getCurrentUserId = (req) => (
  req.userId || req.user?.userId || req.user?._id || req.user?.id || null
)

const getCurrentUser = async (req) => {
  const userId = getCurrentUserId(req)
  if (!userId) return null
  return User.findById(userId).select('role name email').lean()
}

const canAutoApprove = (role) => ['admin', 'hr', 'manager', 'ceo'].includes(role)
const canModerate = (role) => ['admin', 'hr', 'ceo'].includes(role)

// Create a new post
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const currentUser = await getCurrentUser(req)
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { content } = req.body
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' })
    }

    const autoApprove = canAutoApprove(currentUser.role)

    let imageUrl = null
    if (req.file) {
      imageUrl = await uploadBufferToStorage({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: 'posts',
      })
      if (!imageUrl) {
        return res.status(500).json({ error: 'Image upload failed' })
      }
    }

    const post = new Post({
      author: userId,
      content: content.trim(),
      image: imageUrl,
      status: autoApprove ? 'approved' : 'pending',
      approvedBy: autoApprove ? userId : null,
      approvedAt: autoApprove ? new Date() : null,
    })

    await post.save()

    if (!autoApprove) {
      const reviewers = await User.find({ role: { $in: ['admin', 'hr', 'ceo'] } })
        .select('_id name')
        .lean()
      await Promise.all(
        reviewers.map((u) => Notification.create({
          recipient: u._id,
          type: 'post_pending',
          title: 'Post Approval Needed',
          message: `${currentUser.name || 'Employee'} submitted a post for approval`,
          category: 'system',
          data: {
            senderId: userId,
            senderName: currentUser.name,
          }
        }))
      )
    }
    await post.populate('author', 'name email employeeId department designation profilePicUrl')

    res.status(201).json(post)
  } catch (error) {
    console.error('Create post error:', error)
    res.status(500).json({ error: 'Failed to create post' })
  }
})

// Get all posts with pagination (infinite scroll)
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const posts = await Post.find({ status: 'approved' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name email employeeId department designation profilePicUrl')
      .populate('comments.user', 'name email profilePicUrl')
      .lean()

    const total = await Post.countDocuments({ status: 'approved' })
    const hasMore = skip + posts.length < total

    res.json({
      posts,
      page,
      hasMore,
      total
    })
  } catch (error) {
    console.error('Get posts error:', error)
    res.status(500).json({ error: 'Failed to fetch posts' })
  }
})

// Get single post
router.get('/:postId', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req)
    if (!currentUser) return res.status(401).json({ error: 'User not authenticated' })

    const post = await Post.findById(req.params.postId)
      .populate('author', 'name email employeeId department designation profilePicUrl')
      .populate('comments.user', 'name email profilePicUrl')

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.status !== 'approved') {
      const isOwner = post.author.toString() === getCurrentUserId(req).toString()
      if (!isOwner && !canModerate(currentUser.role)) {
        return res.status(404).json({ error: 'Post not found' })
      }
    }

    res.json(post)
  } catch (error) {
    console.error('Get post error:', error)
    res.status(500).json({ error: 'Failed to fetch post' })
  }
})

// Update post (only by author)
router.put('/:postId', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const currentUser = await getCurrentUser(req)
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const post = await Post.findById(req.params.postId)
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this post' })
    }

    const { content } = req.body
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' })
    }

    post.content = content.trim()
    post.updatedAt = new Date()

    if (!canAutoApprove(currentUser.role)) {
      post.status = 'pending'
      post.approvedBy = null
      post.approvedAt = null
      post.rejectedBy = null
      post.rejectedAt = null
      post.rejectionReason = ''
    }
    await post.save()
    await post.populate('author', 'name email employeeId department designation profilePicUrl')
    await post.populate('comments.user', 'name email profilePicUrl')

    res.json(post)
  } catch (error) {
    console.error('Update post error:', error)
    res.status(500).json({ error: 'Failed to update post' })
  }
})

// Delete post (by author or moderator)
router.delete('/:postId', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const currentUser = await getCurrentUser(req)
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const post = await Post.findById(req.params.postId)
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const isOwner = post.author.toString() === userId.toString()
    const isMod = canModerate(currentUser.role)

    if (!isOwner && !isMod) {
      return res.status(403).json({ error: 'Not authorized to delete this post' })
    }

    // Delete associated image if exists
    if (post.image) {
      const imagePath = path.join(__dirname, '..', post.image)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    await Post.findByIdAndDelete(req.params.postId)

    // Notify author if deleted by moderator
    if (!isOwner) {
      await Notification.create({
        recipient: post.author,
        type: 'post_rejected',
        title: 'Post Removed',
        message: `Your post was removed by ${currentUser.role.toUpperCase()}.`,
        category: 'system',
        data: { senderId: userId }
      })
    }

    res.json({ message: 'Post deleted successfully' })
  } catch (error) {
    console.error('Delete post error:', error)
    res.status(500).json({ error: 'Failed to delete post' })
  }
})

// Get my posts (any status)
router.get('/me/mine', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const posts = await Post.find({ author: userId })
      .sort({ createdAt: -1 })
      .populate('author', 'name email employeeId department designation profilePicUrl')
      .populate('comments.user', 'name email profilePicUrl')
      .lean()

    res.json({ posts })
  } catch (error) {
    console.error('Get my posts error:', error)
    res.status(500).json({ error: 'Failed to fetch posts' })
  }
})

// Get pending posts (HR/Admin/CEO)
router.get('/pending/list', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req)
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    if (!canModerate(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const posts = await Post.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('author', 'name email employeeId department designation profilePicUrl')
      .lean()

    res.json({ posts })
  } catch (error) {
    console.error('Get pending posts error:', error)
    res.status(500).json({ error: 'Failed to fetch pending posts' })
  }
})

// Approve post (HR/Admin/CEO)
router.patch('/:postId/approve', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req)
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    if (!canModerate(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const post = await Post.findById(req.params.postId)
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    post.status = 'approved'
    post.approvedBy = getCurrentUserId(req)
    post.approvedAt = new Date()
    post.rejectedBy = null
    post.rejectedAt = null
    post.rejectionReason = ''
    await post.save()
    await post.populate('author', 'name email employeeId department designation profilePicUrl')
    await post.populate('comments.user', 'name email profilePicUrl')

    await Notification.create({
      recipient: post.author,
      type: 'post_approved',
      title: 'Post Approved',
      message: 'Your post has been approved and is now visible.',
      category: 'system',
      data: { senderId: getCurrentUserId(req) }
    })

    res.json(post)
  } catch (error) {
    console.error('Approve post error:', error)
    res.status(500).json({ error: 'Failed to approve post' })
  }
})

// Reject post (HR/Admin/CEO)
router.patch('/:postId/reject', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req)
    if (!currentUser) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    if (!canModerate(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const post = await Post.findById(req.params.postId)
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const reason = String(req.body?.reason || '').trim()
    post.status = 'rejected'
    post.rejectedBy = getCurrentUserId(req)
    post.rejectedAt = new Date()
    post.rejectionReason = reason
    post.approvedBy = null
    post.approvedAt = null
    await post.save()
    await post.populate('author', 'name email employeeId department designation profilePicUrl')
    await post.populate('comments.user', 'name email profilePicUrl')

    await Notification.create({
      recipient: post.author,
      type: 'post_rejected',
      title: 'Post Rejected',
      message: reason ? `Your post was rejected: ${reason}` : 'Your post was rejected.',
      category: 'system',
      data: { senderId: getCurrentUserId(req) }
    })

    res.json(post)
  } catch (error) {
    console.error('Reject post error:', error)
    res.status(500).json({ error: 'Failed to reject post' })
  }
})

// Like/Unlike a post
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const post = await Post.findById(req.params.postId)
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const likeIndex = post.likes.findIndex(id => id.toString() === userId.toString())
    
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1)
    } else {
      // Like
      post.likes.push(userId)
    }

    await post.save()
    await post.populate('author', 'name email employeeId department designation profilePicUrl')
    await post.populate('comments.user', 'name email profilePicUrl')

    res.json(post)
  } catch (error) {
    console.error('Like post error:', error)
    res.status(500).json({ error: 'Failed to like post' })
  }
})

// Add comment to a post
router.post('/:postId/comment', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { content } = req.body
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' })
    }

    const post = await Post.findById(req.params.postId)
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    post.comments.push({
      user: userId,
      content: content.trim()
    })

    await post.save()
    await post.populate('author', 'name email employeeId department designation profilePicUrl')
    await post.populate('comments.user', 'name email profilePicUrl')

    res.json(post)
  } catch (error) {
    console.error('Add comment error:', error)
    res.status(500).json({ error: 'Failed to add comment' })
  }
})

// Delete comment (only by comment author or post author)
router.delete('/:postId/comment/:commentId', auth, async (req, res) => {
  try {
    const userId = getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const post = await Post.findById(req.params.postId)
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const comment = post.comments.id(req.params.commentId)
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    // Check if user is comment author or post author
    const isCommentAuthor = comment.user.toString() === userId.toString()
    const isPostAuthor = post.author.toString() === userId.toString()

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' })
    }

    post.comments.pull(req.params.commentId)
    await post.save()
    await post.populate('author', 'name email employeeId department designation profilePicUrl')
    await post.populate('comments.user', 'name email profilePicUrl')

    res.json(post)
  } catch (error) {
    console.error('Delete comment error:', error)
    res.status(500).json({ error: 'Failed to delete comment' })
  }
})

module.exports = router
