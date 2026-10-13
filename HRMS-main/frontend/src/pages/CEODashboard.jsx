import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'

function CEODashboard({ onLogout }) {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [userRes, teamRes] = await Promise.all([
        axios.get(`${API_URL}/auth/me`, { headers }),
        axios.get(`${API_URL}/admin/my-team`, { headers }),
      ])

      setUser(userRes.data)
      
      // Calculate stats from team data
      const allEmployees = teamRes.data.allEmployees || []
      const directReports = teamRes.data.directReports || []
      
      // Role distribution
      const roleDistribution = {}
      allEmployees.forEach(emp => {
        roleDistribution[emp.role] = (roleDistribution[emp.role] || 0) + 1
      })

      // Department distribution
      const deptDistribution = {}
      allEmployees.forEach(emp => {
        const dept = emp.department || 'Unassigned'
        deptDistribution[dept] = (deptDistribution[dept] || 0) + 1
      })

      // Online count
      const onlineCount = allEmployees.filter(e => e.isOnline).length

      // Today's attendance
      const today = new Date().toDateString()
      let punchedIn = 0
      let punchedOut = 0
      allEmployees.forEach(emp => {
        const todayAtt = emp.attendance?.find(a => new Date(a.date).toDateString() === today)
        if (todayAtt?.punchIn?.time) punchedIn++
        if (todayAtt?.punchOut?.time) punchedOut++
      })

      setStats({
        totalEmployees: allEmployees.length,
        directReports: directReports.length,
        onlineNow: onlineCount,
        punchedIn,
        punchedOut,
        roleDistribution,
        deptDistribution,
      })
      setUsers(allEmployees)
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50">Loading CEO Dashboard...</p>
        </div>
      </div>
    )
  }

  const roleLabels = {
    ceo: 'CEO',
    hr: 'HR',
    manager: 'Managers',
    employee: 'Employees',
  }

  const roleColors = {
    ceo: 'from-amber-400 to-orange-500',
    hr: 'from-pink-400 to-rose-500',
    manager: 'from-blue-400 to-indigo-500',
    employee: 'from-slate-400 to-slate-500',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Top Header */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">CEO Dashboard</h1>
              <p className="text-white/50 text-sm">Welcome back, {user?.name || 'Chief Executive'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/my-team')}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              My Team
            </button>
            <button
              onClick={fetchData}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
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
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 shadow-xl shadow-amber-500/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">Total Workforce</span>
              <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.totalEmployees || 0}</p>
            <p className="text-white/60 text-xs mt-1">Active employees</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 shadow-xl shadow-emerald-500/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">Online Now</span>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><div className="w-3 h-3 bg-white rounded-full animate-pulse" /></div>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.onlineNow || 0}</p>
            <p className="text-white/60 text-xs mt-1">Currently active</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 shadow-xl shadow-blue-500/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">Punched In Today</span>
              <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.punchedIn || 0}</p>
            <p className="text-white/60 text-xs mt-1">
              {stats?.totalEmployees ? Math.round((stats.punchedIn / stats.totalEmployees) * 100) : 0}% attendance
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 shadow-xl shadow-violet-500/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">Direct Reports</span>
              <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.directReports || 0}</p>
            <p className="text-white/60 text-xs mt-1">Reporting to you</p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Role Distribution */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> Organization Structure</h2>
            <div className="space-y-3">
              {Object.entries(stats?.roleDistribution || {}).map(([role, count]) => (
                <div key={role} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleColors[role] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white text-sm font-bold`}>
                    {count}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-medium">{roleLabels[role] || role}</span>
                      <span className="text-white/50 text-sm">{count}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${roleColors[role] || 'from-gray-400 to-gray-500'} rounded-full`}
                        style={{ width: `${(count / (stats?.totalEmployees || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Department Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> Departments</h2>
            <div className="space-y-3">
              {Object.entries(stats?.deptDistribution || {}).slice(0, 6).map(([dept, count], idx) => {
                const colors = [
                  'from-blue-400 to-cyan-500',
                  'from-violet-400 to-purple-500',
                  'from-pink-400 to-rose-500',
                  'from-amber-400 to-orange-500',
                  'from-emerald-400 to-green-500',
                  'from-slate-400 to-slate-500',
                ]
                return (
                  <div key={dept} className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center text-white text-sm font-bold`}>
                      {count}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-medium truncate">{dept}</span>
                        <span className="text-white/50 text-sm">{count}</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${colors[idx % colors.length]} rounded-full`}
                          style={{ width: `${(count / (stats?.totalEmployees || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/my-team')}
              className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 hover:from-blue-500/30 hover:to-indigo-500/30 border border-blue-500/20 rounded-xl p-4 text-left transition-all"
            >
              <span className="text-2xl mb-2 block"><svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></span>
              <span className="text-white font-medium">View Team</span>
              <p className="text-white/50 text-xs mt-1">See all employees</p>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-br from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30 border border-emerald-500/20 rounded-xl p-4 text-left transition-all"
            >
              <span className="text-2xl mb-2 block"><svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></span>
              <span className="text-white font-medium">My Attendance</span>
              <p className="text-white/50 text-xs mt-1">Personal dashboard</p>
            </button>
            <button
              onClick={() => window.open('mailto:', '_blank')}
              className="bg-gradient-to-br from-violet-500/20 to-purple-500/20 hover:from-violet-500/30 hover:to-purple-500/30 border border-violet-500/20 rounded-xl p-4 text-left transition-all"
            >
              <span className="text-2xl mb-2 block"><svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></span>
              <span className="text-white font-medium">Send Announcement</span>
              <p className="text-white/50 text-xs mt-1">Company-wide message</p>
            </button>
            <button
              onClick={fetchData}
              className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/20 rounded-xl p-4 text-left transition-all"
            >
              <span className="text-2xl mb-2 block"><svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></span>
              <span className="text-white font-medium">Refresh Data</span>
              <p className="text-white/50 text-xs mt-1">Update statistics</p>
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export default CEODashboard
