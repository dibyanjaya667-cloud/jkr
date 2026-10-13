import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { API_URL } from '../lib/api'

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

function AdminEmployeeMap({ onLogout }) {
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${mm}`
  })
  const [expandedCluster, setExpandedCluster] = useState(null)
  const collapseTimer = useRef(null)

  const navigate = useNavigate()
  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')

  const toAssetUrl = (maybeRelativeUrl) => {
    if (!maybeRelativeUrl) return ''
    if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl
    const normalized = String(maybeRelativeUrl).startsWith('/') ? String(maybeRelativeUrl) : `/${maybeRelativeUrl}`
    return `${API_ORIGIN}${normalized}`
  }

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUsers(res.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      if (error.response?.status === 401) navigate('/meadmin')
    } finally {
      setLoadingUsers(false)
    }
  }, [navigate])

  const fetchAttendance = useCallback(async (userId) => {
    if (!userId) return
    setLoadingAttendance(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/admin/user-attendance/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setAttendance(res.data.attendance || [])
    } catch (error) {
      console.error('Error fetching user attendance:', error)
    } finally {
      setLoadingAttendance(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    if (!selectedUser?._id) return
    fetchAttendance(selectedUser._id)
  }, [selectedUser, fetchAttendance])

  const departments = useMemo(() => {
    const all = users.map((u) => u.department).filter(Boolean)
    return ['all', ...Array.from(new Set(all))]
  }, [users])

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users
      .filter((u) => (departmentFilter === 'all' ? true : u.department === departmentFilter))
      .filter((u) => {
        if (!q) return true
        return (
          u.name?.toLowerCase().includes(q)
          || u.email?.toLowerCase().includes(q)
          || u.employeeId?.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [users, departmentFilter, query])

  const monthRecords = useMemo(() => {
    if (!month) return []
    const [y, m] = month.split('-').map((v) => parseInt(v, 10))
    if (!y || !m) return []
    return attendance
      .filter((record) => {
        const d = new Date(record.date)
        return d.getFullYear() === y && d.getMonth() + 1 === m
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [attendance, month])

  const toNumber = (value) => {
    if (typeof value === 'number') return Number.isNaN(value) ? null : value
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = parseFloat(value)
      return Number.isNaN(parsed) ? null : parsed
    }
    return null
  }

  const mapData = useMemo(() => {
    const points = []
    const segments = []
    const markers = []

    monthRecords.forEach((record) => {
      const dateLabel = new Date(record.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

      const inLoc = record.punchIn?.location
      const outLoc = record.punchOut?.location

      const inLat = toNumber(inLoc?.lat)
      const inLng = toNumber(inLoc?.lng)
      const outLat = toNumber(outLoc?.lat)
      const outLng = toNumber(outLoc?.lng)

      if (inLat != null && inLng != null) {
        points.push([inLat, inLng])
        markers.push({
          key: `${record.date}-in`,
          type: 'in',
          lat: inLat,
          lng: inLng,
          time: record.punchIn?.time,
          address: inLoc?.address,
          dateLabel,
        })
      }

      if (outLat != null && outLng != null) {
        points.push([outLat, outLng])
        markers.push({
          key: `${record.date}-out`,
          type: 'out',
          lat: outLat,
          lng: outLng,
          time: record.punchOut?.time,
          address: outLoc?.address,
          dateLabel,
        })
      }

      if (inLat != null && inLng != null && outLat != null && outLng != null) {
        segments.push({
          key: `${record.date}-path`,
          from: [inLat, inLng],
          to: [outLat, outLng],
        })
      }
    })

    return { points, segments, markers }
  }, [monthRecords])

  const makePunchIcon = useCallback((user, type) => {
    const size = 34
    const initials = (user?.name || '?').trim().charAt(0).toUpperCase()
    const avatarUrl = user?.profilePicUrl ? toAssetUrl(user.profilePicUrl) : null
    const color = type === 'in' ? '#22c55e' : '#ef4444'
    const shadow = type === 'in' ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'
    const html = avatarUrl
      ? `<div style="width:${size}px;height:${size}px;border-radius:9999px;overflow:hidden;border:3px solid ${color};box-shadow:0 6px 14px ${shadow};background:#fff;"><img src=\"${avatarUrl}\" style=\"width:100%;height:100%;object-fit:cover\" /></div>`
      : `<div style="width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${color};box-shadow:0 6px 14px ${shadow};background:#111827;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;">${initials}</div>`

    return L.divIcon({
      className: 'hrms-punch-marker',
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    })
  }, [toAssetUrl])

  /* ── Cluster nearby markers & spiderfy on hover ── */
  const clusterData = useMemo(() => {
    const threshold = 0.0005
    const markers = mapData.markers
    const used = new Set()
    const clusters = []
    markers.forEach((m, i) => {
      if (used.has(i)) return
      const group = [m]
      used.add(i)
      markers.forEach((m2, j) => {
        if (used.has(j)) return
        if (Math.abs(m.lat - m2.lat) < threshold && Math.abs(m.lng - m2.lng) < threshold) {
          group.push(m2)
          used.add(j)
        }
      })
      const avgLat = group.reduce((s, g) => s + g.lat, 0) / group.length
      const avgLng = group.reduce((s, g) => s + g.lng, 0) / group.length
      clusters.push({ id: `cluster-${i}`, center: [avgLat, avgLng], markers: group })
    })
    return clusters
  }, [mapData.markers])

  const getSpiderPositions = useCallback((center, count) => {
    const r = 0.0005 + count * 0.00005
    return Array.from({ length: count }, (_, i) => {
      const a = (2 * Math.PI * i) / count - Math.PI / 2
      return [center[0] + r * Math.sin(a), center[1] + r * Math.cos(a)]
    })
  }, [])

  const makeClusterIcon = useCallback((count) => {
    const s = 38
    return L.divIcon({
      className: '',
      html: `<div style="width:${s}px;height:${s}px;border-radius:9999px;background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid rgba(255,255,255,0.3);box-shadow:0 4px 14px rgba(99,102,241,0.5);cursor:pointer;">${count}</div>`,
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
    })
  }, [])

  const expandCluster = useCallback((id) => {
    clearTimeout(collapseTimer.current)
    setExpandedCluster(id)
  }, [])

  const startCollapseTimer = useCallback(() => {
    collapseTimer.current = setTimeout(() => setExpandedCluster(null), 600)
  }, [])

  const cancelCollapse = useCallback(() => {
    clearTimeout(collapseTimer.current)
  }, [])

  useEffect(() => { setExpandedCluster(null) }, [selectedUser, month])

  const formatTime = (time) => {
    if (!time) return '--'
    const t = new Date(time)
    if (Number.isNaN(t.getTime())) return '--'
    return t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="flex items-center justify-between px-4 md:px-8 pt-4 pb-3">
        <div>
          <h1 className="text-white text-lg font-semibold">See by Employee</h1>
          <p className="text-white/50 text-xs">Monthly punch-in/out map</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/admin')}
            className="text-[11px] text-white/70 hover:text-white bg-white/10 px-2.5 py-1 rounded-lg"
          >
            Admin Panel
          </button>
          <button
            onClick={() => navigate('/admin-map')}
            className="text-[11px] text-white/70 hover:text-white bg-blue-500/30 hover:bg-blue-500/50 px-2.5 py-1 rounded-lg"
          >
            Live Map
          </button>
          <button
            onClick={onLogout}
            className="text-[11px] text-white/70 hover:text-white bg-white/10 px-2.5 py-1 rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-3 px-4 md:px-8 pb-6">
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-3 md:p-4">
          <div className="flex items-center gap-2 mb-3">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-slate-900 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept === 'all' ? 'All Departments' : dept}</option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee"
              className="flex-1 bg-slate-900 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5"
            />
          </div>

          <div className="text-[11px] text-white/50 mb-2">Employees</div>
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {loadingUsers ? (
              <div className="text-xs text-white/40">Loading...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-xs text-white/40">No users found</div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user._id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg border ${selectedUser?._id === user._id ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-violet-500 flex items-center justify-center text-white text-xs font-bold">
                    {user.profilePicUrl ? (
                      <img src={toAssetUrl(user.profilePicUrl)} alt={user.name || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-white/50 truncate">{user.department || '—'} • {user.employeeId || '—'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-white/10 rounded-2xl overflow-hidden relative">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-white">{selectedUser?.name || 'Select an employee'}</div>
              {selectedUser?.department && (
                <span className="text-[10px] text-white/50">• {selectedUser.department}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-slate-900 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5"
              />
              <button
                onClick={() => selectedUser?._id && fetchAttendance(selectedUser._id)}
                className="text-[11px] text-white/70 hover:text-white bg-white/10 px-2.5 py-1 rounded-lg"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="h-[70vh] md:h-[75vh]">
            {selectedUser ? (
              <MapContainer
                center={[20.5937, 78.9629]}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {mapData.segments.map((seg) => (
                  <Polyline
                    key={seg.key}
                    positions={[seg.from, seg.to]}
                    pathOptions={{ color: '#38bdf8', weight: 2, opacity: 0.7 }}
                  />
                ))}

                {clusterData.map((cluster) => {
                  if (cluster.markers.length === 1) {
                    const m = cluster.markers[0]
                    return (
                      <Marker key={m.key} position={[m.lat, m.lng]} icon={makePunchIcon(selectedUser, m.type)}>
                        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                          <div className="text-xs">
                            <div className="font-semibold">{m.type === 'in' ? 'Punch In' : 'Punch Out'}</div>
                            <div>{m.dateLabel}</div>
                            <div>{formatTime(m.time)}</div>
                          </div>
                        </Tooltip>
                        <Popup>
                          <div className="text-sm">
                            <div className="font-semibold text-slate-800">{m.type === 'in' ? 'Punch In' : 'Punch Out'}</div>
                            <div className="text-slate-600 text-xs">{m.dateLabel} • {formatTime(m.time)}</div>
                            {m.address && <div className="text-slate-600 text-xs mt-1">{m.address}</div>}
                            {!m.address && <div className="text-slate-600 text-xs mt-1">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</div>}
                          </div>
                        </Popup>
                      </Marker>
                    )
                  }
                  const isExp = expandedCluster === cluster.id
                  const spiderPos = isExp ? getSpiderPositions(cluster.center, cluster.markers.length) : []
                  return (
                    <Fragment key={cluster.id}>
                      {!isExp && (
                        <Marker
                          position={cluster.center}
                          icon={makeClusterIcon(cluster.markers.length)}
                          eventHandlers={{ mouseover: () => expandCluster(cluster.id), mouseout: () => startCollapseTimer() }}
                        >
                          <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                            <div className="text-xs font-semibold">{cluster.markers.length} punches here</div>
                          </Tooltip>
                        </Marker>
                      )}
                      {isExp && cluster.markers.map((m, idx) => (
                        <Fragment key={m.key}>
                          <Polyline positions={[cluster.center, spiderPos[idx]]} pathOptions={{ color: '#8b5cf6', weight: 1.5, opacity: 0.4, dashArray: '4 4' }} />
                          <Marker
                            position={spiderPos[idx]}
                            icon={makePunchIcon(selectedUser, m.type)}
                            eventHandlers={{ mouseover: () => cancelCollapse(), mouseout: () => startCollapseTimer() }}
                          >
                            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                              <div className="text-xs">
                                <div className="font-semibold">{m.type === 'in' ? 'Punch In' : 'Punch Out'}</div>
                                <div>{m.dateLabel}</div>
                                <div>{formatTime(m.time)}</div>
                              </div>
                            </Tooltip>
                            <Popup>
                              <div className="text-sm">
                                <div className="font-semibold text-slate-800">{m.type === 'in' ? 'Punch In' : 'Punch Out'}</div>
                                <div className="text-slate-600 text-xs">{m.dateLabel} • {formatTime(m.time)}</div>
                                {m.address && <div className="text-slate-600 text-xs mt-1">{m.address}</div>}
                                {!m.address && <div className="text-slate-600 text-xs mt-1">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</div>}
                              </div>
                            </Popup>
                          </Marker>
                        </Fragment>
                      ))}
                    </Fragment>
                  )
                })}

                {mapData.points.length > 0 && <FitBounds points={mapData.points} />}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">
                Select an employee to view monthly punch locations
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="absolute bottom-3 left-3 bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/70">
              {loadingAttendance ? 'Loading attendance...' : `Records: ${monthRecords.length}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminEmployeeMap
