import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'

// Avatar color palette - vibrant colors like in the reference image
const avatarColors = [
  'from-orange-400 to-orange-600',
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600',
  'from-pink-400 to-pink-600',
  'from-amber-400 to-amber-600',
  'from-cyan-400 to-cyan-600',
  'from-rose-400 to-rose-600',
  'from-indigo-400 to-indigo-600',
  'from-teal-400 to-teal-600',
  'from-fuchsia-400 to-fuchsia-600',
  'from-lime-400 to-lime-600',
]

// Get consistent color for a user based on their ID or name
const getAvatarColor = (user) => {
  const str = user?._id || user?.email || user?.name || 'default'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

// Get initials: first letter of first name + first letter of last name
// If no last name, use first 2 letters of first name
const getInitials = (user) => {
  const name = user?.name || user?.email?.split('@')[0] || ''
  if (!name) return '?'
  
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }
  // Only one word - take first 2 characters
  return name.slice(0, 2).toUpperCase()
}

const getRoleBadge = (role) => {
  const colors = {
    ceo: 'bg-amber-500',
    hr: 'bg-pink-500',
    manager: 'bg-blue-500',
    employee: 'bg-slate-500',
  }
  const labels = {
    ceo: 'CEO',
    hr: 'HR',
    manager: 'Manager',
    employee: 'Employee',
  }
  return (
    <span className={`${colors[role] || 'bg-gray-500'} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>
      {labels[role] || role}
    </span>
  )
}

const tabs = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'team', label: 'Team' },
  { id: 'home', label: 'Home' },
  { id: 'wall', label: 'Wall' },
  { id: 'profile', label: 'Profile' },
]

const TabIcon = ({ id, active }) => {
  const color = active ? 'white' : 'rgba(255,255,255,0.5)'
  switch(id) {
    case 'home':
      return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    case 'team':
      return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    case 'inbox':
      return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-9 8h18a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    case 'wall':
      return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14a2 2 0 012 2v6H3V5a2 2 0 012-2zm-2 10h18v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z" /></svg>
    case 'profile':
      return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    default:
      return null
  }
}

function TeamDashboard() {
  const [teamData, setTeamData] = useState({ currentUser: null, manager: null, peers: [], directReports: [] })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()

  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
  const toAssetUrl = (maybeRelativeUrl) => {
    if (!maybeRelativeUrl) return ''
    if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl
    const normalized = String(maybeRelativeUrl).startsWith('/') ? String(maybeRelativeUrl) : `/${maybeRelativeUrl}`
    return `${API_ORIGIN}${normalized}`
  }

  const fetchTeam = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/team/my-team`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setTeamData(res.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching team:', error)
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchTeam()
    const interval = setInterval(fetchTeam, 30000)
    return () => clearInterval(interval)
  }, [fetchTeam])

  const formatTime = (d) => {
    if (!d) return '--:--'
    try {
      return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '--:--'
    }
  }

  // Match backend attendance day logic (resets at 6:00 AM; stored attendance.date is normalized to 00:00)
  const getAttendanceDay6am = (now = new Date()) => {
    const d = new Date(now)
    if (d.getHours() < 6) d.setDate(d.getDate() - 1)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const getTodayAttendance = (user) => {
    if (user?.todayAttendance) return user.todayAttendance
    const today = getAttendanceDay6am()
    return user.attendance?.find(a => new Date(a.date).toDateString() === today.toDateString())
  }

  const getLateStatus = (punchInTime) => {
    if (!punchInTime) return null
    const time = new Date(punchInTime)
    const hours = time.getHours()
    const minutes = time.getMinutes()
    const totalMins = hours * 60 + minutes
    const target = 9 * 60
    if (totalMins <= target + 10) return 'ontime'
    if (totalMins <= target + 45) return 'yellow'
    if (totalMins <= target + 60) return 'lightred'
    return 'red'
  }

  const getPunchStatus = (user) => {
    const todayAtt = getTodayAttendance(user)
    const punchedIn = !!todayAtt?.punchIn?.time
    const punchedOut = !!todayAtt?.punchOut?.time

    // Late: after 9:10 AM
    let late = false
    if (todayAtt?.punchIn?.time) {
      const status = getLateStatus(todayAtt.punchIn.time)
      late = status && status !== 'ontime'
    }

    return {
      punchedIn,
      punchedOut,
      late,
      notInYet: !punchedIn,
    }
  }

  const getStatusBadge = (user) => {
    const status = getPunchStatus(user)
    const todayAtt = getTodayAttendance(user)
    
    if (!status.punchedIn) {
      return { label: 'Not in', className: 'bg-slate-100 text-slate-600 border-slate-200' }
    }
    
    const lateStatus = getLateStatus(todayAtt?.punchIn?.time)
    if (lateStatus === 'ontime') {
      return { label: '🟢 On Time', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    }
    if (lateStatus === 'yellow') {
      return { label: '🟡 Slight Late', className: 'bg-amber-100 text-amber-700 border-amber-200' }
    }
    if (lateStatus === 'lightred') {
      return { label: '🟠 Late', className: 'bg-orange-100 text-orange-700 border-orange-200' }
    }
    if (lateStatus === 'red') {
      return { label: '🔴 Very Late', className: 'bg-red-100 text-red-700 border-red-200' }
    }
    
    if (!status.punchedOut) {
      return { label: 'Working', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    }
    return { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  }

  const filterBySearch = (list) => {
    if (!searchQuery) return list
    const q = searchQuery.toLowerCase()
    return list.filter(u => (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.employeeId?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q)
    ))
  }

  const applyFilter = (list) => {
    if (filter === 'all') return list
    if (filter === 'not-in') return list.filter(u => getPunchStatus(u).notInYet)
    if (filter === 'late') return list.filter(u => getPunchStatus(u).late)
    if (filter === 'on-time') return list.filter(u => getPunchStatus(u).punchedIn && !getPunchStatus(u).late)
    return list
  }

  const peersRaw = Array.isArray(teamData.peers) ? teamData.peers : []
  const directReportsRaw = Array.isArray(teamData.directReports) ? teamData.directReports : []

  const peersList = filterBySearch(applyFilter(peersRaw))
  const directReportsList = filterBySearch(applyFilter(directReportsRaw))

  const peersTotal = peersRaw.length
  const directReportsTotal = directReportsRaw.length
  const isFiltering = filter !== 'all' || !!searchQuery

  const matchesSearch = (user) => {
    if (!searchQuery) return true
    if (!user) return false
    const q = searchQuery.toLowerCase()
    return (
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.employeeId?.toLowerCase().includes(q) ||
      user.department?.toLowerCase().includes(q) ||
      user.designation?.toLowerCase().includes(q)
    )
  }

  const matchesAttendanceFilter = (user) => {
    if (!user) return false
    if (filter === 'all') return true
    const s = getPunchStatus(user)
    if (filter === 'not-in') return s.notInYet
    if (filter === 'late') return s.late
    if (filter === 'on-time') return s.punchedIn && !s.late
    return true
  }

  // Chips should represent teammates (manager + peers + direct reports), not "Me".
  const peopleForChips = [
    ...(teamData.manager ? [teamData.manager] : []),
    ...peersRaw,
    ...directReportsRaw,
  ]

  const chipCounts = {
    all: peopleForChips.length,
    notIn: peopleForChips.filter(u => getPunchStatus(u).notInYet).length,
    late: peopleForChips.filter(u => getPunchStatus(u).late).length,
    onTime: peopleForChips.filter(u => getPunchStatus(u).punchedIn && !getPunchStatus(u).late).length,
  }

  const showMeSection = !isFiltering
  const showManagerSection = !isFiltering || (
    !!teamData.manager && matchesSearch(teamData.manager) && matchesAttendanceFilter(teamData.manager)
  )

  if (loading) {
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
      <div className="relative w-full max-w-md h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col overflow-hidden md:my-4 md:h-[calc(100vh-2rem)] md:rounded-[28px] md:border md:border-white/10 md:shadow-2xl">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between rounded-b-2xl">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 bg-gradient-to-br ${getAvatarColor(teamData.currentUser)} rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold text-white`}>
            {teamData.currentUser?.profilePicUrl ? (
              <img src={toAssetUrl(teamData.currentUser.profilePicUrl)} alt={teamData.currentUser?.name || 'User'} className="w-full h-full object-cover" />
            ) : (
              getInitials(teamData.currentUser)
            )}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">My Team</p>
            <p className="text-white/50 text-xs">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={fetchTeam}
            className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"
            title="Refresh"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.5 9A7 7 0 0117 6.5M18.5 15A7 7 0 017 17.5" />
            </svg>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"
            title="Back"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24">
          {/* Search */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4 shadow-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your colleagues"
                className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 text-sm outline-none"
              />
            </div>
          </div>

        {/* Chips */}
          <div className="mb-4">
            <p className="text-gray-600 text-sm font-semibold mb-2">My teammates</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All', count: chipCounts.all },
              { id: 'not-in', label: 'Not in yet', count: chipCounts.notIn },
              { id: 'late', label: 'Late arrivals', count: chipCounts.late },
              { id: 'on-time', label: 'On time', count: chipCounts.onTime },
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  filter === chip.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {chip.label} ({chip.count})
              </button>
            ))}
          </div>
          </div>

        {/* Me */}
        {showMeSection && (
          <div className="mb-4">
            <p className="text-gray-600 text-sm font-semibold mb-2">Me</p>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
              <div className={`w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br ${getAvatarColor(teamData.currentUser)} flex items-center justify-center flex-shrink-0`}>
                {teamData.currentUser?.profilePicUrl ? (
                  <img src={toAssetUrl(teamData.currentUser.profilePicUrl)} alt={teamData.currentUser?.name || 'Me'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-base font-bold">
                    {getInitials(teamData.currentUser)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-gray-900 font-semibold leading-tight truncate">
                    {teamData.currentUser?.name || teamData.currentUser?.email?.split('@')[0]}
                  </p>
                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-black text-white font-semibold">YOU</span>
                </div>
                <p className="text-gray-500 text-xs truncate">
                  {[teamData.currentUser?.designation, teamData.currentUser?.department].filter(Boolean).join(' • ') || teamData.currentUser?.employeeId}
                </p>
              </div>
              {(() => {
                const badge = getStatusBadge(teamData.currentUser)
                return (
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badge.className}`}> {badge.label} </span>
                )
              })()}
            </div>
          </div>
        )}

        {/* Manager */}
        {showManagerSection && (
          <div className="mb-4">
            <p className="text-gray-600 text-sm font-semibold mb-2">Manager</p>
            {teamData.manager ? (
              (matchesSearch(teamData.manager) && matchesAttendanceFilter(teamData.manager)) ? (
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
                  <div className={`w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br ${getAvatarColor(teamData.manager)} flex items-center justify-center flex-shrink-0`}>
                    {teamData.manager.profilePicUrl ? (
                      <img src={toAssetUrl(teamData.manager.profilePicUrl)} alt={teamData.manager.name || 'Manager'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-base font-bold">
                        {getInitials(teamData.manager)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-semibold leading-tight truncate">
                      {teamData.manager.name || teamData.manager.email?.split('@')[0]}
                    </p>
                    <p className="text-gray-500 text-xs truncate">
                      {[teamData.manager.designation, teamData.manager.department].filter(Boolean).join(' • ') || (teamData.manager.role ? String(teamData.manager.role).toUpperCase() : '')}
                    </p>
                  </div>
                  {(() => {
                    const badge = getStatusBadge(teamData.manager)
                    return (
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badge.className}`}> {badge.label} </span>
                    )
                  })()}
                </div>
              ) : null
            ) : (
              !isFiltering ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">Manager not assigned yet.</p>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Peers */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-gray-600 text-sm font-semibold">Peers ({peersTotal})</p>
              {isFiltering && (
                <p className="text-gray-400 text-xs">Showing {peersList.length}</p>
              )}
            </div>
          {peersList.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-gray-500 text-sm">
                {peersTotal === 0
                  ? 'No peers found'
                  : isFiltering
                    ? 'No peers match your filter/search'
                    : 'No peers found'}
              </p>
              {peersTotal > 0 && isFiltering && (
                <button
                  onClick={() => {
                    setFilter('all')
                    setSearchQuery('')
                  }}
                  className="mt-2 text-xs font-semibold text-black"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {peersList.map((member) => (
                <div key={member._id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
                  <div className={`w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br ${getAvatarColor(member)} flex items-center justify-center flex-shrink-0`}>
                    {member.profilePicUrl ? (
                      <img src={toAssetUrl(member.profilePicUrl)} alt={member.name || 'Profile'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-sm font-bold">
                        {getInitials(member)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-semibold truncate">{member.name || member.email?.split('@')[0]}</p>
                    <p className="text-gray-500 text-xs truncate">
                      {[member.designation, member.department].filter(Boolean).join(' • ') || member.employeeId}
                    </p>
                  </div>
                  {(() => {
                    const badge = getStatusBadge(member)
                    return (
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badge.className}`}> {badge.label} </span>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Direct reports (for managers) */}
        {directReportsTotal > 0 && (
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-gray-600 text-sm font-semibold">My Team Members ({directReportsTotal})</p>
              {isFiltering && (
                <p className="text-gray-400 text-xs">Showing {directReportsList.length}</p>
              )}
            </div>
            {directReportsList.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-gray-500 text-sm">
                  {isFiltering ? 'No team members match your filter/search' : 'No team members found'}
                </p>
                {isFiltering && (
                  <button
                    onClick={() => {
                      setFilter('all')
                      setSearchQuery('')
                    }}
                    className="mt-2 text-xs font-semibold text-black"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {directReportsList.map((member) => (
                  <div key={member._id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
                    <div className={`w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br ${getAvatarColor(member)} flex items-center justify-center flex-shrink-0`}>
                      {member.profilePicUrl ? (
                        <img src={toAssetUrl(member.profilePicUrl)} alt={member.name || 'Profile'} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-bold">
                          {getInitials(member)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-semibold truncate">{member.name || member.email?.split('@')[0]}</p>
                      <p className="text-gray-500 text-xs truncate">
                        {[member.designation, member.department].filter(Boolean).join(' • ') || member.employeeId}
                      </p>
                    </div>
                    {(() => {
                      const badge = getStatusBadge(member)
                      return (
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badge.className}`}> {badge.label} </span>
                      )
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black backdrop-blur-xl border-t border-white/10 px-2 py-3 z-50 rounded-t-2xl">
        <div className="w-full flex justify-around">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'home' || tab.id === 'inbox' || tab.id === 'wall' || tab.id === 'profile') {
                  navigate('/dashboard')
                } else if (tab.id === 'team') {
                  // Already on team page
                }
              }}
              whileTap={{ scale: 0.9 }}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${
                tab.id === 'team' ? 'bg-white/10' : ''
              }`}
            >
              <TabIcon id={tab.id} active={tab.id === 'team'} />
              <span className={`text-[10px] font-medium ${tab.id === 'team' ? 'text-white' : 'text-white/50'}`}>{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </nav>
      </div>
    </div>
  )
}

export default TeamDashboard