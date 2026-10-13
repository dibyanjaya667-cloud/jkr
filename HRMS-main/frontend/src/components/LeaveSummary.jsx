import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../lib/api'

function toDateOnlyISO(d) {
  try {
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return ''
    const yyyy = x.getFullYear()
    const mm = String(x.getMonth() + 1).padStart(2, '0')
    const dd = String(x.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } catch {
    return ''
  }
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
  } catch {
    return '—'
  }
}

function safeUser(u) {
  return u || {}
}

export default function LeaveSummary() {
  const [selectedDate, setSelectedDate] = useState(() => toDateOnlyISO(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')

  const fetchSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/admin/leave-summary?date=${encodeURIComponent(selectedDate)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.message || 'Failed to load leave summary')
      setData(json)
    } catch (e) {
      setError(e?.message || 'Failed to load leave summary')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const filterByQuery = (items) => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return (items || []).filter((lv) => {
      const a = safeUser(lv?.applicant)
      const hay = [
        a.name,
        a.email,
        a.employeeId,
        a.department,
        a.role,
        lv.leaveType,
        lv.status,
        lv.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(query)
    })
  }

  const onLeaveToday = useMemo(() => filterByQuery(data?.onLeaveToday || []), [data, q])
  const pending = useMemo(() => filterByQuery(data?.pending || []), [data, q])
  const appliedToday = useMemo(() => filterByQuery(data?.appliedToday || []), [data, q])

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-white font-semibold text-lg">Leave Summary</h2>
          <p className="text-white/50 text-sm">Today on-leave, new applications, and pending requests in one view.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / id / dept / type"
            className="bg-white/10 border border-white/10 text-white placeholder-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <button
            onClick={fetchSummary}
            className="bg-white text-slate-900 hover:bg-white/90 rounded-lg px-3 py-2 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-2">
          <p className="text-white/50 text-[10px]">On Leave</p>
          <p className="text-white text-lg font-bold leading-tight">{data?.counts?.onLeaveToday ?? '—'}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-2">
          <p className="text-white/50 text-[10px]">Applied</p>
          <p className="text-white text-lg font-bold leading-tight">{data?.counts?.appliedToday ?? '—'}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-2">
          <p className="text-white/50 text-[10px]">Pending</p>
          <p className="text-white text-lg font-bold leading-tight">{data?.counts?.pending ?? '—'}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl p-3 text-sm">{error}</div>
      )}

      {loading && (
        <div className="text-white/50 text-sm">Loading...</div>
      )}

      {!loading && !error && (
        <>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white/80 text-xs font-semibold">On Leave ({onLeaveToday.length})</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
              {onLeaveToday.length === 0 ? (
                <div className="text-white/40 text-xs">No one is on leave.</div>
              ) : (
                onLeaveToday.map((lv) => {
                  const a = safeUser(lv?.applicant)
                  return (
                    <div key={lv._id} className="bg-black/30 border border-white/5 rounded-lg p-2">
                      <div className="text-white text-xs font-semibold">{a.name || '—'}</div>
                      <div className="text-white/40 text-[10px]">{a.employeeId || '—'} • {a.department || '—'}</div>
                      <div className="text-white/60 text-[10px] mt-1">{lv.leaveType || '—'} • {fmtDate(lv.startDate)} → {fmtDate(lv.endDate)}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white/80 text-xs font-semibold">Pending Requests ({pending.length})</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
              {pending.length === 0 ? (
                <div className="text-white/40 text-xs">No pending requests.</div>
              ) : (
                pending.map((lv) => {
                  const a = safeUser(lv?.applicant)
                  return (
                    <div key={lv._id} className="bg-black/30 border border-white/5 rounded-lg p-2">
                      <div className="text-white text-xs font-semibold">{a.name || '—'}</div>
                      <div className="text-white/40 text-[10px]">{a.employeeId || '—'} • {a.role || lv.applicantRole || '—'}</div>
                      <div className="text-white/60 text-[10px] mt-1">{lv.leaveType || '—'} • {fmtDate(lv.startDate)} → {fmtDate(lv.endDate)}</div>
                      <div className="text-white/40 text-[10px] mt-1 line-clamp-2">{lv.reason || '—'}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white/80 text-xs font-semibold">Applied Today ({appliedToday.length})</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
              {appliedToday.length === 0 ? (
                <div className="text-white/40 text-xs">No applications today.</div>
              ) : (
                appliedToday.map((lv) => {
                  const a = safeUser(lv?.applicant)
                  return (
                    <div key={lv._id} className="bg-black/30 border border-white/5 rounded-lg p-2">
                      <div className="text-white text-xs font-semibold">{a.name || '—'}</div>
                      <div className="text-white/40 text-[10px]">{a.employeeId || '—'} • {a.department || '—'}</div>
                      <div className="text-white/60 text-[10px] mt-1">{lv.leaveType || '—'} • {lv.totalDays || 0} day(s)</div>
                      <div className="text-white/40 text-[10px] mt-1">{fmtDate(lv.startDate)} → {fmtDate(lv.endDate)}</div>
                      <div className="text-white/40 text-[10px] mt-1 line-clamp-2">{lv.reason || '—'}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
