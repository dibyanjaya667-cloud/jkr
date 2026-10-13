import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'earned', label: 'Earned Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'other', label: 'Other' },
]

const STATUS_CONFIG = {
  pending: { label: 'Pending', bg: 'bg-amber-500', textColor: 'text-white' },
  approved: { label: 'Approved', bg: 'bg-emerald-500/20', textColor: 'text-emerald-400' },
  rejected: { label: 'Rejected', bg: 'bg-red-500', textColor: 'text-white' },
  reapply_requested: { label: 'Reapply', bg: 'bg-orange-500', textColor: 'text-white' },
  revoked: { label: 'Revoked', bg: 'bg-gray-500/20', textColor: 'text-gray-200' },
}

const ROLE_LEVELS = { employee: 1, manager: 2, hr: 3, ceo: 4, admin: 5 }

const canTakeAction = (userRole, applicantRole) => (ROLE_LEVELS[userRole] || 0) > (ROLE_LEVELS[applicantRole] || 0)

// Icons
const Icons = {
  back: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  plus: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  calendar: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  check: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  x: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  refresh: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  clock: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  user: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  home: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  team: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  document: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
}

function LeaveManagement() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('my')
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [allLeaves, setAllLeaves] = useState([])
  const [myLeaves, setMyLeaves] = useState([])
  const [stats, setStats] = useState({ myLeaves: {}, pendingApprovals: 0 })
  const [loading, setLoading] = useState(true)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState(null)
  const [actionType, setActionType] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [showReapplyModal, setShowReapplyModal] = useState(false)
  
  const [form, setForm] = useState({ leaveType: 'casual', startDate: '', endDate: '', reason: '' })
  const token = localStorage.getItem('token')

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      setUser(res.data)
    } catch { navigate('/login') }
  }, [token, navigate])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const isSuper = ['manager', 'hr', 'ceo', 'admin'].includes(user.role)
      const [pendingRes, allRes, myRes, statsRes] = await Promise.all([
        isSuper ? axios.get(`${API_URL}/leave/pending-approvals`, { headers: { Authorization: `Bearer ${token}` } }) : { data: [] },
        isSuper ? (user.role === 'admin' 
          ? axios.get(`${API_URL}/leave/all`, { headers: { Authorization: `Bearer ${token}` } })
          : axios.get(`${API_URL}/leave/all-visible`, { headers: { Authorization: `Bearer ${token}` } })) : { data: [] },
        axios.get(`${API_URL}/leave/my-leaves`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/leave/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      setPendingLeaves(pendingRes.data)
      setAllLeaves(allRes.data)
      setMyLeaves(myRes.data)
      setStats(statsRes.data)
      if (isSuper && pendingRes.data.length > 0) setActiveTab('pending')
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user, token])

  useEffect(() => { fetchUser() }, [fetchUser])
  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  const handleApply = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/leave/apply`, form, { headers: { Authorization: `Bearer ${token}` } })
      setShowApplyModal(false)
      setForm({ leaveType: 'casual', startDate: '', endDate: '', reason: '' })
      fetchData()
    } catch (err) { alert(err.response?.data?.message || 'Error') }
  }

  const handleAction = async () => {
    if (!selectedLeave || !actionType) return
    try {
      const ep = actionType === 'approve' ? 'approve' : actionType === 'reject' ? 'reject' : actionType === 'revoke' ? 'revoke' : 'request-reapply'
      await axios.post(`${API_URL}/leave/${ep}/${selectedLeave._id}`, { note: actionNote }, { headers: { Authorization: `Bearer ${token}` } })
      setShowActionModal(false)
      setSelectedLeave(null)
      setActionType('')
      setActionNote('')
      fetchData()
    } catch (err) { alert(err.response?.data?.message || 'Error') }
  }

  const handleReapply = async (e) => {
    e.preventDefault()
    if (!selectedLeave) return
    try {
      await axios.post(`${API_URL}/leave/reapply/${selectedLeave._id}`, form, { headers: { Authorization: `Bearer ${token}` } })
      setShowReapplyModal(false)
      setSelectedLeave(null)
      setForm({ leaveType: 'casual', startDate: '', endDate: '', reason: '' })
      fetchData()
    } catch (err) { alert(err.response?.data?.message || 'Error') }
  }

  const openReapply = (leave) => {
    setSelectedLeave(leave)
    setForm({
      leaveType: leave.leaveType,
      startDate: new Date(leave.startDate).toISOString().split('T')[0],
      endDate: new Date(leave.endDate).toISOString().split('T')[0],
      reason: leave.reason,
    })
    setShowReapplyModal(true)
  }

  const deletePendingLeave = async (leaveId) => {
    if (!confirm('Delete this pending leave?')) return
    try {
      await axios.delete(`${API_URL}/leave/${leaveId}`, { headers: { Authorization: `Bearer ${token}` } })
      fetchData()
    } catch (err) {
      alert(err.response?.data?.message || 'Error')
    }
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

  const LeaveCard = ({ leave }) => {
    const st = STATUS_CONFIG[leave.status]
    const lt = LEAVE_TYPES.find(l => l.value === leave.leaveType) || LEAVE_TYPES[6]
    const canAct = leave.status === 'pending' && canTakeAction(user?.role, leave.applicantRole)
    const canReapply = leave.applicant?._id === user?._id && leave.status === 'reapply_requested'
    const canRevoke = user?.role === 'admin' && leave.status === 'approved'
    const canDelete = leave.applicant?._id === user?._id && leave.status === 'pending'
    const canGrantPunch = ['admin', 'hr', 'ceo'].includes(user?.role) && leave.status === 'approved'

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black rounded-xl p-3 border border-white/5 shadow-lg shadow-black/20"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-[11px] font-bold">
              {leave.applicant?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-white font-semibold text-xs">{leave.applicant?.name || 'Unknown'}</p>
              <p className="text-white/50 text-[10px] capitalize">{leave.applicantRole} • {leave.applicant?.employeeId}</p>
            </div>
          </div>
          <span className={`${st.bg} ${st.textColor} text-[10px] px-2 py-0.5 rounded-full font-medium`}>
            {st.label}
          </span>
        </div>

        {/* Leave Info */}
        <div className="bg-white/5 rounded-lg p-2 mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/70 text-xs">{lt.label}</span>
            <span className="text-white font-semibold text-xs">{leave.totalDays} Day{leave.totalDays > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-[10px]">
            <span className="text-white/40">{Icons.calendar}</span>
            <span>{fmtDate(leave.startDate)}</span>
            <span className="text-white/30">→</span>
            <span>{fmtDate(leave.endDate)}</span>
          </div>
        </div>

        {/* Reason */}
        <p className="text-white/60 text-[10px] mb-2 line-clamp-2">{leave.reason}</p>

        {/* Approver Note */}
        {leave.approverNote && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-2">
            <p className="text-amber-400 text-[10px]">{leave.approverNote}</p>
          </div>
        )}

        {/* Action Buttons */}
        {canAct && (
          <div className="flex gap-2 pt-2 border-t border-white/10">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedLeave(leave); setActionType('approve'); setShowActionModal(true) }}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 rounded-lg font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
            >
              {Icons.check} Approve
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedLeave(leave); setActionType('reject'); setShowActionModal(true) }}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
            >
              {Icons.x} Reject
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedLeave(leave); setActionType('reapply_request'); setShowActionModal(true) }}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-1.5 rounded-lg font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
            >
              {Icons.refresh} Reapply
            </motion.button>
          </div>
        )}

        {canRevoke && (
          <div className="pt-2 border-t border-white/10">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedLeave(leave); setActionType('revoke'); setShowActionModal(true) }}
              className="w-full bg-gray-500/20 hover:bg-gray-500/30 text-gray-200 py-1.5 rounded-lg font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
            >
              {Icons.refresh} Revoke
            </motion.button>
          </div>
        )}

        {canDelete && (
          <div className="pt-2 border-t border-white/10">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => deletePendingLeave(leave._id)}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-200 py-1.5 rounded-lg font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
            >
              {Icons.x} Delete Pending Leave
            </motion.button>
          </div>
        )}

        {canGrantPunch && (
          <div className="pt-2 border-t border-white/10 flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try {
                  await axios.post(`${API_URL}/leave/punch-permission/${leave.applicant?._id}`,
                    { allow: true, note: `Leave: ${leave.leaveType}` },
                    { headers: { Authorization: `Bearer ${token}` } }
                  )
                  fetchData()
                } catch (err) { alert(err.response?.data?.message || 'Error') }
              }}
              className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 py-1.5 rounded-lg font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
            >
              {Icons.check} Allow Punch
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try {
                  await axios.post(`${API_URL}/leave/punch-permission/${leave.applicant?._id}`,
                    { allow: false, note: `Leave: ${leave.leaveType}` },
                    { headers: { Authorization: `Bearer ${token}` } }
                  )
                  fetchData()
                } catch (err) { alert(err.response?.data?.message || 'Error') }
              }}
              className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 py-1.5 rounded-lg font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
            >
              {Icons.x} Revoke Punch
            </motion.button>
          </div>
        )}

        {/* Reapply Button for Applicant */}
        {canReapply && (
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => openReapply(leave)}
            className="w-full bg-white text-black py-2 rounded-lg font-semibold text-xs mt-2 transition-colors hover:bg-gray-100"
          >
            Reapply Now
          </motion.button>
        )}
      </motion.div>
    )
  }

  const isSuper = ['manager', 'hr', 'ceo', 'admin'].includes(user?.role)

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'team', label: 'Team' },
    { id: 'leave', label: 'Leaves' },
    { id: 'profile', label: 'Profile' },
  ]

  const TabIcon = ({ id, active }) => {
    const color = active ? 'white' : 'rgba(255,255,255,0.5)'
    const iconMap = {
      home: Icons.home,
      team: Icons.team,
      leave: Icons.calendar,
      profile: Icons.user,
    }
    return <span style={{ color }}>{iconMap[id]}</span>
  }

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-black" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex justify-center">
      {/* Phone Frame - Same as Dashboard */}
      <div className="relative w-full max-w-md h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col overflow-hidden md:my-4 md:h-[calc(100vh-2rem)] md:rounded-[28px] md:border md:border-white/10 md:shadow-2xl">
        
        {/* Sticky Top Bar */}
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between rounded-b-2xl">
          <div className="flex items-center gap-3">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/dashboard')}
              className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white"
            >
              {Icons.back}
            </motion.button>
            <div>
              <p className="text-white font-semibold text-sm">Leave Management</p>
              <p className="text-white/50 text-xs">Manage applications</p>
            </div>
          </div>
          {user?.role !== 'ceo' && user?.role !== 'admin' && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowApplyModal(true)}
              className="bg-white text-black px-3 py-2 rounded-xl font-medium text-xs flex items-center gap-1.5"
            >
              {Icons.plus} Apply
            </motion.button>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="px-4 pt-4 pb-6 max-w-md mx-auto">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <motion.div 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="bg-black rounded-2xl p-4 border border-white/10 shadow-lg shadow-black/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white">
                    {Icons.document}
                  </div>
                  <div>
                    <p className="text-white/50 text-xs">My Pending</p>
                    <p className="text-white text-xl font-bold">{stats.myLeaves?.pending || 0}</p>
                  </div>
                </div>
              </motion.div>
              
              {isSuper ? (
                <motion.div 
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-black rounded-2xl p-4 border border-amber-500/20 shadow-lg shadow-amber-500/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white">
                      {Icons.clock}
                    </div>
                    <div>
                      <p className="text-white/50 text-xs">To Approve</p>
                      <p className="text-white/50 text-xl font-bold">{stats.pendingApprovals || 0}</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-black rounded-2xl p-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center text-white">
                      {Icons.check}
                    </div>
                    <div>
                      <p className="text-white/50 text-xs">Approved</p>
                      <p className="text-white text-xl font-bold">{stats.myLeaves?.approved || 0}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-black rounded-2xl p-1.5 flex gap-1 mb-4 border border-white/10">
              {isSuper && (
                <>
                  <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${
                      activeTab === 'pending' ? 'bg-white text-black' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Pending ({pendingLeaves.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${
                      activeTab === 'all' ? 'bg-white text-black' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    All ({allLeaves.length})
                  </button>
                </>
              )}
              <button
                onClick={() => setActiveTab('my')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'my' ? 'bg-white text-black' : 'text-white/50 hover:text-white'
                }`}
              >
                My Leaves ({myLeaves.length})
              </button>
            </div>

            {/* Leave Cards */}
            {loading ? (
              <div className="flex justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-black" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              </div>
            ) : (
              <div className="space-y-3">
                {activeTab === 'pending' && pendingLeaves.map(l => <LeaveCard key={l._id} leave={l} />)}
                {activeTab === 'all' && allLeaves.map(l => <LeaveCard key={l._id} leave={l} />)}
                {activeTab === 'my' && myLeaves.map(l => <LeaveCard key={l._id} leave={l} />)}
                
                {((activeTab === 'pending' && !pendingLeaves.length) ||
                  (activeTab === 'all' && !allLeaves.length) ||
                  (activeTab === 'my' && !myLeaves.length)) && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center mx-auto mb-4 text-white/30">
                      {Icons.document}
                    </div>
                    <p className="text-gray-500 font-medium">No leaves found</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {activeTab === 'my' ? 'Apply for a leave to get started' : 'No pending approvals'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black backdrop-blur-xl border-t border-white/10 px-2 py-3 z-50 rounded-t-2xl">
          <div className="w-full flex justify-around">
            {tabs.map(tab => (
              <motion.button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'leave') return
                  if (tab.id === 'team') {
                    navigate('/my-team')
                  } else {
                    navigate('/dashboard')
                  }
                }}
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${
                  tab.id === 'leave' ? 'bg-white/10' : ''
                }`}
              >
                <TabIcon id={tab.id} active={tab.id === 'leave'} />
                <span className={`text-[10px] font-medium ${tab.id === 'leave' ? 'text-white' : 'text-white/50'}`}>{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </nav>

        {/* Apply Modal */}
        <AnimatePresence>
          {showApplyModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
              onClick={() => setShowApplyModal(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-black w-full max-w-md rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto border border-white/10"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                <h2 className="text-white text-lg font-bold mb-4">Apply for Leave</h2>
                
                <form onSubmit={handleApply} className="space-y-4">
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">Leave Type</label>
                    <select
                      value={form.leaveType}
                      onChange={e => setForm({ ...form, leaveType: e.target.value })}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                    >
                      {LEAVE_TYPES.map(t => <option key={t.value} value={t.value} className="bg-black text-white">{t.label}</option>)}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/60 text-xs mb-1.5 block">Start Date</label>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={e => setForm({ ...form, startDate: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 [color-scheme:dark]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-xs mb-1.5 block">End Date</label>
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={e => setForm({ ...form, endDate: e.target.value })}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 [color-scheme:dark]"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">Reason</label>
                    <textarea
                      value={form.reason}
                      onChange={e => setForm({ ...form, reason: e.target.value })}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/40"
                      placeholder="Why do you need leave?"
                      required
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full bg-white text-black py-3 rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors"
                  >
                    Submit Application
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Modal */}
        <AnimatePresence>
          {showActionModal && selectedLeave && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowActionModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 w-full max-w-sm rounded-2xl p-5"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-white text-lg font-bold mb-2">
                  {actionType === 'approve' ? 'Approve Leave' : actionType === 'reject' ? 'Reject Leave' : 'Request Reapply'}
                </h2>
                
                <p className="text-white/50 text-sm mb-4">
                  {actionType === 'approve' ? 'Are you sure you want to approve this leave?' : 'Please provide a note for the applicant.'}
                </p>
                
                <textarea
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm min-h-[80px] mb-4 focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/40"
                  placeholder={actionType === 'approve' ? 'Optional note...' : 'Add a note (required)...'}
                />
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowActionModal(false)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAction}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors ${
                      actionType === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' :
                      actionType === 'reject' ? 'bg-red-500 hover:bg-red-600' :
                      'bg-white/20 hover:bg-white/30'
                    }`}
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reapply Modal */}
        <AnimatePresence>
          {showReapplyModal && selectedLeave && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
              onClick={() => setShowReapplyModal(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-slate-900 w-full max-w-md rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                <h2 className="text-white text-lg font-bold mb-2">Reapply Leave</h2>
                
                {selectedLeave.approverNote && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                    <p className="text-amber-400 text-sm">{selectedLeave.approverNote}</p>
                  </div>
                )}
                
                <form onSubmit={handleReapply} className="space-y-4">
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">Leave Type</label>
                    <select
                      value={form.leaveType}
                      onChange={e => setForm({ ...form, leaveType: e.target.value })}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                    >
                      {LEAVE_TYPES.map(t => <option key={t.value} value={t.value} className="bg-slate-800 text-white">{t.label}</option>)}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/60 text-xs mb-1.5 block">Start Date</label>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={e => setForm({ ...form, startDate: e.target.value })}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 [color-scheme:dark]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-xs mb-1.5 block">End Date</label>
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={e => setForm({ ...form, endDate: e.target.value })}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 [color-scheme:dark]"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">Reason</label>
                    <textarea
                      value={form.reason}
                      onChange={e => setForm({ ...form, reason: e.target.value })}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/40"
                      placeholder="Updated reason..."
                      required
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full bg-white text-black py-3 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors"
                  >
                    Resubmit Application
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default LeaveManagement
