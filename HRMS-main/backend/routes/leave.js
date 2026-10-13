const express = require('express');
const router = express.Router();
const Leave = require('../models/Leave');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { sendEmail } = require('../services/email');
const { leaveStatusEmail } = require('../services/emailTemplates');

// Role hierarchy levels (higher number = more authority)
const ROLE_LEVELS = {
  'employee': 1,
  'manager': 2,
  'hr': 3,
  'ceo': 4,
  'admin': 5,
};

// Check if user can take action on a leave (approve/reject/reapply)
const canTakeAction = (actionTakerRole, applicantRole) => {
  const actionTakerLevel = ROLE_LEVELS[actionTakerRole] || 0;
  const applicantLevel = ROLE_LEVELS[applicantRole] || 0;
  // Higher level can take action on lower level's leave
  return actionTakerLevel > applicantLevel;
};

// Apply for leave
router.post('/apply', auth, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // CEO cannot apply for leave
    if (user.role === 'ceo' || user.role === 'admin') {
      return res.status(400).json({ message: 'CEO/Admin cannot apply for leave through this system' });
    }
    
    // Calculate total days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    const leave = new Leave({
      applicant: user._id,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      status: 'pending',
      applicantRole: user.role,
      actionHistory: [{
        action: 'applied',
        actionBy: user._id,
        actionByRole: user.role,
        note: reason,
        actionDate: new Date(),
      }],
    });
    
    await leave.save();

    // Notify manager + HR/Admin/CEO
    const supervisors = await User.find({ role: { $in: ['admin', 'hr', 'ceo'] } })
      .select('_id name')
      .lean();

    const recipients = new Set(supervisors.map(u => u._id.toString()));
    if (user.reportsTo) recipients.add(user.reportsTo.toString());

    await Promise.all(
      Array.from(recipients).map((rid) => Notification.create({
        recipient: rid,
        type: 'leave_applied',
        title: 'Leave Applied',
        message: `${user.name || 'Employee'} applied for ${leaveType} leave (${totalDays} days)` ,
        category: 'leave',
        data: {
          senderId: user._id,
          senderName: user.name,
          leaveId: leave._id,
        },
      }))
    );
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.status(201).json({
      message: 'Leave application submitted successfully',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave apply error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get my leaves (for the applicant)
router.get('/my-leaves', auth, async (req, res) => {
  try {
    const leaves = await Leave.find({ applicant: req.user.userId })
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role')
      .sort({ createdAt: -1 });
    
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get today's leave status for current user
router.get('/today-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leave = await Leave.findOne({
      applicant: user._id,
      status: 'approved',
      startDate: { $lte: today },
      endDate: { $gte: today },
    }).select('leaveType startDate endDate');

    res.json({
      onLeave: !!leave,
      leave,
      permissionAllowed: !!user.leavePunchPermission?.allowed,
      permissionNote: user.leavePunchPermission?.note || '',
    });
  } catch (error) {
    console.error('Leave status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request punch permission during leave (employee)
router.post('/punch-permission-request', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leave = await Leave.findOne({
      applicant: user._id,
      status: 'approved',
      startDate: { $lte: today },
      endDate: { $gte: today },
    }).select('leaveType');

    if (!leave) {
      return res.status(400).json({ message: 'You are not on approved leave today' });
    }

    const reviewers = await User.find({ role: { $in: ['admin', 'hr', 'ceo'] } })
      .select('_id name')
      .lean();

    await Promise.all(
      reviewers.map((u) => Notification.create({
        recipient: u._id,
        type: 'system',
        title: 'Punch Permission Request',
        message: `${user.name || 'Employee'} requested punch permission during leave (${leave.leaveType}).`,
        category: 'attendance',
        data: { senderId: user._id, senderName: user.name },
      }))
    );

    res.json({ message: 'Request sent to HR/Admin' });
  } catch (error) {
    console.error('Punch permission request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete my pending leave (applicant only)
router.delete('/:leaveId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    if (leave.applicant.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this leave' });
    }
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending leaves can be deleted' });
    }

    await Leave.findByIdAndDelete(leave._id);
    res.json({ message: 'Leave deleted successfully' });
  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leaves that current user can take action on (pending ones)
router.get('/pending-approvals', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userLevel = ROLE_LEVELS[user.role] || 0;
    
    // Get all roles that are below current user's level
    const lowerRoles = Object.entries(ROLE_LEVELS)
      .filter(([role, level]) => level < userLevel && role !== 'admin')
      .map(([role]) => role);
    
    if (lowerRoles.length === 0) {
      return res.json([]);
    }
    
    let applicantFilter = { applicantRole: { $in: lowerRoles } };

    // Managers only see leaves from their direct reports
    if (user.role === 'manager') {
      const reportIds = await User.find({ reportsTo: user._id, isActive: true })
        .select('_id')
        .lean();
      const ids = reportIds.map(r => r._id);
      if (ids.length === 0) return res.json([]);
      applicantFilter = { applicant: { $in: ids } };
    }

    // Get pending leaves from lower roles
    const leaves = await Leave.find({
      ...applicantFilter,
      status: 'pending',
    })
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role')
      .sort({ createdAt: -1 });
    
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all leaves visible to current user (based on hierarchy)
router.get('/all-visible', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userLevel = ROLE_LEVELS[user.role] || 1;
    
    // Get all roles below current user's level
    const visibleRoles = Object.entries(ROLE_LEVELS)
      .filter(([role, level]) => level < userLevel && role !== 'admin')
      .map(([role]) => role);
    
    if (visibleRoles.length === 0) {
      return res.json([]);
    }
    
    let filter = { applicantRole: { $in: visibleRoles } };

    // Managers only see leaves from their direct reports
    if (user.role === 'manager') {
      const reportIds = await User.find({ reportsTo: user._id, isActive: true })
        .select('_id')
        .lean();
      const ids = reportIds.map(r => r._id);
      if (ids.length === 0) return res.json([]);
      filter = { applicant: { $in: ids } };
    }

    const leaves = await Leave.find(filter)
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role')
      .sort({ createdAt: -1 });
    
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all leaves (for admin)
router.get('/all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'admin' && user.role !== 'ceo')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const leaves = await Leave.find({})
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role')
      .sort({ createdAt: -1 });
    
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve leave - any higher role can approve
router.post('/approve/:leaveId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    
    // Check if user has authority to approve (higher level than applicant)
    if (!canTakeAction(user.role, leave.applicantRole)) {
      return res.status(403).json({ message: 'You do not have authority to approve this leave' });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave is not in pending status' });
    }
    
    leave.status = 'approved';
    leave.approver = user._id;
    leave.approverNote = note || '';
    leave.actionHistory.push({
      action: 'approved',
      actionBy: user._id,
      actionByRole: user.role,
      note: note || 'Leave approved',
      actionDate: new Date(),
    });
    
    await leave.save();

    // Create notification for leave applicant
    await Notification.create({
      recipient: leave.applicant,
      type: 'leave_approved',
      title: 'Leave Approved ✓',
      message: `Your ${leave.leaveType} leave (${leave.totalDays} days) has been approved by ${user.name}`,
      category: 'leave',
      data: {
        senderId: user._id,
        senderName: user.name,
        leaveId: leave._id,
      }
    });

    try {
      const applicant = await User.findById(leave.applicant).select('name email');
      if (applicant?.email) {
        const { subject, html, text } = leaveStatusEmail({
          userName: applicant.name || applicant.email?.split('@')[0],
          status: 'approved',
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          totalDays: leave.totalDays,
          approverName: user.name,
          note,
        });
        await sendEmail({ to: applicant.email, subject, html, text });
      }
    } catch (mailError) {
      console.error('Leave approved email failed:', mailError.message);
    }
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.json({
      message: 'Leave approved successfully',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave approve error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject leave - any higher role can reject
router.post('/reject/:leaveId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    
    // Check if user has authority to reject
    if (!canTakeAction(user.role, leave.applicantRole)) {
      return res.status(403).json({ message: 'You do not have authority to reject this leave' });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave is not in pending status' });
    }
    
    leave.status = 'rejected';
    leave.approver = user._id;
    leave.approverNote = note || '';
    leave.actionHistory.push({
      action: 'rejected',
      actionBy: user._id,
      actionByRole: user.role,
      note: note || 'Leave rejected',
      actionDate: new Date(),
    });
    
    await leave.save();

    // Create notification for leave applicant
    await Notification.create({
      recipient: leave.applicant,
      type: 'leave_rejected',
      title: 'Leave Rejected',
      message: `Your ${leave.leaveType} leave was rejected${note ? ': ' + note : ''}`,
      category: 'leave',
      data: {
        senderId: user._id,
        senderName: user.name,
        leaveId: leave._id,
      }
    });

    try {
      const applicant = await User.findById(leave.applicant).select('name email');
      if (applicant?.email) {
        const { subject, html, text } = leaveStatusEmail({
          userName: applicant.name || applicant.email?.split('@')[0],
          status: 'rejected',
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          totalDays: leave.totalDays,
          approverName: user.name,
          note,
        });
        await sendEmail({ to: applicant.email, subject, html, text });
      }
    } catch (mailError) {
      console.error('Leave rejected email failed:', mailError.message);
    }
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.json({
      message: 'Leave rejected',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave reject error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Revoke approved leave (Admin only)
router.post('/revoke/:leaveId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }

    if (leave.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved leaves can be revoked' });
    }

    leave.status = 'revoked';
    leave.approver = user._id;
    leave.approverNote = note || 'Revoked by admin';
    leave.actionHistory.push({
      action: 'revoked',
      actionBy: user._id,
      actionByRole: user.role,
      note: note || 'Leave revoked by admin',
      actionDate: new Date(),
    });

    await leave.save();

    await Notification.create({
      recipient: leave.applicant,
      type: 'leave_revoked',
      title: 'Leave Revoked',
      message: `Your ${leave.leaveType} leave (${leave.totalDays} days) was revoked by Admin.`,
      category: 'leave',
      data: {
        senderId: user._id,
        senderName: user.name,
        leaveId: leave._id,
      },
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');

    res.json({ message: 'Leave revoked successfully', leave: populatedLeave });
  } catch (error) {
    console.error('Leave revoke error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request reapply with note - any higher role can request
router.post('/request-reapply/:leaveId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    
    if (!note) {
      return res.status(400).json({ message: 'Note is required for reapply request' });
    }
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    
    // Check if user has authority
    if (!canTakeAction(user.role, leave.applicantRole)) {
      return res.status(403).json({ message: 'You do not have authority for this action' });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave is not in pending status' });
    }
    
    leave.status = 'reapply_requested';
    leave.approver = user._id;
    leave.approverNote = note;
    leave.actionHistory.push({
      action: 'reapply_requested',
      actionBy: user._id,
      actionByRole: user.role,
      note: note,
      actionDate: new Date(),
    });
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.json({
      message: 'Reapply request sent',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave reapply request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Grant/revoke punch permission during leave (HR/Admin/CEO)
router.post('/punch-permission/:userId', auth, async (req, res) => {
  try {
    const actor = await User.findById(req.user.userId);
    if (!actor || !['admin', 'hr', 'ceo'].includes(actor.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const target = await User.findById(req.params.userId);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allow = !!req.body?.allow;
    const note = String(req.body?.note || '').trim();

    target.leavePunchPermission = {
      allowed: allow,
      note,
      grantedBy: actor._id,
      grantedAt: new Date(),
    };

    await target.save();

    await Notification.create({
      recipient: target._id,
      type: 'system',
      title: allow ? 'Punch Permission Granted' : 'Punch Permission Revoked',
      message: allow
        ? 'HR/Admin granted permission to punch during leave.'
        : 'Punch permission during leave has been revoked.',
      category: 'attendance',
      data: {
        senderId: actor._id,
        senderName: actor.name,
      },
    });

    res.json({ message: 'Permission updated', allowed: allow });
  } catch (error) {
    console.error('Punch permission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reapply leave (update and resubmit)
router.post('/reapply/:leaveId', auth, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    
    // Only applicant can reapply
    if (leave.applicant.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'You can only reapply your own leave' });
    }
    
    if (leave.status !== 'reapply_requested') {
      return res.status(400).json({ message: 'Leave is not in reapply requested status' });
    }
    
    // Calculate total days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Update leave details
    leave.leaveType = leaveType;
    leave.startDate = start;
    leave.endDate = end;
    leave.totalDays = totalDays;
    leave.reason = reason;
    leave.status = 'pending';
    leave.approverNote = '';
    leave.actionHistory.push({
      action: 'reapplied',
      actionBy: user._id,
      actionByRole: user.role,
      note: reason,
      actionDate: new Date(),
    });
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.json({
      message: 'Leave reapplied successfully',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave reapply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leave stats for dashboard
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // My leaves stats
    const myLeaves = await Leave.aggregate([
      { $match: { applicant: user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Pending approvals count (for supervisors)
    let pendingApprovals = 0;
    const userLevel = ROLE_LEVELS[user.role] || 0;
    
    if (userLevel > 1) { // Manager and above
      const lowerRoles = Object.entries(ROLE_LEVELS)
        .filter(([role, level]) => level < userLevel && role !== 'admin')
        .map(([role]) => role);
      
      pendingApprovals = await Leave.countDocuments({
        applicantRole: { $in: lowerRoles },
        status: 'pending',
      });
    }
    
    res.json({
      myLeaves: myLeaves.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      pendingApprovals,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// Approve leave
router.post('/approve/:leaveId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    
    // Check if user has authority to approve
    if (leave.approverRole !== user.role) {
      return res.status(403).json({ message: 'You do not have authority to approve this leave' });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave is not in pending status' });
    }
    
    leave.status = 'approved';
    leave.approver = user._id;
    leave.approverNote = note || '';
    leave.actionHistory.push({
      action: 'approved',
      actionBy: user._id,
      actionByRole: user.role,
      note: note || 'Leave approved',
      actionDate: new Date(),
    });
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.json({
      message: 'Leave approved successfully',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave approve error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject leave
router.post('/reject/:leaveId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    
    // Check if user has authority to reject
    if (leave.approverRole !== user.role) {
      return res.status(403).json({ message: 'You do not have authority to reject this leave' });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave is not in pending status' });
    }
    
    leave.status = 'rejected';
    leave.approver = user._id;
    leave.approverNote = note || '';
    leave.actionHistory.push({
      action: 'rejected',
      actionBy: user._id,
      actionByRole: user.role,
      note: note || 'Leave rejected',
      actionDate: new Date(),
    });
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.json({
      message: 'Leave rejected',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave reject error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request reapply with note
router.post('/request-reapply/:leaveId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    
    if (!note) {
      return res.status(400).json({ message: 'Note is required for reapply request' });
    }
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    
    // Check if user has authority
    if (leave.approverRole !== user.role) {
      return res.status(403).json({ message: 'You do not have authority for this action' });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave is not in pending status' });
    }
    
    leave.status = 'reapply_requested';
    leave.approver = user._id;
    leave.approverNote = note;
    leave.actionHistory.push({
      action: 'reapply_requested',
      actionBy: user._id,
      actionByRole: user.role,
      note: note,
      actionDate: new Date(),
    });
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.json({
      message: 'Reapply request sent',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave reapply request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reapply leave (update and resubmit)
router.post('/reapply/:leaveId', auth, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }
    
    // Only applicant can reapply
    if (leave.applicant.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'You can only reapply your own leave' });
    }
    
    if (leave.status !== 'reapply_requested') {
      return res.status(400).json({ message: 'Leave is not in reapply requested status' });
    }
    
    // Calculate total days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Update leave details
    leave.leaveType = leaveType;
    leave.startDate = start;
    leave.endDate = end;
    leave.totalDays = totalDays;
    leave.reason = reason;
    leave.status = 'pending';
    leave.approverNote = '';
    leave.actionHistory.push({
      action: 'reapplied',
      actionBy: user._id,
      actionByRole: user.role,
      note: reason,
      actionDate: new Date(),
    });
    
    await leave.save();
    
    const populatedLeave = await Leave.findById(leave._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role');
    
    res.json({
      message: 'Leave reapplied successfully',
      leave: populatedLeave,
    });
  } catch (error) {
    console.error('Leave reapply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leave stats for dashboard
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // My leaves stats
    const myLeaves = await Leave.aggregate([
      { $match: { applicant: user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Pending approvals count (for supervisors)
    let pendingApprovals = 0;
    if (['manager', 'hr', 'ceo'].includes(user.role)) {
      pendingApprovals = await Leave.countDocuments({
        approverRole: user.role,
        status: 'pending',
      });
    }
    
    res.json({
      myLeaves: myLeaves.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      pendingApprovals,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
