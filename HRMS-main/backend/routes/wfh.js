const express = require('express');
const router = express.Router();
const WfhRequest = require('../models/WfhRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { sendEmail } = require('../services/email');
const { wfhStatusEmail } = require('../services/emailTemplates');

const ROLE_LEVELS = {
  employee: 1,
  manager: 2,
  hr: 3,
  ceo: 4,
  admin: 5,
};

const canTakeAction = (actionTakerRole, applicantRole) => {
  const actionTakerLevel = ROLE_LEVELS[actionTakerRole] || 0;
  const applicantLevel = ROLE_LEVELS[applicantRole] || 0;
  return actionTakerLevel > applicantLevel;
};

router.post('/apply', auth, async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'ceo' || user.role === 'admin') {
      return res.status(400).json({ message: 'CEO/Admin cannot apply for WFH through this system' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const reqDoc = new WfhRequest({
      applicant: user._id,
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

    await reqDoc.save();

    const supervisors = await User.find({ role: { $in: ['admin', 'hr', 'ceo'] } })
      .select('_id name')
      .lean();

    const recipients = new Set(supervisors.map(u => u._id.toString()));
    if (user.reportsTo) recipients.add(user.reportsTo.toString());

    await Promise.all(
      Array.from(recipients).map((rid) => Notification.create({
        recipient: rid,
        type: 'wfh_applied',
        title: 'WFH Request',
        message: `${user.name || 'Employee'} applied for WFH (${totalDays} day${totalDays > 1 ? 's' : ''}).`,
        category: 'wfh',
        data: {
          senderId: user._id,
          senderName: user.name,
          actionUrl: '/wfh-management',
        },
      }))
    );

    const populated = await WfhRequest.findById(reqDoc._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role');

    res.status(201).json({ message: 'WFH request submitted', request: populated });
  } catch (error) {
    console.error('WFH apply error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/my-requests', auth, async (req, res) => {
  try {
    const requests = await WfhRequest.find({ applicant: req.user.userId })
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/pending-approvals', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userLevel = ROLE_LEVELS[user.role] || 0;
    const lowerRoles = Object.entries(ROLE_LEVELS)
      .filter(([role, level]) => level < userLevel && role !== 'admin')
      .map(([role]) => role);

    if (lowerRoles.length === 0) return res.json([]);

    let applicantFilter = { applicantRole: { $in: lowerRoles } };

    if (user.role === 'manager') {
      const reportIds = await User.find({ reportsTo: user._id, isActive: true })
        .select('_id')
        .lean();
      const ids = reportIds.map(r => r._id);
      if (ids.length === 0) return res.json([]);
      applicantFilter = { applicant: { $in: ids } };
    }

    const requests = await WfhRequest.find({
      ...applicantFilter,
      status: 'pending',
    })
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/all-visible', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userLevel = ROLE_LEVELS[user.role] || 1;
    const visibleRoles = Object.entries(ROLE_LEVELS)
      .filter(([role, level]) => level < userLevel && role !== 'admin')
      .map(([role]) => role);

    if (visibleRoles.length === 0) return res.json([]);

    let filter = { applicantRole: { $in: visibleRoles } };

    if (user.role === 'manager') {
      const reportIds = await User.find({ reportsTo: user._id, isActive: true })
        .select('_id')
        .lean();
      const ids = reportIds.map(r => r._id);
      if (ids.length === 0) return res.json([]);
      filter = { applicant: { $in: ids } };
    }

    const requests = await WfhRequest.find(filter)
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'admin' && user.role !== 'ceo')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const requests = await WfhRequest.find({})
      .populate('applicant', 'name email employeeId role department')
      .populate('actionHistory.actionBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/approve/:requestId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = await WfhRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'WFH request not found' });

    if (!canTakeAction(user.role, request.applicantRole)) {
      return res.status(403).json({ message: 'You do not have authority to approve this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    request.status = 'approved';
    request.approver = user._id;
    request.approverNote = note || '';
    request.actionHistory.push({
      action: 'approved',
      actionBy: user._id,
      actionByRole: user.role,
      note: note || 'WFH approved',
      actionDate: new Date(),
    });

    await request.save();

    await Notification.create({
      recipient: request.applicant,
      type: 'wfh_approved',
      title: 'WFH Approved ✓',
      message: `Your WFH request (${request.totalDays} day${request.totalDays > 1 ? 's' : ''}) was approved by ${user.name}.`,
      category: 'wfh',
      data: {
        senderId: user._id,
        senderName: user.name,
        actionUrl: '/wfh-management',
      },
    });

    try {
      const applicant = await User.findById(request.applicant).select('name email');
      if (applicant?.email) {
        const { subject, html, text } = wfhStatusEmail({
          userName: applicant.name || applicant.email?.split('@')[0],
          status: 'approved',
          startDate: request.startDate,
          endDate: request.endDate,
          totalDays: request.totalDays,
          approverName: user.name,
          note,
        });
        await sendEmail({ to: applicant.email, subject, html, text });
      }
    } catch (mailError) {
      console.error('WFH approved email failed:', mailError.message);
    }

    const populated = await WfhRequest.findById(request._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');

    res.json({ message: 'WFH approved', request: populated });
  } catch (error) {
    console.error('WFH approve error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reject/:requestId', auth, async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = await WfhRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'WFH request not found' });

    if (!canTakeAction(user.role, request.applicantRole)) {
      return res.status(403).json({ message: 'You do not have authority to reject this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    request.status = 'rejected';
    request.approver = user._id;
    request.approverNote = note || '';
    request.actionHistory.push({
      action: 'rejected',
      actionBy: user._id,
      actionByRole: user.role,
      note: note || 'WFH rejected',
      actionDate: new Date(),
    });

    await request.save();

    await Notification.create({
      recipient: request.applicant,
      type: 'wfh_rejected',
      title: 'WFH Rejected',
      message: `Your WFH request was rejected${note ? `: ${note}` : ''}.`,
      category: 'wfh',
      data: {
        senderId: user._id,
        senderName: user.name,
        actionUrl: '/wfh-management',
      },
    });

    try {
      const applicant = await User.findById(request.applicant).select('name email');
      if (applicant?.email) {
        const { subject, html, text } = wfhStatusEmail({
          userName: applicant.name || applicant.email?.split('@')[0],
          status: 'rejected',
          startDate: request.startDate,
          endDate: request.endDate,
          totalDays: request.totalDays,
          approverName: user.name,
          note,
        });
        await sendEmail({ to: applicant.email, subject, html, text });
      }
    } catch (mailError) {
      console.error('WFH rejected email failed:', mailError.message);
    }

    const populated = await WfhRequest.findById(request._id)
      .populate('applicant', 'name email employeeId role department')
      .populate('approver', 'name email role')
      .populate('actionHistory.actionBy', 'name email role');

    res.json({ message: 'WFH rejected', request: populated });
  } catch (error) {
    console.error('WFH reject error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const myRequests = await WfhRequest.aggregate([
      { $match: { applicant: user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    let pendingApprovals = 0;
    const userLevel = ROLE_LEVELS[user.role] || 0;
    if (userLevel > 1) {
      const lowerRoles = Object.entries(ROLE_LEVELS)
        .filter(([role, level]) => level < userLevel && role !== 'admin')
        .map(([role]) => role);

      pendingApprovals = await WfhRequest.countDocuments({
        applicantRole: { $in: lowerRoles },
        status: 'pending',
      });
    }

    res.json({
      myRequests: myRequests.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      pendingApprovals,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
