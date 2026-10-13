import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'

// Add custom styles for spiderfy animations
const spiderfyStyles = `
  .hrms-cluster-icon div {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  .hrms-profile-marker {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  .hrms-profile-marker-scattered {
    animation: scatterPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  }
  @keyframes scatterPop {
    0% { 
      transform: scale(0) rotate(0deg); 
      opacity: 0;
    }
    50% { 
      transform: scale(1.2) rotate(180deg); 
    }
    100% { 
      transform: scale(1) rotate(360deg); 
      opacity: 1;
    }
  }
  @keyframes markerPulse {
    0%, 100% { 
      transform: scale(1); 
      box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6), 0 0 0 4px rgba(139, 92, 246, 0.2);
    }
    50% { 
      transform: scale(1.05); 
      box-shadow: 0 8px 25px rgba(139, 92, 246, 0.8), 0 0 0 6px rgba(139, 92, 246, 0.3);
    }
  }
  .leaflet-tooltip {
    background: rgba(15, 23, 42, 0.95) !important;
    border: 1px solid rgba(139, 92, 246, 0.3) !important;
    border-radius: 8px !important;
    padding: 8px 12px !important;
    color: white !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
  }
  .leaflet-tooltip::before {
    border-top-color: rgba(15, 23, 42, 0.95) !important;
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'spiderfy-custom-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = spiderfyStyles
    document.head.appendChild(style)
  }
}

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points?.length) return
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true })
      return
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])))
    map.fitBounds(bounds, { padding: [40, 40], animate: true })
  }, [map, points])
  return null
}

// Compact Date Bar Calendar Component (Bottom Bar)
function UserCalendarPanel({ userId, userName, userProfilePicUrl, onClose }) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date()) // Default to today

  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
  const toAssetUrl = (maybeRelativeUrl) => {
    if (!maybeRelativeUrl) return ''
    if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl
    const normalized = String(maybeRelativeUrl).startsWith('/') ? String(maybeRelativeUrl) : `/${maybeRelativeUrl}`
    return `${API_ORIGIN}${normalized}`
  }

  useEffect(() => {
    if (!userId) return
    fetchUserAttendance()
  }, [userId])

  const fetchUserAttendance = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/admin/user-attendance/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setAttendance(response.data.attendance || [])
    } catch (err) {
      console.error('Error fetching user attendance:', err)
    } finally {
      setLoading(false)
    }
  }

  // Build days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    
    // Create attendance map
    const attendanceMap = {}
    attendance.forEach((record) => {
      const dateKey = new Date(record.date).toDateString()
      attendanceMap[dateKey] = record
    })

    const days = []
    const today = new Date()
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d)
      const dateKey = date.toDateString()
      const record = attendanceMap[dateKey]
      const isToday = date.toDateString() === today.toDateString()
      const isFuture = date > today
      
      days.push({
        date,
        day: d,
        isToday,
        isFuture,
        record,
        status: record?.status || (isFuture ? 'future' : 'absent'),
      })
    }
    
    return days
  }, [currentMonth, attendance])

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    if (next <= new Date()) {
      setCurrentMonth(next)
    }
  }

  const handleDateClick = (day) => {
    if (day.isFuture) return
    setSelectedDate(day.date)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500'
      case 'illegal': return 'bg-rose-500'
      case 'pending': return 'bg-amber-500'
      case 'future': return 'bg-white/5'
      default: return 'bg-white/20'
    }
  }

  const selectedRecord = selectedDate 
    ? calendarDays.find(d => d.date?.toDateString() === selectedDate.toDateString())?.record 
    : null

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-slate-900/95 backdrop-blur-xl border-t border-white/20"
    >
      {/* Header Row - User Name + Close */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-violet-500 flex items-center justify-center text-white text-xs font-bold">
            {userProfilePicUrl ? (
              <img src={toAssetUrl(userProfilePicUrl)} alt={userName || 'User'} className="w-full h-full object-cover" />
            ) : (
              userName?.charAt(0).toUpperCase()
            )}
          </div>
          <span className="text-white text-sm font-medium">{userName}</span>
          {selectedDate && (
            <span className="text-white/40 text-xs ml-2">
              • {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
        
        {/* Details summary for selected date */}
        {selectedRecord && (
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-bold ${
              selectedRecord.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
              selectedRecord.status === 'illegal' ? 'bg-rose-500/20 text-rose-300' :
              'bg-amber-500/20 text-amber-300'
            }`}>
              {selectedRecord.status?.toUpperCase()}
            </span>
            {selectedRecord.punchIn?.time && (
              <span className="text-red-400">
                IN: {new Date(selectedRecord.punchIn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {selectedRecord.punchOut?.time && (
              <span className="text-green-400">
                OUT: {new Date(selectedRecord.punchOut.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {typeof selectedRecord.punchOut?.distanceFromPunchInM === 'number' && (
              <span className={selectedRecord.punchOut.distanceFromPunchInM <= 500 ? 'text-green-400' : 'text-rose-400'}>
                {Math.round(selectedRecord.punchOut.distanceFromPunchInM)}m
              </span>
            )}
          </div>
        )}
        
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Calendar Strip */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <svg className="animate-spin h-5 w-5 text-white/50" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-2 py-2">
          {/* Month Navigation */}
          <button onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded transition-colors flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="text-white text-xs font-semibold w-14 text-center flex-shrink-0">
            {months[currentMonth.getMonth()]} {currentMonth.getFullYear().toString().slice(2)}
          </div>
          
          <button 
            onClick={nextMonth} 
            disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
            className="p-1.5 hover:bg-white/10 rounded transition-colors flex-shrink-0 disabled:opacity-30"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Scrollable dates */}
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1">
              {calendarDays.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDateClick(day)}
                  disabled={day.isFuture}
                  className={`flex-shrink-0 w-9 h-9 rounded-lg flex flex-col items-center justify-center text-xs transition-all ${
                    day.isFuture 
                      ? 'opacity-30 cursor-not-allowed bg-white/5 text-white/30' 
                      : selectedDate?.toDateString() === day.date?.toDateString()
                      ? 'ring-2 ring-violet-400 ' + getStatusColor(day.status) + ' text-white'
                      : getStatusColor(day.status) + ' text-white hover:ring-1 hover:ring-white/30'
                  } ${day.isToday ? 'ring-1 ring-yellow-400' : ''}`}
                >
                  <span className="font-bold">{day.day}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Legend (compact) */}
          <div className="hidden md:flex items-center gap-2 text-[9px] text-white/50 flex-shrink-0 ml-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500"></span>OK</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500"></span>!</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500"></span>?</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function AdminMapView({ onLogout }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCalendar, setShowCalendar] = useState(false)
  const [mapDate, setMapDate] = useState(new Date())
  const [attendanceFilter, setAttendanceFilter] = useState('working') // all | punchIn | punchOut | working | ot | absent
  const mapRef = useRef(null)
  const [hoveredClusterKey, setHoveredClusterKey] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now())
  const navigate = useNavigate()

  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
  const toAssetUrl = (maybeRelativeUrl) => {
    if (!maybeRelativeUrl) return ''
    if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl
    return `${API_ORIGIN}${maybeRelativeUrl}`
  }

  const toDateParam = (dateObj) => {
    const yyyy = dateObj.getFullYear()
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
    const dd = String(dateObj.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/admin/today-attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { date: toDateParam(mapDate) },
      })
      setUsers(response.data)
    } catch (err) {
      console.error('Error fetching users', err)
    } finally {
      setLoading(false)
    }
  }, [mapDate])

  useEffect(() => {
    fetchUsers()
    const interval = setInterval(fetchUsers, 30000)
    return () => clearInterval(interval)
  }, [fetchUsers])

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    onLogout?.()
    navigate('/admin-login')
  }

  const handleUserSelect = (user) => {
    setSelectedUser(user)
    setShowCalendar(true)
  }

  const openFullMap = () => {
    if (!selectedUser) return
    const loc = selectedUser.out?.location || selectedUser.in?.location
    if (loc?.lat && loc?.lng) {
      window.open(`https://www.google.com/maps?q=${loc.lat},${loc.lng}`, '_blank')
    }
  }

  // Build user list with unified structure
  const listUsers = useMemo(() => {
    return users.map((u) => {
      const inLoc = u.punchIn?.location
      const outLoc = u.punchOut?.location
      const hasInLoc = !!(inLoc?.lat && inLoc?.lng)
      const hasOutLoc = !!(outLoc?.lat && outLoc?.lng)
      const hasInTime = !!u.punchIn?.time
      const hasOutTime = !!u.punchOut?.time
      
      return {
        odId: u._id,
        odName: u.name,
        userId: u._id,
        name: u.name,
        email: u.email,
        profilePicUrl: u.profilePicUrl,
        lastLocation: u.lastLocation || null,
        in: hasInTime ? { location: hasInLoc ? inLoc : null, time: u.punchIn?.time } : null,
        out: hasOutTime ? { location: hasOutLoc ? outLoc : null, time: u.punchOut?.time, distanceFromPunchInM: u.punchOut?.distanceFromPunchInM, radiusM: u.punchOut?.radiusM, overtimeMinutes: u.punchOut?.overtimeMinutes } : null,
        status: u.status || 'absent',
        latestTime: hasOutTime ? u.punchOut?.time : hasInTime ? u.punchIn?.time : null,
      }
    })
  }, [users])

  const toNumber = (val) => {
    if (typeof val === 'string') return parseFloat(val)
    return val
  }

  const getDisplayLoc = (u) => {
    const loc = u.in?.location || u.lastLocation
    if (!loc) return null
    const lat = toNumber(loc.lat)
    const lng = toNumber(loc.lng)
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return null
    return { ...loc, lat, lng }
  }

  const mapDateLabel = useMemo(() => {
    return mapDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }, [mapDate])

  const dateStripDays = useMemo(() => {
    const days = []
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    for (let i = 0; i < 14; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() - i)
      days.push({
        date: d,
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        isToday: i === 0,
      })
    }
    return days
  }, [])

  // Filter users by search and status
  const filteredUsers = useMemo(() => {
    return listUsers.filter((u) => {
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      return matchStatus
    })
  }, [listUsers, statusFilter])

  const passesAttendanceFilter = useCallback((u) => {
    const isWorking = !!u.in?.time && !u.out?.time
    if (attendanceFilter === 'all') return isWorking
    switch (attendanceFilter) {
      case 'punchIn':
        return !!u.in?.time
      case 'punchOut':
        return !!u.out?.time
      case 'working':
        return isWorking
      case 'ot':
        return typeof u.out?.overtimeMinutes === 'number' && u.out.overtimeMinutes > 0
      case 'absent':
        return u.status === 'absent'
      default:
        return isWorking
    }
  }, [attendanceFilter])

  const attendanceFilteredUsers = useMemo(() => {
    return filteredUsers.filter(passesAttendanceFilter)
  }, [filteredUsers, passesAttendanceFilter])

  // Get users with punch-in/location data for map
  const usersWithLocation = useMemo(() => {
    return attendanceFilteredUsers.filter((u) => {
      const loc = getDisplayLoc(u)
      return !!loc?.lat && !!loc?.lng
    })
  }, [attendanceFilteredUsers])

  const groupedUsers = useMemo(() => {
    const map = new Map()
    for (const u of usersWithLocation) {
      const loc = getDisplayLoc(u)
      if (!loc) continue
      const key = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`
      if (!map.has(key)) map.set(key, { key, loc, users: [] })
      map.get(key).users.push(u)
    }
    return Array.from(map.values())
  }, [usersWithLocation])

  const spiderfyOffsets = (count, centerLat) => {
    const radiusMeters = Math.min(80, 30 + count * 6)
    const toLat = (m) => m / 111320
    const toLng = (m) => m / (111320 * Math.cos((centerLat * Math.PI) / 180))
    const offsets = []
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count
      const dx = radiusMeters * Math.cos(angle)
      const dy = radiusMeters * Math.sin(angle)
      offsets.push({ dLat: toLat(dy), dLng: toLng(dx) })
    }
    return offsets
  }

  const pointsForBounds = useMemo(() => {
    return usersWithLocation.map((u) => {
      const loc = getDisplayLoc(u)
      return [loc.lat, loc.lng]
    })
  }, [usersWithLocation])

  const makeProfileIcon = useCallback((user) => {
    const size = 36
    const initials = (user?.name || '?').trim().charAt(0).toUpperCase()
    const avatarUrl = user?.profilePicUrl ? toAssetUrl(user.profilePicUrl) : null
    const isWorking = !!user?.in?.time && !user?.out?.time
    const workedLabel = (() => {
      if (!isWorking) return ''
      const start = new Date(user.in.time)
      if (Number.isNaN(start.getTime())) return ''
      const baseDay = mapDate instanceof Date ? mapDate : new Date()
      const isSameDay = (a, b) => a.toDateString() === b.toDateString()
      const endOfDay = new Date(baseDay)
      endOfDay.setHours(23, 59, 59, 999)
      const end = isSameDay(baseDay, new Date()) ? new Date(nowTick) : endOfDay
      const diffMs = Math.max(0, end - start)
      const totalMinutes = Math.floor(diffMs / (1000 * 60))
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      const seconds = Math.floor((diffMs / 1000) % 60)
      const hh = String(hours).padStart(2, '0')
      const mm = String(minutes).padStart(2, '0')
      const ss = String(seconds).padStart(2, '0')
      return `${hh}:${mm}:${ss}`
    })()
    const html = avatarUrl
      ? `<div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;overflow:visible;"><div style=\"width:${size}px;height:${size}px;border-radius:9999px;overflow:hidden;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.35)\"><img src=\"${avatarUrl}\" style=\"width:100%;height:100%;object-fit:cover\" /></div>${isWorking ? `<span style=\"position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;font-size:9px;font-weight:800;padding:2px 6px;border-radius:9999px;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap\">${workedLabel}</span>` : ''}</div>`
      : `<div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;overflow:visible;"><div style=\"width:${size}px;height:${size}px;border-radius:9999px;background:#8b5cf6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.35)\">${initials}</div>${isWorking ? `<span style=\"position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;font-size:9px;font-weight:800;padding:2px 6px;border-radius:9999px;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap\">${workedLabel}</span>` : ''}</div>`
    return L.divIcon({
      className: 'hrms-profile-marker',
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    })
  }, [toAssetUrl, nowTick, mapDate])

  const makeScatteredProfileIcon = useCallback((user) => {
    const size = 40
    const initials = (user?.name || '?').trim().charAt(0).toUpperCase()
    const avatarUrl = user?.profilePicUrl ? toAssetUrl(user.profilePicUrl) : null
    const isWorking = !!user?.in?.time && !user?.out?.time
    const workedLabel = (() => {
      if (!isWorking) return ''
      const start = new Date(user.in.time)
      if (Number.isNaN(start.getTime())) return ''
      const baseDay = mapDate instanceof Date ? mapDate : new Date()
      const isSameDay = (a, b) => a.toDateString() === b.toDateString()
      const endOfDay = new Date(baseDay)
      endOfDay.setHours(23, 59, 59, 999)
      const end = isSameDay(baseDay, new Date()) ? new Date(nowTick) : endOfDay
      const diffMs = Math.max(0, end - start)
      const totalMinutes = Math.floor(diffMs / (1000 * 60))
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      const seconds = Math.floor((diffMs / 1000) % 60)
      const hh = String(hours).padStart(2, '0')
      const mm = String(minutes).padStart(2, '0')
      const ss = String(seconds).padStart(2, '0')
      return `${hh}:${mm}:${ss}`
    })()
    const html = avatarUrl
      ? `<div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;overflow:visible;"><div style=\"width:${size}px;height:${size}px;border-radius:9999px;overflow:hidden;border:3px solid #8b5cf6;box-shadow:0 6px 20px rgba(139,92,246,0.6), 0 0 0 4px rgba(139,92,246,0.2);animation:markerPulse 2s ease-in-out infinite\"><img src=\"${avatarUrl}\" style=\"width:100%;height:100%;object-fit:cover\" /></div>${isWorking ? `<span style=\"position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;font-size:9px;font-weight:800;padding:2px 6px;border-radius:9999px;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap\">${workedLabel}</span>` : ''}</div>`
      : `<div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;overflow:visible;"><div style=\"width:${size}px;height:${size}px;border-radius:9999px;background:#8b5cf6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;border:3px solid #a78bfa;box-shadow:0 6px 20px rgba(139,92,246,0.6), 0 0 0 4px rgba(139,92,246,0.2);animation:markerPulse 2s ease-in-out infinite\">${initials}</div>${isWorking ? `<span style=\"position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;font-size:9px;font-weight:800;padding:2px 6px;border-radius:9999px;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap\">${workedLabel}</span>` : ''}</div>`
    return L.divIcon({
      className: 'hrms-profile-marker-scattered',
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    })
  }, [toAssetUrl, nowTick, mapDate])

  const formatTime = (timeStr) => {
    if (!timeStr) return '--'
    const t = new Date(timeStr)
    if (Number.isNaN(t.getTime())) return '--'
    return t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatWorked = (startTime, endTime, dayContext) => {
    if (!startTime) return '--'
    const start = new Date(startTime)
    if (Number.isNaN(start.getTime())) return '--'

    const baseDay = dayContext instanceof Date ? dayContext : new Date()
    const isSameDay = (a, b) => a.toDateString() === b.toDateString()
    const endOfDay = new Date(baseDay)
    endOfDay.setHours(23, 59, 59, 999)

    let end
    if (endTime) {
      end = new Date(endTime)
    } else if (isSameDay(baseDay, new Date())) {
      end = new Date(nowTick)
    } else {
      end = endOfDay
    }

    if (Number.isNaN(end.getTime())) return '--'
    const diffMs = Math.max(0, end - start)
    const totalMinutes = Math.floor(diffMs / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const listTitle = useMemo(() => {
    switch (attendanceFilter) {
      case 'punchIn': return 'Punch In List'
      case 'punchOut': return 'Punch Out List'
      case 'working': return 'Working Now'
      case 'ot': return 'OT List'
      case 'absent': return 'Absent List'
      default: return 'All Employees'
    }
  }, [attendanceFilter])

  const listItems = useMemo(() => {
    const items = attendanceFilteredUsers.map((u) => {
      const inTime = u.in?.time || null
      const outTime = u.out?.time || null
      const overtimeMinutes = u.out?.overtimeMinutes || 0
      const displayLoc = u.in?.location || u.lastLocation || null
      return {
        id: u.userId,
        name: u.name,
        email: u.email,
        profilePicUrl: u.profilePicUrl,
        status: u.status,
        inTime,
        outTime,
        worked: formatWorked(inTime, outTime, mapDate),
        overtimeMinutes,
        displayLoc,
      }
    })

    const getSortKey = (item) => {
      if (attendanceFilter === 'punchOut') return item.outTime ? new Date(item.outTime).getTime() : 0
      if (attendanceFilter === 'ot') return item.overtimeMinutes || 0
      return item.inTime ? new Date(item.inTime).getTime() : 0
    }

    return items.sort((a, b) => getSortKey(b) - getSortKey(a))
  }, [attendanceFilteredUsers, attendanceFilter, formatWorked, mapDate])

  // Stats counts
  const stats = useMemo(() => {
    const counts = { approved: 0, illegal: 0, pending: 0, absent: 0, total: listUsers.length }
    listUsers.forEach((u) => {
      if (counts[u.status] !== undefined) counts[u.status]++
    })
    return counts
  }, [listUsers])

  const attendanceCounts = useMemo(() => {
    const counts = { all: listUsers.length, punchIn: 0, punchOut: 0, working: 0, ot: 0, absent: 0 }
    listUsers.forEach((u) => {
      const hasIn = !!u.in?.time
      const hasOut = !!u.out?.time
      if (hasIn) counts.punchIn++
      if (hasOut) counts.punchOut++
      if (hasIn && !hasOut) counts.working++
      if (u.status === 'absent') counts.absent++
      if (typeof u.out?.overtimeMinutes === 'number' && u.out.overtimeMinutes > 0) counts.ot++
    })
    return counts
  }, [listUsers])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <p className="text-white/60">Loading Map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-xl px-4 md:px-6 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-white">Punch‑In Map</h1>
            <p className="text-white/50 text-xs">{stats.total} employees • {mapDateLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Refresh
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-3 py-2 bg-white/10 text-white rounded-lg hover:bg-white/15 transition-colors text-sm font-medium"
          >
            Back
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Date + View Mode Bar */}
      <div className="px-4 md:px-6 py-2 bg-black/10 border-b border-white/5 flex items-center gap-4 overflow-x-auto">
        <div className="flex items-center gap-2 text-xs text-white/60 flex-shrink-0">
          <span className="font-semibold">Date</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {dateStripDays.map((d) => {
            const isSelected = d.date.toDateString() === mapDate.toDateString()
            return (
              <button
                key={d.date.toISOString()}
                onClick={() => {
                  setMapDate(d.date)
                  setShowCalendar(false)
                  setSelectedUser(null)
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-violet-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/15'
                } ${d.isToday ? 'ring-1 ring-yellow-400' : ''}`}
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Attendance + Status Filter Bar */}
      <div className="px-4 md:px-6 py-2 bg-black/10 border-b border-white/5 flex items-center gap-2 overflow-x-auto">
        {[
          { key: 'all', label: 'All' },
          { key: 'punchIn', label: 'Punch In' },
          { key: 'punchOut', label: 'Punch Out' },
          { key: 'working', label: 'Working' },
          { key: 'ot', label: 'OT' },
          { key: 'absent', label: 'Absent' },
        ].map((btn) => (
          <button
            key={btn.key}
            onClick={() => setAttendanceFilter(btn.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              attendanceFilter === btn.key
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/70 hover:bg-white/15'
            }`}
          >
            <span>{btn.label}</span>
            <span className="px-1.5 py-0.5 bg-black/20 rounded">
              {attendanceCounts[btn.key] ?? 0}
            </span>
          </button>
        ))}

      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Punch-In Map */}
        <div className="flex-1 relative">
          {pointsForBounds.length > 0 ? (
            <MapContainer
              center={pointsForBounds[0]}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
              className="z-0"
              whenCreated={(map) => {
                mapRef.current = map
                // Close spiderfy when clicking on map background
                map.on('click', (e) => {
                  if (e.originalEvent.target.classList.contains('leaflet-container') || 
                      e.originalEvent.target.tagName === 'IMG') {
                    setHoveredClusterKey(null)
                  }
                })
              }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={pointsForBounds} />

              {groupedUsers.map((group) => {
                const { key, loc, users: groupUsers } = group
                const hasMultiple = groupUsers.length > 1
                const isHovered = hoveredClusterKey === key

                const clusterIcon = L.divIcon({
                  className: 'hrms-cluster-icon',
                  html: `<div style="width:48px;height:48px;border-radius:9999px;background:${isHovered ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#8b5cf6,#6366f1)'};color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:0 ${isHovered ? '10px 30px rgba(34,197,94,0.6)' : '6px 20px rgba(139,92,246,0.5)'};font-size:16px;transition:all 0.3s ease;cursor:pointer;${isHovered ? 'transform:scale(1.15);' : ''}">${groupUsers.length}</div>`,
                  iconSize: [48, 48],
                  iconAnchor: [24, 24],
                })

                const offsets = hasMultiple ? spiderfyOffsets(groupUsers.length, loc.lat) : []

                return (
                  <div key={key}>
                    {/* Cluster marker */}
                    {hasMultiple && (
                      <Marker
                        position={[loc.lat, loc.lng]}
                        icon={clusterIcon}
                        eventHandlers={{
                          click: () => {
                            if (hoveredClusterKey === key) {
                              setHoveredClusterKey(null)
                            } else {
                              setHoveredClusterKey(key)
                            }
                          },
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
                          <span style={{ fontWeight: 600, fontSize: '11px' }}>
                            {isHovered ? '🔽 Click to close' : `${groupUsers.length} users • Click to expand`}
                          </span>
                        </Tooltip>
                      </Marker>
                    )}

                    {/* Single marker */}
                    {!hasMultiple && groupUsers.map((u) => {
                      const displayLoc = getDisplayLoc(u)
                      const usingFallback = !u.in?.location && !!u.lastLocation
                      if (!displayLoc) return null
                      return (
                        <Marker
                          key={u.userId}
                          position={[displayLoc.lat, displayLoc.lng]}
                          icon={makeProfileIcon(u)}
                          eventHandlers={{ click: () => handleUserSelect(u) }}
                        >
                          <Popup>
                            <div className="text-sm min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-violet-500 flex items-center justify-center text-white text-xs font-bold">
                                  {u.profilePicUrl ? (
                                    <img src={toAssetUrl(u.profilePicUrl)} alt={u.name || 'User'} className="w-full h-full object-cover" />
                                  ) : (
                                    u.name?.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-800">{u.name}</p>
                                  <p className="text-gray-500 text-xs">{u.email}</p>
                                </div>
                              </div>
                              <hr className="my-2" />
                              <p className="text-red-600 font-medium">{usingFallback ? 'Last Known Location' : 'Punch‑In'}</p>
                              {u.in?.time && (
                                <p className="text-gray-600 text-xs">{new Date(u.in.time).toLocaleString('en-IN')}</p>
                              )}
                              {displayLoc?.address && (
                                <p className="text-gray-500 text-xs mt-1">{displayLoc.address}</p>
                              )}
                              <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                u.status === 'approved' ? 'bg-green-100 text-green-700' :
                                u.status === 'illegal' ? 'bg-red-100 text-red-700' :
                                u.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {u.status.toUpperCase()}
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      )
                    })}

                    {/* Spiderfy markers on hover */}
                    {hasMultiple && isHovered && groupUsers.map((u, idx) => {
                      const displayLoc = getDisplayLoc(u)
                      if (!displayLoc) return null
                      const offset = offsets[idx]
                      const target = [loc.lat + offset.dLat, loc.lng + offset.dLng]
                      const usingFallback = !u.in?.location && !!u.lastLocation
                      return (
                        <div key={u.userId}>
                          <Polyline
                            positions={[[loc.lat, loc.lng], target]}
                            pathOptions={{ 
                              color: '#8b5cf6', 
                              weight: 2.5, 
                              opacity: 0.85,
                              dashArray: '8, 4',
                            }}
                          />
                          <Marker
                            position={target}
                            icon={makeScatteredProfileIcon(u)}
                            eventHandlers={{ click: () => handleUserSelect(u) }}
                          >
                            <Popup>
                              <div className="text-sm min-w-[200px]">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-violet-500 flex items-center justify-center text-white text-xs font-bold">
                                    {u.profilePicUrl ? (
                                      <img src={toAssetUrl(u.profilePicUrl)} alt={u.name || 'User'} className="w-full h-full object-cover" />
                                    ) : (
                                      u.name?.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-800">{u.name}</p>
                                    <p className="text-gray-500 text-xs">{u.email}</p>
                                  </div>
                                </div>
                                <hr className="my-2" />
                                <p className="text-red-600 font-medium">{usingFallback ? 'Last Known Location' : 'Punch‑In'}</p>
                                {u.in?.time && (
                                  <p className="text-gray-600 text-xs">{new Date(u.in.time).toLocaleString('en-IN')}</p>
                                )}
                                {displayLoc?.address && (
                                  <p className="text-gray-500 text-xs mt-1">{displayLoc.address}</p>
                                )}
                                <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.status === 'approved' ? 'bg-green-100 text-green-700' :
                                  u.status === 'illegal' ? 'bg-red-100 text-red-700' :
                                  u.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {u.status.toUpperCase()}
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-800">
              <div className="text-center text-white/50">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-lg font-medium">No punch‑ins available</p>
                <p className="text-sm mt-1">Employees will appear after punching in</p>
              </div>
            </div>
          )}

          {/* Right Compact List Panel */}
          <div className="absolute top-24 right-2 md:right-4 z-30 w-48 md:w-56 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
            <div className="px-2 py-1.5 border-b border-white/10 text-[10px] text-white/70 font-semibold">
              {listTitle}
            </div>
            <div className="max-h-60 overflow-y-auto">
              {listItems.length === 0 ? (
                <div className="px-2 py-2 text-[10px] text-white/40">No users</div>
              ) : (
                listItems.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setShowCalendar(false)
                      setSelectedUser(null)
                      const map = mapRef.current
                      const lat = typeof u.displayLoc?.lat === 'string' ? parseFloat(u.displayLoc.lat) : u.displayLoc?.lat
                      const lng = typeof u.displayLoc?.lng === 'string' ? parseFloat(u.displayLoc.lng) : u.displayLoc?.lng
                      if (map && typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
                        map.flyTo([lat, lng], 16, { animate: true })
                      }
                    }}
                    className="w-full px-2 py-1.5 flex items-center gap-2 text-left hover:bg-white/5"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-violet-500 flex items-center justify-center text-white text-[9px] font-bold">
                      {u.profilePicUrl ? (
                        <img src={toAssetUrl(u.profilePicUrl)} alt={u.name || 'User'} className="w-full h-full object-cover" />
                      ) : (
                        u.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-white font-semibold truncate">{u.name}</p>
                      <p className="text-[9px] text-white/50 truncate">{attendanceFilter === 'punchOut' ? `Out ${formatTime(u.outTime)}` : attendanceFilter === 'punchIn' ? `In ${formatTime(u.inTime)}` : attendanceFilter === 'working' ? `Work ${formatWorked(u.inTime, null, mapDate)}` : attendanceFilter === 'ot' ? `OT ${Math.round((u.overtimeMinutes || 0) / 60 * 10) / 10}h` : attendanceFilter === 'absent' ? 'Absent' : u.status}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* User Calendar Panel (compact bar at bottom) */}
      <AnimatePresence>
        {showCalendar && selectedUser && (
          <UserCalendarPanel 
            userId={selectedUser.userId} 
            userName={selectedUser.name}
            userProfilePicUrl={selectedUser.profilePicUrl}
            onClose={() => {
              setShowCalendar(false)
              setSelectedUser(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default AdminMapView
