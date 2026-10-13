import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'

function EmployeeDashboard({ onLogout }) {
  const [user, setUser] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [stats, setStats] = useState({ present: 0, absent: 0, onTime: 0, late: 0 })
  const [loading, setLoading] = useState(true)
  const [nowTick, setNowTick] = useState(Date.now())
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const userRes = await axios.get(`${API_URL}/auth/me`, { headers })
      setUser(userRes.data)

      const att = userRes.data.attendance || []
      setAttendance(att)

      // Today's attendance
      const today = new Date().toDateString()
      const todayAtt = att.find(a => new Date(a.date).toDateString() === today)
      setTodayAttendance(todayAtt)

      // Calculate month stats
      const thisMonth = new Date().getMonth()
      const thisYear = new Date().getFullYear()
      const monthAtt = att.filter(a => {
        const d = new Date(a.date)
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear
      })

      const presentDays = monthAtt.filter(a => a.punchIn).length
      const workingDays = new Date().getDate() // Days passed in month
      
      // On time = punched in before 10 AM
      let onTime = 0, late = 0
      monthAtt.forEach(a => {
        if (a.punchIn?.time) {
          const punchHour = new Date(a.punchIn.time).getHours()
          if (punchHour < 10) onTime++
          else late++
        }
      })

      setStats({
        present: presentDays,
        absent: workingDays - presentDays,
        onTime,
        late,
      })
      
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Live timer for productive time
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  const formatTime = (d) => {
    if (!d) return '--:--'
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (d) => {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }

  const arrivalMeta = (iso) => {
    if (!iso) return { label: '—', cls: 'bg-white/5 text-white/40 border-white/10' }
    const t = new Date(iso)
    if (Number.isNaN(t.getTime())) return { label: '—', cls: 'bg-white/5 text-white/40 border-white/10' }
    const mins = t.getHours() * 60 + t.getMinutes()
    const target = 9 * 60

    if (mins <= target + 10) return { label: '🟢 On Time', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' }
    if (mins <= target + 45) return { label: '🟡 Slight Late', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/30' }
    if (mins <= target + 60) return { label: '🟠 Late', cls: 'bg-orange-500/20 text-orange-200 border-orange-500/30' }
    return { label: '🔴 Very Late', cls: 'bg-red-500/20 text-red-200 border-red-500/30' }
  }

  // Productive time calculation
  const productiveTime = (() => {
    const punchIn = todayAttendance?.punchIn?.time
    const punchOut = todayAttendance?.punchOut?.time
    if (!punchIn) return null

    const startMs = new Date(punchIn).getTime()
    const endMs = punchOut ? new Date(punchOut).getTime() : nowTick
    const workedMs = Math.max(0, endMs - startMs)
    const workedMins = Math.floor(workedMs / (1000 * 60))

    const targetMins = 9 * 60 + 30 // 9h 30m
    const remainingMins = Math.max(0, targetMins - workedMins)
    const percentage = Math.min(100, Math.round((workedMins / targetMins) * 100))

    const formatDuration = (mins) => {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return `${h}h ${m}m`
    }

    const formatLiveTime = (mins) => {
      const h = Math.floor(mins / 60)
      const m = Math.floor(mins % 60)
      const s = Math.floor((workedMs / 1000) % 60)
      return { h: String(h).padStart(2, '0'), m: String(m).padStart(2, '0'), s: String(s).padStart(2, '0') }
    }

    return {
      workedMins,
      targetMins,
      remainingMins,
      percentage,
      workedFormatted: formatDuration(workedMins),
      remainingFormatted: formatDuration(remainingMins),
      targetFormatted: formatDuration(targetMins),
      liveTime: formatLiveTime(workedMins),
      isLive: !punchOut,
    }
  })()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50">Loading...</p>
        </div>
      </div>
    )
  }

  const recentAttendance = [...attendance]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 7)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">My Dashboard</h1>
              <p className="text-white/50 text-sm">Welcome, {user?.name || 'Employee'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm transition-colors font-medium flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Punch In/Out
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-xl text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Today's Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold text-white mb-4">📅 Today's Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center mb-1">
                {todayAttendance?.punchIn?.time 
                  ? <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  : <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                }
              </div>
              <p className="text-white/50 text-sm">Punched In</p>
              <p className="text-emerald-400 font-mono font-bold mt-1">
                {formatTime(todayAttendance?.punchIn?.time)}
              </p>
              <div className="mt-2">
                {(() => {
                  const meta = arrivalMeta(todayAttendance?.punchIn?.time)
                  return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.cls}`}>
                      {meta.label}
                    </span>
                  )
                })()}
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center mb-1">
                {todayAttendance?.punchOut?.time 
                  ? <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  : <svg className="w-8 h-8 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                }
              </div>
              <p className="text-white/50 text-sm">Punched Out</p>
              <p className="text-rose-400 font-mono font-bold mt-1">
                {formatTime(todayAttendance?.punchOut?.time)}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center mb-1">
                {user?.isOnline 
                  ? <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"><div className="w-3 h-3 bg-emerald-300 rounded-full animate-pulse" /></div>
                  : <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center"><div className="w-3 h-3 bg-gray-400 rounded-full" /></div>
                }
              </div>
              <p className="text-white/50 text-sm">Status</p>
              <p className={`font-bold mt-1 ${user?.isOnline ? 'text-emerald-400' : 'text-gray-400'}`}>
                {user?.isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl mb-1">📍</p>
              <p className="text-white/50 text-sm">Location</p>
              <p className="text-blue-400 font-bold mt-1 text-sm">
                {todayAttendance?.punchIn?.location ? 'Tracked' : 'Not Yet'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Productive Time */}
        {productiveTime && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 backdrop-blur border border-emerald-500/20 rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ⏱️ Productive Time
                {productiveTime.isLive && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                    LIVE
                  </span>
                )}
              </h2>
              <div className="text-white/50 text-sm">Target: {productiveTime.targetFormatted}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Live Timer */}
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50 text-sm mb-2">Elapsed Time</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-emerald-400 font-mono">
                    {productiveTime.liveTime.h}
                  </span>
                  <span className="text-white/40 text-xl">:</span>
                  <span className="text-3xl font-bold text-emerald-400 font-mono">
                    {productiveTime.liveTime.m}
                  </span>
                  <span className="text-white/40 text-xl">:</span>
                  <span className="text-3xl font-bold text-emerald-400 font-mono">
                    {productiveTime.liveTime.s}
                  </span>
                </div>
              </div>

              {/* Percentage */}
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50 text-sm mb-2">Progress</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-cyan-400">{productiveTime.percentage}</span>
                  <span className="text-white/40 text-xl">%</span>
                </div>
                <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${productiveTime.percentage}%` }}
                  />
                </div>
              </div>

              {/* Remaining Time */}
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50 text-sm mb-2">Remaining</p>
                <div className="text-3xl font-bold text-amber-400">
                  {productiveTime.remainingFormatted}
                </div>
                {productiveTime.percentage >= 100 && (
                  <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Target achieved!
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Monthly Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4">📊 This Month</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-400">{stats.present}</p>
                <p className="text-white/50 text-sm mt-1">Present Days</p>
              </div>
              <div className="bg-red-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-400">{stats.absent}</p>
                <p className="text-white/50 text-sm mt-1">Absent Days</p>
              </div>
              <div className="bg-blue-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-400">{stats.onTime}</p>
                <p className="text-white/50 text-sm mt-1">On Time</p>
              </div>
              <div className="bg-amber-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-amber-400">{stats.late}</p>
                <p className="text-white/50 text-sm mt-1">Late</p>
              </div>
            </div>

            {/* Attendance Rate */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60 text-sm">Attendance Rate</span>
                <span className="text-white font-bold">
                  {stats.present + stats.absent > 0 
                    ? Math.round((stats.present / (stats.present + stats.absent)) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                  style={{ 
                    width: `${stats.present + stats.absent > 0 
                      ? Math.round((stats.present / (stats.present + stats.absent)) * 100) 
                      : 0}%` 
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* Profile Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4">👤 My Profile</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Name</span>
                <span className="text-white font-medium">{user?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Employee ID</span>
                <span className="text-white font-medium font-mono">{user?.employeeId || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Email</span>
                <span className="text-white font-medium text-sm">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Department</span>
                <span className="text-white font-medium">{user?.department || 'Not Assigned'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Designation</span>
                <span className="text-white font-medium">{user?.designation || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-white/50">Reports To</span>
                <span className="text-white font-medium">
                  {user?.reportsTo?.name || user?.reportsTo?.email || 'Not Assigned'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Attendance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 mt-6"
        >
          <h2 className="text-lg font-bold text-white mb-4">📅 Recent Attendance</h2>
          {recentAttendance.length === 0 ? (
            <p className="text-white/50 text-center py-8">No attendance records yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/50 border-b border-white/10">
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-center px-4 py-3 font-medium">Punch In</th>
                    <th className="text-center px-4 py-3 font-medium">Punch Out</th>
                    <th className="text-center px-4 py-3 font-medium">Arrival</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttendance.map((att, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="px-4 py-3 text-white">{formatDate(att.date)}</td>
                      <td className="px-4 py-3 text-center text-emerald-400 font-mono">
                        {formatTime(att.punchIn?.time)}
                      </td>
                      <td className="px-4 py-3 text-center text-rose-400 font-mono">
                        {formatTime(att.punchOut?.time)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const meta = arrivalMeta(att.punchIn?.time)
                          return (
                            <span className={`px-2 py-1 rounded-full text-xs border ${meta.cls}`}>
                              {meta.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          att.punchIn 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {att.punchIn ? 'Present' : 'Absent'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}

export default EmployeeDashboard
