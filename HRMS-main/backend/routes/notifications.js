const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const notificationEmitter = require('../utils/notificationEmitter');
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');
const Leave = require('../models/Leave');
const auth = require('../middleware/auth');

const IST_TIMEZONE = 'Asia/Kolkata';
const formatTimeIST = (value) => new Date(value).toLocaleTimeString('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: IST_TIMEZONE,
});
const formatDateIST = (value) => new Date(value).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: IST_TIMEZONE,
});
const timeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
};

const authStream = (req, res, next) => {
  try {
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.userId = decoded.userId;
    if (req.user && req.user.userId && !req.user.id) {
      req.user.id = req.user.userId;
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Live notification stream (SSE)
router.get('/stream', authStream, (req, res) => {
  const userId = req.user?.userId || req.userId;
  if (!userId) return res.status(401).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  if (res.flushHeaders) res.flushHeaders();
  req.socket.setTimeout(0);

  res.write(`retry: 5000\n`);
  res.write(`event: connected\ndata: {"ok":true}\n\n`);

  const onNotify = (payload) => {
    if (!payload || payload.recipient !== String(userId)) return;
    res.write(`event: notification\ndata: ${JSON.stringify(payload.notification)}\n\n`);
  };

  notificationEmitter.on('notification', onNotify);

  const keepAlive = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    notificationEmitter.off('notification', onNotify);
  });
});

// Get combined inbox data (notifications + friend requests + attendance + leave)
router.get('/inbox', auth, async (req, res) => {
  try {
    const { category, limit = 50 } = req.query;
    const userId = req.user.userId;
    
    let allItems = [];
    
    // 1. Get actual notifications from DB (exclude punch in/out attendance notifications)
    const notifQuery = { recipient: userId, type: { $ne: 'attendance_marked' } };
    if (category && category !== 'all') {
      notifQuery.category = category;
    }
    
    const dbNotifications = await Notification.find(notifQuery)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    allItems.push(...dbNotifications.map(n => ({ ...n, source: 'notification' })));
    
    // 2. Get pending friend requests (for social category)
    // Only add from FriendRequest if there's NO notification already for it
    if (!category || category === 'all' || category === 'social') {
      const pendingRequests = await FriendRequest.find({ to: userId, status: 'pending' })
        .populate('from', 'name email profilePicUrl designation')
        .sort({ createdAt: -1 })
        .lean();
      
      pendingRequests.forEach(req => {
        // Check if we already have a notification for this request (by sender ID or request ID)
        const exists = allItems.find(n => 
          n.type === 'connection_request' && 
          (n.data?.requestId === req._id.toString() || 
           n.data?.senderId?.toString() === req.from?._id?.toString())
        );
        if (!exists) {
          allItems.push({
            _id: `fr_${req._id}`,
            type: 'connection_request',
            title: 'Connection Request',
            message: `${req.from?.name || req.from?.email?.split('@')[0] || 'Someone'} wants to connect with you`,
            category: 'social',
            isRead: false,
            createdAt: req.createdAt,
            data: {
              senderId: req.from?._id,
              senderName: req.from?.name || req.from?.email?.split('@')[0],
              senderProfilePic: req.from?.profilePicUrl,
              requestId: req._id.toString()
            },
            source: 'friend_request'
          });
        }
      });
    }
    
    // 3. Get user's attendance history (for attendance category)
    if (!category || category === 'all' || category === 'attendance') {
      const user = await User.findById(userId).select('attendanceHistory').lean();
      
      if (user?.attendanceHistory && user.attendanceHistory.length > 0) {
        // Get last 10 attendance records
        const recentAttendance = user.attendanceHistory.slice(-15).reverse();
        
        recentAttendance.forEach(record => {
          // Overtime notification
          if (record.overtimeMinutes && record.overtimeMinutes > 0) {
            const hours = Math.floor(record.overtimeMinutes / 60);
            const mins = record.overtimeMinutes % 60;
            const otTime = record.punchOut?.time ? new Date(record.punchOut.time) : new Date(record.date);
            allItems.push({
              _id: `att_ot_${record.date}`,
              type: 'overtime_recorded',
              title: 'Overtime Recorded',
              message: `${hours > 0 ? hours + 'h ' : ''}${mins}m overtime — ${timeAgo(otTime)}`,
              category: 'attendance',
              isRead: true,
              createdAt: otTime,
              data: { date: record.date, overtimeMinutes: record.overtimeMinutes },
              source: 'attendance'
            });
          }
        });
      }
    }
    
    // 4. Get leave history (for leave category)
    if (!category || category === 'all' || category === 'leave') {
      const leaves = await Leave.find({ user: userId })
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean();
      
      leaves.forEach(leave => {
        // Check if we already have notification for this leave
        const exists = allItems.find(n => 
          (n.type === 'leave_approved' || n.type === 'leave_rejected') && 
          n.data?.leaveId === leave._id.toString()
        );
        
        if (!exists && (leave.status === 'approved' || leave.status === 'rejected')) {
          allItems.push({
            _id: `leave_${leave._id}`,
            type: leave.status === 'approved' ? 'leave_approved' : 'leave_rejected',
            title: leave.status === 'approved' ? 'Leave Approved ✓' : 'Leave Rejected',
            message: `Your ${leave.leaveType || 'leave'} from ${formatDateIST(leave.startDate)} to ${formatDateIST(leave.endDate)} was ${leave.status}`,
            category: 'leave',
            isRead: true,
            createdAt: leave.updatedAt || leave.createdAt,
            data: { leaveId: leave._id.toString() },
            source: 'leave'
          });
        }
        
        // Also add pending leaves
        if (leave.status === 'pending') {
          allItems.push({
            _id: `leave_pending_${leave._id}`,
            type: 'leave_applied',
            title: 'Leave Applied',
            message: `${leave.leaveType || 'Leave'} request from ${formatDateIST(leave.startDate)} to ${formatDateIST(leave.endDate)} is pending approval`,
            category: 'leave',
            isRead: true,
            createdAt: leave.createdAt,
            data: { leaveId: leave._id.toString() },
            source: 'leave'
          });
        }
      });
    }
    
    // 5. Add profile status notification
    if (!category || category === 'all' || category === 'profile') {
      const user = await User.findById(userId).select('profileStatus isVerifiedEmployee profileRejectionReason').lean();
      
      if (user?.profileStatus === 'pending') {
        allItems.push({
          _id: 'profile_pending',
          type: 'profile_submitted',
          title: 'Profile Under Review',
          message: 'Your profile is being reviewed by HR. You will be notified once verified.',
          category: 'profile',
          isRead: true,
          createdAt: new Date(),
          data: {},
          source: 'profile'
        });
      } else if (user?.profileStatus === 'rejected') {
        allItems.push({
          _id: 'profile_rejected',
          type: 'profile_rejected',
          title: 'Profile Verification Failed',
          message: user.profileRejectionReason || 'Your profile verification was rejected. Please update and resubmit.',
          category: 'profile',
          isRead: false,
          createdAt: new Date(),
          data: {},
          source: 'profile'
        });
      }
    }
    
    // Sort all items by createdAt descending
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Limit results
    allItems = allItems.slice(0, parseInt(limit));
    
    res.json(allItems);
  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all notifications for current user
router.get('/', auth, async (req, res) => {
  try {
    const { category, unreadOnly, limit = 50 } = req.query;
    
    const query = { recipient: req.user.userId };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });
    
    // Also get count by category using string userId (mongoose handles conversion)
    const categoryCounts = await Notification.aggregate([
      { $match: { recipient: mongoose.Types.ObjectId.createFromHexString(userId), isRead: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    const byCategory = {};
    categoryCounts.forEach(c => {
      byCategory[c._id] = c.count;
    });
    
    res.json({ total: count, byCategory });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    const { category } = req.body;
    
    const query = { recipient: req.user.userId, isRead: false };
    if (category && category !== 'all') {
      query.category = category;
    }
    
    await Notification.updateMany(query, { isRead: true });
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.userId,
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear all notifications (or by category)
router.delete('/clear/all', auth, async (req, res) => {
  try {
    const { category } = req.query;
    
    const query = { recipient: req.user.userId };
    if (category && category !== 'all') {
      query.category = category;
    }
    
    await Notification.deleteMany(query);
    
    res.json({ message: 'Notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to create notification (exported for use in other routes)
const createNotification = async ({ recipient, type, title, message, data = {}, category = 'system' }) => {
  try {
    const notification = new Notification({
      recipient,
      type,
      title,
      message,
      data,
      category,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

router.createNotification = createNotification;

module.exports = router;
