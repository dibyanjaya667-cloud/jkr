import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'
import AttendanceReport from '../components/AttendanceReport'
import OvertimeManagement from '../components/OvertimeManagement'

function ManagerDashboard({ onLogout }) {
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [teamLeaves, setTeamLeaves] = useState([])
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dailyAttendance, setDailyAttendance] = useState([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyError, setDailyError] = useState('')
  const [noteByLeaveId, setNoteByLeaveId] = useState({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [userRes, pendingRes, allRes] = await Promise.all([
        axios.get(`${API_URL}/auth/me`, { headers }),
        axios.get(`${API_URL}/leave/pending-approvals`, { headers }),
        axios.get(`${API_URL}/leave/all-visible`, { headers }),
      ])

      setUser(userRes.data)
      setPendingLeaves(pendingRes.data || [])
      setTeamLeaves(allRes.data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }, [])

  const fetchDailyAttendance = useCallback(async (dateValue) => {
    setDailyLoading(true)
    setDailyError('')
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const res = await axios.get(
        `${API_URL}/admin/team-today-attendance?date=${encodeURIComponent(dateValue)}`,
        { headers }
      )
      setDailyAttendance(res.data || [])
    } catch (error) {
      setDailyError(error.response?.data?.message || 'Failed to load daily attendance')
      setDailyAttendance([])
    } finally {
      setDailyLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    if (dailyDate) fetchDailyAttendance(dailyDate)
  }, [dailyDate, fetchDailyAttendance])

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

  const getLateStatus = (punchInTime) => {
    if (!punchInTime) return null
    const time = new Date(punchInTime)
    const hours = time.getHours()
    const minutes = time.getMinutes()
    const totalMins = hours * 60 + minutes
    const target = 9 * 60 // 9:00 AM

    if (totalMins <= target + 10) return 'ontime' // 9:00-9:10
    if (totalMins <= target + 45) return 'yellow' // 9:11-9:45
    if (totalMins <= target + 60) return 'lightred' // 9:46-10:00
    return 'red' // after 10:00
  }

  const dailyCounts = useMemo(() => {
    const list = Array.isArray(dailyAttendance) ? dailyAttendance : []
    let punchedIn = 0
    let punchedOut = 0
    let ontime = 0
    let yellow = 0
    let lightred = 0
    let red = 0
    list.forEach((emp) => {
      if (emp?.punchIn?.time) {
        punchedIn += 1
        const status = getLateStatus(emp.punchIn.time)
        if (status === 'ontime') ontime += 1
        else if (status === 'yellow') yellow += 1
        else if (status === 'lightred') lightred += 1
        else if (status === 'red') red += 1
      }
      if (emp?.punchOut?.time) punchedOut += 1
    })
    return {
      total: list.length,
      punchedIn,
      punchedOut,
      notPunchedIn: Math.max(0, list.length - punchedIn),
      ontime,
      yellow,
      lightred,
      red,
    }
  }, [dailyAttendance])

  const handleLeaveAction = async (leaveId, action) => {
    try {
      const token = localStorage.getItem('token')
      const note = noteByLeaveId[leaveId] || ''
      const ep = action === 'approve' ? 'approve' : 'reject'
      await axios.post(`${API_URL}/leave/${ep}/${leaveId}`, { note }, { headers: { Authorization: `Bearer ${token}` } })
      setNoteByLeaveId((prev) => ({ ...prev, [leaveId]: '' }))
      fetchData()
    } catch (error) {
      console.error('Leave action error:', error)
      alert(error.response?.data?.message || 'Failed to update leave')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50">Loading Manager Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="w-full px-5 md:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Manager Panel</h1>
            <p className="text-white/50 text-xs">Team attendance & leave management</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchData}
              className="text-[11px] text-white/70 hover:text-white bg-white/10 px-2.5 py-1 rounded-lg"
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="text-[11px] text-white/70 hover:text-white bg-white/10 px-2.5 py-1 rounded-lg"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 overflow-y-auto px-5 md:px-8 py-6 space-y-6">

        {/* Daily Team Attendance Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-white">📌 Daily Team Attendance</h2>
              <p className="text-white/50 text-xs">Selected day summary for your team</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <button
                onClick={() => fetchDailyAttendance(dailyDate)}
                className="text-xs text-white/70 hover:text-white bg-white/10 px-3 py-2 rounded-lg"
              >
                Refresh
              </button>
            </div>
          </div>

          {dailyError && (
            <div className="px-5 py-3 text-rose-300 text-xs">{dailyError}</div>
          )}

          <div className="p-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-white/50 text-[10px]">Team Members</p>
              <p className="text-white text-lg font-bold leading-tight">{dailyCounts.total}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-white/50 text-[10px]">Punched In</p>
              <p className="text-white text-lg font-bold leading-tight">{dailyCounts.punchedIn}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-white/50 text-[10px]">Punched Out</p>
              <p className="text-white text-lg font-bold leading-tight">{dailyCounts.punchedOut}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-white/50 text-[10px]">Not Punched In</p>
              <p className="text-white text-lg font-bold leading-tight">{dailyCounts.notPunchedIn}</p>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3">
              <p className="text-emerald-200 text-[10px]">🟢 On Time</p>
              <p className="text-emerald-200 text-lg font-bold leading-tight">{dailyCounts.ontime}</p>
            </div>
            <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-3">
              <p className="text-amber-200 text-[10px]">🟡 Slight Late</p>
              <p className="text-amber-200 text-lg font-bold leading-tight">{dailyCounts.yellow}</p>
            </div>
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-3">
              <p className="text-orange-200 text-[10px]">🟠 Late</p>
              <p className="text-orange-200 text-lg font-bold leading-tight">{dailyCounts.lightred}</p>
            </div>
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-200 text-[10px]">🔴 Very Late</p>
              <p className="text-red-200 text-lg font-bold leading-tight">{dailyCounts.red}</p>
            </div>
          </div>

          {dailyLoading && (
            <div className="px-5 pb-5 text-white/40 text-xs">Loading...</div>
          )}
        </motion.div>

        {/* Team Attendance (Excel Format) */}
        <AttendanceReport scope="manager" />

        {/* Pending Leave Requests */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden mt-6"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">📝 Pending Leave Requests</h2>
            <button
              onClick={fetchData}
              className="text-sm text-white/60 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg"
            >
              🔄 Refresh
            </button>
          </div>

          {pendingLeaves.length === 0 ? (
            <div className="p-10 text-center">
              <span className="text-4xl mb-4 block">✅</span>
              <p className="text-white/50">No pending leave requests</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {pendingLeaves.map((leave, idx) => (
                <motion.div
                  key={leave._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-semibold text-sm">{leave.applicant?.name || 'Employee'}</p>
                      <p className="text-white/50 text-xs">{leave.applicant?.employeeId} • {leave.applicant?.department || 'Dept'}</p>
                    </div>
                    <span className="text-xs bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full">PENDING</span>
                  </div>
                  <div className="text-white/60 text-xs mb-2">
                    <span className="font-medium text-white/80">{leave.leaveType}</span> • {leave.totalDays} day(s)
                  </div>
                  <div className="text-white/50 text-xs mb-3">
                    {fmtDate(leave.startDate)} → {fmtDate(leave.endDate)}
                  </div>
                  <p className="text-white/50 text-xs mb-3 line-clamp-2">{leave.reason}</p>

                  <input
                    value={noteByLeaveId[leave._id] || ''}
                    onChange={(e) => setNoteByLeaveId((prev) => ({ ...prev, [leave._id]: e.target.value }))}
                    placeholder="Add note (optional)"
                    className="w-full mb-3 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLeaveAction(leave._id, 'approve')}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-xs font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleLeaveAction(leave._id, 'reject')}
                      className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-lg text-xs font-medium"
                    >
                      Reject
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Team Leave Records */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">📄 Team Leave Records</h2>
            <button
              onClick={fetchData}
              className="text-sm text-white/60 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg"
            >
              🔄 Refresh
            </button>
          </div>

          {teamLeaves.length === 0 ? (
            <div className="p-10 text-center">
              <span className="text-4xl mb-4 block">📭</span>
              <p className="text-white/50">No leave records for your team</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[1000px] w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-white/10">
                  <tr>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-4 py-3">Employee</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-4 py-3">Type</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-4 py-3">Dates</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-4 py-3">Days</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {teamLeaves.map((leave, idx) => (
                    <tr
                      key={leave._id}
                      className={idx % 2 === 0 ? 'bg-white/[0.02] border-b border-white/5' : 'bg-transparent border-b border-white/5'}
                    >
                      <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                        <div className="font-medium text-white">{leave.applicant?.name || 'Employee'}</div>
                        <div className="text-white/40 text-xs">{leave.applicant?.employeeId || '—'} • {leave.applicant?.department || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{leave.leaveType || '—'}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                        {fmtDate(leave.startDate)} → {fmtDate(leave.endDate)}
                      </td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{leave.totalDays || 0}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/70 border border-white/10">
                          {leave.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs max-w-[320px]">
                        {leave.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* OT Management */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">⏱️ OT Management</h2>
            <button
              onClick={fetchData}
              className="text-sm text-white/60 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg"
            >
              🔄 Refresh
            </button>
          </div>
          <div className="p-4">
            <OvertimeManagement scope="manager" title="Team OT Requests" />
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export default ManagerDashboard
