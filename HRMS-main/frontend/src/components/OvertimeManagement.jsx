import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { API_URL } from '../lib/api'

const statusMeta = (status) => {
  switch (status) {
    case 'approved':
      return { label: 'Approved', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' }
    case 'rejected':
      return { label: 'Rejected', cls: 'bg-rose-500/20 text-rose-200 border-rose-500/30' }
    case 'pending':
      return { label: 'Pending', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/30' }
    default:
      return { label: 'None', cls: 'bg-white/5 text-white/50 border-white/10' }
  }
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

const fmtTime = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

const minsToHrs = (mins) => {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  return `${h}h ${r}m`
}

export default function OvertimeManagement({ scope = 'hr', title = 'OT Management' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [drafts, setDrafts] = useState({})

  const endpoint = scope === 'manager' ? 'team-ot-requests' : 'ot-requests'

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const res = await axios.get(`${API_URL}/admin/${endpoint}?status=${statusFilter}`, { headers })
      const list = Array.isArray(res.data?.items) ? res.data.items : []
      setItems(list)
      setDrafts((prev) => {
        const next = { ...prev }
        list.forEach((row) => {
          const key = `${row.userId}-${row.attendanceId}`
          if (!next[key]) {
            const baseMinutes = row.overtimeAdjustedMinutes ?? row.overtimeMinutes ?? 0
            const h = Math.floor(baseMinutes / 60)
            const m = baseMinutes % 60
            next[key] = {
              adjustedMinutes: baseMinutes,
              adjustedHours: h,
              adjustedMins: m,
              note: row.overtimeAdjustmentNote || '',
            }
          }
        })
        return next
      })
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load OT requests')
    } finally {
      setLoading(false)
    }
  }, [endpoint, statusFilter])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const updateDraft = (key, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }))
  }

  const submitUpdate = async (row, nextStatus) => {
    const key = `${row.userId}-${row.attendanceId}`
    const draft = drafts[key] || {}
    const hours = Number(draft.adjustedHours) || 0
    const mins = Number(draft.adjustedMins) || 0
    const totalAdjusted = Math.max(0, hours * 60 + mins)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      await axios.patch(
        `${API_URL}/admin/ot-requests/${row.userId}/${row.attendanceId}`,
        {
          status: nextStatus,
          adjustedMinutes: totalAdjusted,
          note: draft.note || '',
        },
        { headers }
      )
      fetchList()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to update OT')
    }
  }

  const totalItems = items.length

  const summary = useMemo(() => {
    return items.reduce(
      (acc, row) => {
        acc.totalRaw += row.overtimeMinutes || 0
        acc.totalApproved += row.overtimeFinalMinutes || 0
        return acc
      },
      { totalRaw: 0, totalApproved: 0 }
    )
  }, [items])

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
          <p className="text-white/50 text-xs">Pending OT approvals and adjustments</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-xs"
          >
            <option value="pending" className="bg-slate-800">Pending</option>
            <option value="approved" className="bg-slate-800">Approved</option>
            <option value="rejected" className="bg-slate-800">Rejected</option>
            <option value="all" className="bg-slate-800">All</option>
          </select>
          <button
            onClick={fetchList}
            className="text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
        <span>Total: {totalItems}</span>
        <span>Raw OT: {minsToHrs(summary.totalRaw)}</span>
        <span>Approved OT: {minsToHrs(summary.totalApproved)}</span>
      </div>

      {error && <p className="text-rose-300 text-xs mt-2">{error}</p>}

      <div className="mt-3 overflow-auto rounded-xl border border-white/10">
        <table className="min-w-[1100px] w-full text-xs">
          <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-white/10">
            <tr>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Employee</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Department</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Date</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Punch In</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Punch Out</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">OT Raw</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Adjusted</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Final</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Status</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Note</th>
              <th className="text-left text-white/60 font-semibold text-[10px] uppercase tracking-wider px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-white/40">Loading...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-white/40">No OT records</td>
              </tr>
            ) : (
              items.map((row, idx) => {
                const key = `${row.userId}-${row.attendanceId}`
                const meta = statusMeta(row.overtimeStatus)
                const draft = drafts[key] || {}
                return (
                  <tr
                    key={key}
                    className={idx % 2 === 0 ? 'bg-white/[0.02] border-b border-white/5' : 'bg-transparent border-b border-white/5'}
                  >
                    <td className="px-3 py-2 text-white/90 whitespace-nowrap">
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-white/40">{row.employeeId}</div>
                    </td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{row.department || '—'}</td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{fmtDate(row.date)}</td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{fmtTime(row.punchInTime)}</td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{fmtTime(row.punchOutTime)}</td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{minsToHrs(row.overtimeMinutes)}</td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={draft.adjustedHours ?? 0}
                          onChange={(e) => updateDraft(key, 'adjustedHours', Number(e.target.value))}
                          className="w-14 bg-white/10 border border-white/10 text-white rounded px-2 py-1 text-xs"
                        />
                        <span className="text-white/40 text-[10px]">h</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={draft.adjustedMins ?? 0}
                          onChange={(e) => updateDraft(key, 'adjustedMins', Number(e.target.value))}
                          className="w-14 bg-white/10 border border-white/10 text-white rounded px-2 py-1 text-xs"
                        />
                        <span className="text-white/40 text-[10px]">m</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{minsToHrs(row.overtimeFinalMinutes)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-2 text-white/70">
                      <input
                        value={draft.note ?? ''}
                        onChange={(e) => updateDraft(key, 'note', e.target.value)}
                        placeholder="Reason / note"
                        className="w-40 bg-white/10 border border-white/10 text-white rounded px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => submitUpdate(row, 'approved')}
                          className="text-xs bg-emerald-500/80 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => submitUpdate(row, 'rejected')}
                          className="text-xs bg-rose-500/80 hover:bg-rose-500 text-white px-2.5 py-1 rounded-lg"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => submitUpdate(row, row.overtimeStatus || 'pending')}
                          className="text-xs bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-lg"
                        >
                          Save
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
