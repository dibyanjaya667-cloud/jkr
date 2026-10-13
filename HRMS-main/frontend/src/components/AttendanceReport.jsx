import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { API_URL } from '../lib/api'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toMonthKey(d) {
  const dt = d instanceof Date ? d : new Date(d)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
  } catch {
    return ''
  }
}

function fmtTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function fmtLocation(loc) {
  if (!loc) return '—'
  if (loc.address) return loc.address
  const hasLat = typeof loc.lat === 'number'
  const hasLng = typeof loc.lng === 'number'
  if (hasLat && hasLng) return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
  return '—'
}

function getLateStatus(punchInTime) {
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

function getLateStatusColor(status) {
  if (status === 'ontime') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
  if (status === 'yellow') return 'bg-amber-500/20 text-amber-200 border-amber-500/30'
  if (status === 'lightred') return 'bg-orange-500/20 text-orange-200 border-orange-500/30'
  if (status === 'red') return 'bg-red-500/20 text-red-200 border-red-500/30'
  return 'bg-white/5 text-white/50 border-white/10'
}

function minsToHours(mins) {
  const n = typeof mins === 'number' ? mins : 0
  return Math.round((n / 60) * 10) / 10
}

function statusMeta(status) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' }
    case 'working':
      return { label: 'Live', cls: 'bg-sky-500/20 text-sky-200 border-sky-500/30' }
    case 'missed_punch_out':
      return { label: 'Missed Punch-out', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/30' }
    case 'missed_punch_in':
      return { label: 'Missed Punch-in', cls: 'bg-rose-500/20 text-rose-200 border-rose-500/30' }
    case 'illegal':
      return { label: 'Illegal', cls: 'bg-rose-600/20 text-rose-200 border-rose-600/30' }
    case 'pending':
      return { label: 'Incomplete', cls: 'bg-white/10 text-white/70 border-white/10' }
    case 'holiday':
      return { label: 'Sunday', cls: 'bg-violet-500/20 text-violet-200 border-violet-500/30' }
    case 'absent':
    default:
      return { label: 'Absent', cls: 'bg-white/5 text-white/50 border-white/10' }
  }
}

export default function AttendanceReport({ scope = 'hr' }) {
  const [mode, setMode] = useState('last30')
  const [days, setDays] = useState(30)
  const [monthKey, setMonthKey] = useState(toMonthKey(new Date()))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const params = new URLSearchParams()
      params.set('mode', mode)
      if (mode === 'month') {
        params.set('month', monthKey)
      } else {
        params.set('days', String(days))
      }

      const endpoint = scope === 'manager' ? 'team-attendance-report' : 'attendance-report'
      const res = await axios.get(`${API_URL}/admin/${endpoint}?${params.toString()}`, { headers })
      setData(res.data)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load attendance report')
    } finally {
      setLoading(false)
    }
  }, [mode, monthKey, days, scope])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const users = useMemo(() => {
    const list = Array.isArray(data?.users) ? data.users : []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((u) => {
      const name = (u.name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      const emp = (u.employeeId || '').toLowerCase()
      const dept = (u.department || '').toLowerCase()
      return name.includes(q) || email.includes(q) || emp.includes(q) || dept.includes(q)
    })
  }, [data, query])

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rangeLabel = useMemo(() => {
    if (!data?.start || !data?.end) {
      return mode === 'month' ? monthKey : `Last ${days} days`
    }
    return `${fmtDate(data.start)} → ${fmtDate(data.end)}`
  }, [data, mode, monthKey, days])

  const exportExcel = (onlyUser = null) => {
    const reportUsers = onlyUser ? [onlyUser] : (Array.isArray(data?.users) ? data.users : [])
    if (reportUsers.length === 0) return

    const summaryRows = reportUsers.map((u) => ({
      EmployeeId: u.employeeId || '',
      Name: u.name || '',
      Department: u.department || '',
      Role: u.role || '',
      PresentDays: u.summary?.presentDays ?? 0,
      AbsentDays: u.summary?.absentDays ?? 0,
      MissedPunchOutDays: u.summary?.missedPunchOutDays ?? 0,
      WorkHours: u.summary?.totalWorkHours ?? minsToHours(u.summary?.totalWorkMinutes ?? 0),
      OTHours: u.summary?.totalOtHours ?? minsToHours(u.summary?.totalOtMinutes ?? 0),
    }))

    const dailyRows = []
    for (const u of reportUsers) {
      for (const d of (u.days || [])) {
        dailyRows.push({
          EmployeeId: u.employeeId || '',
          Name: u.name || '',
          Department: u.department || '',
          Date: fmtDate(d.date),
          Day: (() => {
            try {
              return new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })
            } catch {
              return ''
            }
          })(),
          Status: statusMeta(d.status).label,
          PunchIn: d.punchInTime ? fmtTime(d.punchInTime) : '—',
          PunchInLateStatus: d.punchInTime ? (getLateStatus(d.punchInTime) || 'N/A') : 'N/A',
          PunchOut: d.punchOutTime ? fmtTime(d.punchOutTime) : '—',
          PunchInLocation: fmtLocation(d.punchInLocation),
          PunchOutLocation: fmtLocation(d.punchOutLocation),
          DistanceFromPunchInM: typeof d.distanceFromPunchInM === 'number' ? d.distanceFromPunchInM : '',
          WithinRadius: typeof d.withinRadius === 'boolean' ? (d.withinRadius ? 'Yes' : 'No') : '',
          PunchInSuspect: d.punchInSuspect ? 'Yes' : 'No',
          PunchInSuspectReason: d.punchInSuspectReason || '',
          PunchOutSuspect: d.punchOutSuspect ? 'Yes' : 'No',
          PunchOutSuspectReason: d.punchOutSuspectReason || '',
          WorkHours: minsToHours(d.workMinutes || 0),
          OTHours: minsToHours(d.overtimeMinutes || 0),
        })
      }
    }

    const wb = XLSX.utils.book_new()
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    const wsDaily = XLSX.utils.json_to_sheet(dailyRows)

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily')

    const key = mode === 'month' ? monthKey : `last-${days}-days`
    const who = onlyUser ? (onlyUser.employeeId || 'employee') : 'all'
    XLSX.writeFile(wb, `attendance-report-${who}-${key}.xlsx`)
  }

  const scopeLabel = scope === 'admin' ? 'Admin' : scope === 'manager' ? 'Manager' : 'HR'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-semibold">Attendance Management</h2>
          <p className="text-white/50 text-xs">{scopeLabel} • {rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchReport}
            className="text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => exportExcel()}
            disabled={!data?.users?.length}
            className="text-xs text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors"
          >
            Download Excel (All)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-white/50 text-xs">Range</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setMode('last30')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                mode === 'last30' ? 'bg-white text-slate-900' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              Last N Days
            </button>
            <button
              onClick={() => setMode('month')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                mode === 'month' ? 'bg-white text-slate-900' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              Month
            </button>
          </div>

          {mode === 'last30' ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Math.min(90, Math.max(1, Number(e.target.value) || 30)))}
                className="w-24 bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <span className="text-white/50 text-xs">days (max 90)</span>
            </div>
          ) : (
            <div className="mt-3">
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3 md:col-span-2">
          <p className="text-white/50 text-xs">Search</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: name / employeeId / department / email"
            className="w-full mt-2 bg-white/10 border border-white/10 text-white placeholder-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {error && <p className="text-rose-300 text-xs mt-2">{error}</p>}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <p className="text-white/60 text-xs">Employees: {users.length}</p>
          {loading && <p className="text-white/40 text-xs">Loading...</p>}
        </div>

        {users.length === 0 ? (
          <div className="px-4 py-8 text-center text-white/40">No data</div>
        ) : (
          <div className="divide-y divide-white/10">
            {users.map((u) => {
              const isOpen = expanded.has(u._id)
              return (
                <div key={u._id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button
                      onClick={() => toggleExpanded(u._id)}
                      className="text-left flex items-center gap-3"
                    >
                      <div className={`w-7 h-7 rounded-full ${isOpen ? 'bg-white text-slate-900' : 'bg-white/10 text-white/70'} flex items-center justify-center text-xs font-bold`}>
                        {isOpen ? '-' : '+'}
                      </div>
                      <div>
                        <p className="text-white font-medium leading-tight">
                          {u.name} <span className="text-white/40 text-xs font-normal">({u.employeeId || '—'})</span>
                        </p>
                        <p className="text-white/40 text-xs">
                          {u.department || '—'} {u.managerName ? `• Manager: ${u.managerName}` : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-1 rounded-lg bg-white/10 text-white/70">P: {u.summary?.presentDays ?? 0}</span>
                      <span className="text-xs px-2 py-1 rounded-lg bg-white/10 text-white/70">A: {u.summary?.absentDays ?? 0}</span>
                      <span className="text-xs px-2 py-1 rounded-lg bg-white/10 text-white/70">OT: {u.summary?.totalOtHours ?? minsToHours(u.summary?.totalOtMinutes ?? 0)}h</span>
                      {(u.summary?.missedPunchOutDays ?? 0) > 0 && (
                        <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/30">
                          Missed: {u.summary.missedPunchOutDays}
                        </span>
                      )}
                      <button
                        onClick={() => exportExcel(u)}
                        className="text-xs text-white bg-emerald-500/80 hover:bg-emerald-500 px-3 py-2 rounded-lg transition-colors"
                      >
                        Excel
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 overflow-auto rounded-xl border border-white/10">
                      <table className="min-w-[1500px] w-full text-sm">
                        <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-white/10">
                          <tr>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Date</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Status</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Punch In</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Late Status</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Punch Out</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Punch In Location</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Punch Out Location</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Distance (m)</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Within Radius</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">In Suspect</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Out Suspect</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">Work (h)</th>
                            <th className="text-left text-white/60 font-semibold text-xs uppercase tracking-wider px-3 py-2">OT (h)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(u.days || []).map((d, idx) => {
                            const meta = statusMeta(d.status)
                            return (
                              <tr
                                key={`${u._id}-${d.date}`}
                                className={idx % 2 === 0 ? 'bg-white/[0.02] border-b border-white/5' : 'bg-transparent border-b border-white/5'}
                              >
                                <td className="px-3 py-2 text-white/80 whitespace-nowrap">{fmtDate(d.date)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.cls}`}>{meta.label}</span>
                                </td>
                                <td className="px-3 py-2 text-white/70 whitespace-nowrap">{d.punchInTime ? fmtTime(d.punchInTime) : '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {d.punchInTime ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getLateStatusColor(getLateStatus(d.punchInTime))}`}>
                                      {getLateStatus(d.punchInTime) === 'ontime' ? '🟢 On Time' : 
                                       getLateStatus(d.punchInTime) === 'yellow' ? '🟡 Slight Late' :
                                       getLateStatus(d.punchInTime) === 'lightred' ? '🟠 Late' : '🔴 Very Late'}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2 text-white/70 whitespace-nowrap">{d.punchOutTime ? fmtTime(d.punchOutTime) : (d.status === 'working' ? 'Live' : '—')}</td>
                                <td className="px-3 py-2 text-white/70 min-w-[220px]">{fmtLocation(d.punchInLocation)}</td>
                                <td className="px-3 py-2 text-white/70 min-w-[220px]">{fmtLocation(d.punchOutLocation)}</td>
                                <td className="px-3 py-2 text-white/70 whitespace-nowrap">{typeof d.distanceFromPunchInM === 'number' ? d.distanceFromPunchInM.toFixed(0) : '—'}</td>
                                <td className="px-3 py-2 text-white/70 whitespace-nowrap">
                                  {typeof d.withinRadius === 'boolean' ? (d.withinRadius ? 'Yes' : 'No') : '—'}
                                </td>
                                <td className="px-3 py-2 text-white/70 whitespace-nowrap">{d.punchInSuspect ? 'Yes' : 'No'}</td>
                                <td className="px-3 py-2 text-white/70 whitespace-nowrap">{d.punchOutSuspect ? 'Yes' : 'No'}</td>
                                <td className="px-3 py-2 text-white/70 whitespace-nowrap">{minsToHours(d.workMinutes || 0)}</td>
                                <td className="px-3 py-2 text-white/70 whitespace-nowrap">{minsToHours(d.overtimeMinutes || 0)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
