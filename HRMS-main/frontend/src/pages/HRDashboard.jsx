import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'
import { downloadPayslipImage } from '../lib/payslipImage'
import AttendanceReport from '../components/AttendanceReport'
import LeaveSummary from '../components/LeaveSummary'
import OvertimeManagement from '../components/OvertimeManagement'

function HRDashboard({ onLogout }) {
  const [stats, setStats] = useState(null)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('attendance')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [lateStatusFilter, setLateStatusFilter] = useState('all')
  const [attendanceDate, setAttendanceDate] = useState(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })
  
  // Verification States
  const [verificationStats, setVerificationStats] = useState(null)
  const [pendingProfiles, setPendingProfiles] = useState([])
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [verificationFilter, setVerificationFilter] = useState('pending')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [permissionRequests, setPermissionRequests] = useState([])
  const [permissionLoading, setPermissionLoading] = useState(false)
  const [pendingActivations, setPendingActivations] = useState([])
  const [activationsLoading, setActivationsLoading] = useState(false)
  const [managers, setManagers] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [selectedManager, setSelectedManager] = useState('')
  const [payslipUsers, setPayslipUsers] = useState([])
  const [payslipLoading, setPayslipLoading] = useState(false)
  const [payslipQuery, setPayslipQuery] = useState('')
  const [payslipEditingUser, setPayslipEditingUser] = useState(null)
  const [payslipMonth, setPayslipMonth] = useState('')
  const [payslipSettingsForm, setPayslipSettingsForm] = useState({ mode: 'locked', delayMonths: 2 })
  const [payslipApprovalMonth, setPayslipApprovalMonth] = useState('')
  const [payslipApprovalApproved, setPayslipApprovalApproved] = useState(true)
  const [payslipProfileForm, setPayslipProfileForm] = useState({
    designation: '',
    bankName: '',
    accountNumber: '',
    pfAccountNumber: '',
    panNumber: '',
    uanNumber: '',
    esiNumber: '',
    workLocation: '',
    city: '',
  })
  const [salaryForm, setSalaryForm] = useState({
    ctcAnnual: 0,
    basisSalary: 0,
    houseRentAllowance: 0,
    medicalAllowance: 0,
    educationAllowance: 0,
    otherAllowance: 0,
    epf: 0,
    esic: 0,
    tds: 0,
    otherDeductions: 0,
    totalEarningsOverride: null,
    totalDeductionsOverride: null,
    netPayOverride: null,
  })
  const [salaryOverridesTouched, setSalaryOverridesTouched] = useState(false)
  const [payslipSalaryForm, setPayslipSalaryForm] = useState({
    ctcAnnual: 0,
    basisSalary: 0,
    houseRentAllowance: 0,
    medicalAllowance: 0,
    educationAllowance: 0,
    otherAllowance: 0,
    epf: 0,
    esic: 0,
    tds: 0,
    otherDeductions: 0,
    totalEarningsOverride: null,
    totalDeductionsOverride: null,
    netPayOverride: null,
  })
  const [payslipOverridesTouched, setPayslipOverridesTouched] = useState(false)
  
  const navigate = useNavigate()

  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
  const toAbsoluteUrl = useCallback((value) => {
    if (!value) return ''
    if (/^https?:\/\//i.test(value)) return value
    const normalized = String(value).startsWith('/') ? String(value) : `/${value}`
    return `${API_ORIGIN}${normalized}`
  }, [API_ORIGIN])

  const openDocPreview = useCallback(async (docUrl) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const abs = toAbsoluteUrl(docUrl)
      if (!abs) return
      const res = await axios.get(`${API_URL}/storage/document`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { url: abs },
        responseType: 'blob',
      })
      const blobUrl = URL.createObjectURL(res.data)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to load document')
    }
  }, [toAbsoluteUrl])

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      // Get current user role from token
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setCurrentUserRole(payload.role || '')
      } catch (e) { /* ignore */ }

      const [teamRes, verifyStatsRes, attendanceRes] = await Promise.all([
        axios.get(`${API_URL}/admin/my-team`, { headers }),
        axios.get(`${API_URL}/admin/verification-stats`, { headers }),
        axios.get(`${API_URL}/admin/today-attendance`, { headers, params: { date: attendanceDate } }),
      ])

      setVerificationStats(verifyStatsRes.data)
      
      const allEmployees = teamRes.data.allEmployees || []
      const attendanceData = attendanceRes.data || []
      
      // Calculate stats with late status
      const today = new Date().toDateString()
      let punchedIn = 0, punchedOut = 0, ontime = 0, yellow = 0, lightred = 0, red = 0
      
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
      
      attendanceData.forEach(emp => {
        if (emp.punchIn?.time) {
          punchedIn++
          const status = getLateStatus(emp.punchIn.time)
          if (status === 'ontime') ontime++
          else if (status === 'yellow') yellow++
          else if (status === 'lightred') lightred++
          else if (status === 'red') red++
        }
        if (emp.punchOut?.time) punchedOut++
      })

      setStats({
        totalEmployees: allEmployees.length,
        onlineNow: allEmployees.filter(e => e.isOnline).length,
        punchedIn,
        punchedOut,
        notPunchedIn: allEmployees.length - punchedIn,
        pendingVerification: verifyStatsRes.data?.pending || 0,
        ontime,
        yellow,
        lightred,
        red,
      })
      setEmployees(attendanceData)
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }, [attendanceDate])

  useEffect(() => {
    fetchData()
    if (activeTab !== 'attendance') return undefined
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [activeTab, fetchData])

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  // Fetch pending profiles for verification
  const fetchPendingProfiles = useCallback(async (status = 'pending') => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/admin/pending-profiles?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setPendingProfiles(res.data)
    } catch (error) {
      console.error('Error fetching profiles:', error)
    }
  }, [])

  // Fetch full profile details
  const fetchProfileDetails = async (userId) => {
    try {
      setProfileLoading(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/admin/profile-details/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSelectedProfile(res.data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setProfileLoading(false)
    }
  }

  // Approve profile
  const handleApprove = async (userId) => {
    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')
      await axios.put(`${API_URL}/admin/verify-profile/${userId}`, 
        { action: 'approve' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSelectedProfile(null)
      fetchPendingProfiles(verificationFilter)
      fetchData()
    } catch (error) {
      console.error('Error approving:', error)
    } finally {
      setActionLoading(false)
    }
  }

  // Reject profile
  const handleReject = async (userId) => {
    if (!rejectionReason.trim()) return
    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')
      await axios.put(`${API_URL}/admin/verify-profile/${userId}`, 
        { action: 'reject', rejectionReason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setShowRejectModal(false)
      setRejectionReason('')
      setSelectedProfile(null)
      fetchPendingProfiles(verificationFilter)
      fetchData()
    } catch (error) {
      console.error('Error rejecting:', error)
    } finally {
      setActionLoading(false)
    }
  }

  // Unlock profile for editing
  const handleUnlock = async (userId) => {
    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')
      await axios.put(`${API_URL}/admin/unlock-profile/${userId}`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSelectedProfile(null)
      fetchPendingProfiles(verificationFilter)
      fetchData()
    } catch (error) {
      console.error('Error unlocking:', error)
      alert(error.response?.data?.message || 'Failed to unlock profile')
    } finally {
      setActionLoading(false)
    }
  }

  const fetchPunchPermissionRequests = useCallback(async () => {
    try {
      setPermissionLoading(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/notifications/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { category: 'attendance', limit: 50 }
      })
      const items = (res.data || [])
        .filter(n => !n.isRead)
        .filter(n => (n.title || '').toLowerCase().includes('punch permission'))
      setPermissionRequests(items)
    } catch (error) {
      console.error('Error fetching permission requests:', error)
    } finally {
      setPermissionLoading(false)
    }
  }, [])

  const fetchPendingActivations = useCallback(async () => {
    try {
      setActivationsLoading(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/admin/pending-activations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setPendingActivations(res.data.users || [])
    } catch (error) {
      console.error('Error fetching pending activations:', error)
    } finally {
      setActivationsLoading(false)
    }
  }, [])

  const fetchManagers = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/public/managers`)
      setManagers(res.data || [])
    } catch (error) {
      console.error('Error fetching managers:', error)
    }
  }, [])

  const fetchPayslipUsers = useCallback(async () => {
    try {
      setPayslipLoading(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/admin/payslip-users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setPayslipUsers(res.data.users || [])
    } catch (error) {
      console.error('Error fetching payslip users:', error)
    } finally {
      setPayslipLoading(false)
    }
  }, [])

  const buildDefaultSalary = (ctcAnnual) => {
    const annual = Number(ctcAnnual || 0)
    const monthly = annual > 0 ? annual / 12 : 0
    const basisSalary = Math.round(monthly * 0.5)
    const houseRentAllowance = Math.round(basisSalary * 0.4)
    const medicalAllowance = 4500
    const educationAllowance = 0
    const epf = Math.round(basisSalary * 0.12)
    const esic = 0
    const tds = 0
    const otherDeductions = 0
    const otherAllowance = Math.max(0, Math.round(monthly - (basisSalary + houseRentAllowance + medicalAllowance + educationAllowance)))
    return {
      ctcAnnual: annual,
      basisSalary,
      houseRentAllowance,
      medicalAllowance,
      educationAllowance,
      otherAllowance,
      epf,
      esic,
      tds,
      otherDeductions,
      totalEarningsOverride: null,
      totalDeductionsOverride: null,
      netPayOverride: null,
    }
  }

  const calculateTotals = (salary) => {
    const basisSalary = Number(salary.basisSalary || 0)
    const houseRentAllowance = Number(salary.houseRentAllowance || 0)
    const medicalAllowance = Number(salary.medicalAllowance || 0)
    const educationAllowance = Number(salary.educationAllowance || 0)
    const otherAllowance = Number(salary.otherAllowance || 0)
    const epf = Number(salary.epf || 0)
    const esic = Number(salary.esic || 0)
    const tds = Number(salary.tds || 0)
    const otherDeductions = Number(salary.otherDeductions || 0)

    const totalEarnings = basisSalary + houseRentAllowance + medicalAllowance + educationAllowance + otherAllowance
    const totalDeductions = epf + esic + tds + otherDeductions
    const netPay = Math.max(0, totalEarnings - totalDeductions)
    return { totalEarnings, totalDeductions, netPay }
  }

  const salaryTotals = useMemo(() => calculateTotals(salaryForm), [salaryForm])
  const payslipTotals = useMemo(() => calculateTotals(payslipSalaryForm), [payslipSalaryForm])

  useEffect(() => {
    if (salaryOverridesTouched) return
    setSalaryForm(prev => {
      const next = {
        ...prev,
        totalEarningsOverride: salaryTotals.totalEarnings,
        totalDeductionsOverride: salaryTotals.totalDeductions,
        netPayOverride: salaryTotals.netPay,
      }
      if (
        prev.totalEarningsOverride === next.totalEarningsOverride &&
        prev.totalDeductionsOverride === next.totalDeductionsOverride &&
        prev.netPayOverride === next.netPayOverride
      ) {
        return prev
      }
      return next
    })
  }, [salaryTotals, salaryOverridesTouched])

  useEffect(() => {
    if (payslipOverridesTouched) return
    setPayslipSalaryForm(prev => {
      const next = {
        ...prev,
        totalEarningsOverride: payslipTotals.totalEarnings,
        totalDeductionsOverride: payslipTotals.totalDeductions,
        netPayOverride: payslipTotals.netPay,
      }
      if (
        prev.totalEarningsOverride === next.totalEarningsOverride &&
        prev.totalDeductionsOverride === next.totalDeductionsOverride &&
        prev.netPayOverride === next.netPayOverride
      ) {
        return prev
      }
      return next
    })
  }, [payslipTotals, payslipOverridesTouched])

  const getLatestApprovedMonth = (approvals = []) => {
    const approved = approvals.filter(a => a?.approved && a?.month)
    if (approved.length === 0) return '—'
    approved.sort((a, b) => a.month.localeCompare(b.month))
    return approved[approved.length - 1].month
  }

  useEffect(() => {
    if (activeTab === 'verification') {
      fetchPendingProfiles(verificationFilter)
    }
  }, [activeTab, verificationFilter, fetchPendingProfiles])

  useEffect(() => {
    if (activeTab === 'punch-permissions') {
      fetchPunchPermissionRequests()
    }
  }, [activeTab, fetchPunchPermissionRequests])

  useEffect(() => {
    if (activeTab === 'activations') {
      fetchPendingActivations()
      fetchManagers()
    }
  }, [activeTab, fetchPendingActivations, fetchManagers])

  useEffect(() => {
    if (activeTab === 'payslips') {
      fetchPayslipUsers()
    }
  }, [activeTab, fetchPayslipUsers])

  useEffect(() => {
    if (editingUser) {
      const existing = editingUser.salaryStructure || {}
      const seedCtc = existing.ctcAnnual || 600000
      const defaults = buildDefaultSalary(seedCtc)
      setSalaryForm({
        ...defaults,
        ...existing,
      })
      setSalaryOverridesTouched(Boolean(
        existing.totalEarningsOverride !== null && existing.totalEarningsOverride !== undefined && existing.totalEarningsOverride !== ''
        || existing.totalDeductionsOverride !== null && existing.totalDeductionsOverride !== undefined && existing.totalDeductionsOverride !== ''
        || existing.netPayOverride !== null && existing.netPayOverride !== undefined && existing.netPayOverride !== ''
      ))
    }
  }, [editingUser])

  useEffect(() => {
    if (payslipEditingUser) {
      const existing = payslipEditingUser.salaryStructure || {}
      const seedCtc = existing.ctcAnnual || 600000
      const defaults = buildDefaultSalary(seedCtc)
      setPayslipSalaryForm({
        ...defaults,
        ...existing,
      })
      setPayslipOverridesTouched(Boolean(
        existing.totalEarningsOverride !== null && existing.totalEarningsOverride !== undefined && existing.totalEarningsOverride !== ''
        || existing.totalDeductionsOverride !== null && existing.totalDeductionsOverride !== undefined && existing.totalDeductionsOverride !== ''
        || existing.netPayOverride !== null && existing.netPayOverride !== undefined && existing.netPayOverride !== ''
      ))
      setPayslipProfileForm({
        designation: payslipEditingUser.designation || '',
        bankName: payslipEditingUser.bankName || '',
        accountNumber: payslipEditingUser.accountNumber || '',
        pfAccountNumber: payslipEditingUser.pfAccountNumber || '',
        panNumber: payslipEditingUser.panNumber || '',
        uanNumber: payslipEditingUser.uanNumber || '',
        esiNumber: payslipEditingUser.esiNumber || '',
        workLocation: payslipEditingUser.workLocation || '',
        city: payslipEditingUser.city || '',
      })
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setPayslipMonth(currentMonth)
      setPayslipApprovalMonth(currentMonth)
      setPayslipApprovalApproved(true)
      setPayslipSettingsForm({
        mode: payslipEditingUser.payslipSettings?.mode || 'locked',
        delayMonths: typeof payslipEditingUser.payslipSettings?.delayMonths === 'number'
          ? payslipEditingUser.payslipSettings.delayMonths
          : 2,
      })
    }
  }, [payslipEditingUser])

  const handlePermissionAction = async (notif, allow) => {
    const token = localStorage.getItem('token')
    const senderId = notif?.data?.senderId
    if (!senderId) return
    try {
      await axios.post(`${API_URL}/leave/punch-permission/${senderId}`,
        { allow, note: notif?.message || 'Punch permission' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (notif?._id) {
        await axios.put(`${API_URL}/notifications/${notif._id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      setPermissionRequests((prev) => prev.filter((n) => n._id !== notif._id))
    } catch (error) {
      console.error('Permission action error:', error)
      alert(error.response?.data?.message || 'Failed')
    }
  }

  const handleActivateUser = async (userId, activate, managerId = null, salaryStructure = null) => {
    const token = localStorage.getItem('token')
    try {
      await axios.put(`${API_URL}/admin/activate-user/${userId}`,
        { activate, reportsTo: managerId, salaryStructure },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setPendingActivations((prev) => prev.filter((u) => u._id !== userId))
      setEditingUser(null)
      setSelectedManager('')
      alert(activate ? 'User activated successfully' : 'User deactivated successfully')
    } catch (error) {
      console.error('Activation error:', error)
      alert(error.response?.data?.message || 'Failed')
    }
  }

  const handleDownloadPayslip = async (userId) => {
    const token = localStorage.getItem('token')
    try {
      const month = new Date()
      const monthParam = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
      const res = await axios.get(`${API_URL}/admin/payslip/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: monthParam }
      })
      await downloadPayslipImage(res.data, `PaySlip-${monthParam}.png`)
    } catch (error) {
      console.error('Payslip download error:', error)
      alert(error.response?.data?.message || 'Failed to download payslip')
    }
  }

  const handlePayslipDownloadForUser = async () => {
    if (!payslipEditingUser) return
    const token = localStorage.getItem('token')
    try {
      const res = await axios.get(`${API_URL}/admin/payslip/${payslipEditingUser._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: payslipMonth }
      })
      await downloadPayslipImage(
        res.data,
        `PaySlip-${payslipEditingUser.employeeId || 'employee'}-${payslipMonth}.png`
      )
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to download payslip')
    }
  }

  const handleSavePayslipProfile = async () => {
    if (!payslipEditingUser) return
    const token = localStorage.getItem('token')
    try {
      const { designation, ...profilePayload } = payslipProfileForm
      const payload = currentUserRole === 'hr' ? profilePayload : payslipProfileForm
      await axios.put(`${API_URL}/admin/payslip-profile/${payslipEditingUser._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchPayslipUsers()
      alert('Payslip profile updated')
    } catch (error) {
      alert(error.response?.data?.message || 'Failed')
    }
  }

  const handleSavePayslipSalary = async () => {
    if (!payslipEditingUser) return
    const token = localStorage.getItem('token')
    try {
      await axios.put(`${API_URL}/admin/salary/${payslipEditingUser._id}`,
        { salaryStructure: payslipSalaryForm },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchPayslipUsers()
      alert('Salary structure updated')
    } catch (error) {
      alert(error.response?.data?.message || 'Failed')
    }
  }

  const handleSavePayslipSettings = async () => {
    if (!payslipEditingUser) return
    const token = localStorage.getItem('token')
    try {
      await axios.put(`${API_URL}/admin/payslip-settings/${payslipEditingUser._id}`,
        payslipSettingsForm,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchPayslipUsers()
      alert('Payslip settings updated')
    } catch (error) {
      alert(error.response?.data?.message || 'Failed')
    }
  }

  const handlePayslipApproval = async () => {
    if (!payslipEditingUser) return
    if (!/^[0-9]{4}-[0-9]{2}$/.test(payslipApprovalMonth)) {
      alert('Invalid month format. Use YYYY-MM')
      return
    }
    const token = localStorage.getItem('token')
    try {
      await axios.post(`${API_URL}/admin/payslip-approval/${payslipEditingUser._id}`,
        { month: payslipApprovalMonth, approved: payslipApprovalApproved },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchPayslipUsers()
      alert('Payslip approval updated')
    } catch (error) {
      alert(error.response?.data?.message || 'Failed')
    }
  }

  const uniqueDepartments = useMemo(() => {
    const all = employees || []
    const depts = [...new Set(all.map(u => u.department).filter(Boolean))]
    return depts.sort()
  }, [employees])

  const filteredEmployees = useMemo(() => {
    let filtered = employees
    
    // Search filter
    const q = query.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(u => {
        const name = (u.name || '').toLowerCase()
        const email = (u.email || '').toLowerCase()
        const emp = (u.employeeId || '').toLowerCase()
        const dept = (u.department || '').toLowerCase()
        return name.includes(q) || email.includes(q) || emp.includes(q) || dept.includes(q)
      })
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(u => (u.department || '').toLowerCase() === departmentFilter.toLowerCase())
    }

    // Late status filter
    if (lateStatusFilter !== 'all') {
      filtered = filtered.filter(u => {
        if (!u.punchIn?.time) return lateStatusFilter === 'nopunch'
        const time = new Date(u.punchIn.time)
        const hours = time.getHours()
        const minutes = time.getMinutes()
        const totalMins = hours * 60 + minutes
        const target = 9 * 60
        let status
        if (totalMins <= target + 10) status = 'ontime'
        else if (totalMins <= target + 45) status = 'yellow'
        else if (totalMins <= target + 60) status = 'lightred'
        else status = 'red'
        return status === lateStatusFilter
      })
    }

    return filtered
  }, [employees, query, departmentFilter, lateStatusFilter])

  const formatTime = (d) => {
    if (!d) return '--:--'
    try {
      return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '--:--'
    }
  }

  const formatLocation = (loc) => {
    if (!loc?.lat || !loc?.lng) return '—'
    const coords = `${Number(loc.lat).toFixed(6)}, ${Number(loc.lng).toFixed(6)}`
    const acc = typeof loc.accuracy === 'number' ? ` (±${Math.round(loc.accuracy)}m)` : ''
    return loc.address ? `${loc.address}${acc}` : `${coords}${acc}`
  }

  const openInGoogleMaps = (lat, lng) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-pink-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <p className="text-gray-500">Loading HR Panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-xl px-5 md:px-8 py-4 flex items-center justify-between border-b border-white/10">
        <div>
          <h1 className="text-lg font-bold text-white">HR Panel</h1>
          <p className="text-white/50 text-xs">Human Resources Control Center</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/user-management')}
            className="text-[11px] text-white bg-pink-500 hover:bg-pink-600 px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Manage Users
          </button>
          <button
            onClick={() => navigate('/leave-management')}
            className="text-[11px] text-white bg-amber-500 hover:bg-amber-600 px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Leaves
          </button>
          <button
            onClick={() => navigate('/wfh-management')}
            className="text-[11px] text-white bg-sky-500 hover:bg-sky-600 px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            WFH
          </button>
          <button
            onClick={() => navigate('/my-team')}
            className="text-[11px] text-white/70 hover:text-white bg-blue-500/30 hover:bg-blue-500/50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Team View
          </button>
          <button
            onClick={fetchData}
            className="text-[11px] text-white/70 hover:text-white bg-white/10 px-2.5 py-1 rounded-lg"
          >
            Refresh
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-[11px] text-white/70 hover:text-white bg-white/10 px-2.5 py-1 rounded-lg"
          >
            My Dashboard
          </button>
          <button 
            onClick={handleLogout}
            className="text-[11px] text-white/70 hover:text-white bg-white/10 px-2.5 py-1 rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-3 md:px-6 md:py-4 grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2 md:gap-2">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight">Total Employees</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.totalEmployees || 0}</p>
        </motion.div>
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight">Online Now</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.onlineNow || 0}</p>
        </motion.div>
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight">Punched In</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.punchedIn || 0}</p>
        </motion.div>
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight">Punched Out</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.punchedOut || 0}</p>
        </motion.div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-rose-400 to-red-500 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight">Not Punched</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.notPunchedIn || 0}</p>
        </motion.div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-2.5 md:p-3 shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => setActiveTab('verification')}
        >
          <p className="text-white/70 text-[10px] leading-tight">Pending Verification</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.pendingVerification || 0}</p>
        </motion.div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight flex items-center gap-1">🟢 On Time</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.ontime || 0}</p>
        </motion.div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight flex items-center gap-1">🟡 Slight Late</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.yellow || 0}</p>
        </motion.div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight flex items-center gap-1">🟠 Late</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.lightred || 0}</p>
        </motion.div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-2.5 md:p-3 shadow-xl"
        >
          <p className="text-white/70 text-[10px] leading-tight flex items-center gap-1">🔴 Very Late</p>
          <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-tight">{stats?.red || 0}</p>
        </motion.div>
      </div>

      {/* Tab Switcher */}
      <div className="px-4 md:px-8 mb-3 flex gap-2">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
            activeTab === 'attendance' 
              ? 'bg-white text-slate-900' 
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Today's Attendance
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
            activeTab === 'leaves'
              ? 'bg-white text-slate-900'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Leaves Summary
        </button>
        <button
          onClick={() => setActiveTab('punch-permissions')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
            activeTab === 'punch-permissions'
              ? 'bg-white text-slate-900'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Punch Permission
        </button>
        <button
          onClick={() => setActiveTab('payslips')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
            activeTab === 'payslips'
              ? 'bg-white text-slate-900'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Payslip Management
        </button>
        <button
          onClick={() => setActiveTab('activations')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-2 ${
            activeTab === 'activations'
              ? 'bg-white text-slate-900'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Account Activation
          {pendingActivations.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingActivations.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
            activeTab === 'report'
              ? 'bg-white text-slate-900'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Attendance Report
        </button>
        <button
          onClick={() => setActiveTab('verification')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-2 ${
            activeTab === 'verification' 
              ? 'bg-white text-slate-900' 
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Profile Verification
          {verificationStats?.pending > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{verificationStats.pending}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('ot')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
            activeTab === 'ot'
              ? 'bg-white text-slate-900'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          OT Management
        </button>
      </div>

      {/* REPORT TAB */}
      {activeTab === 'report' && (
        <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4 md:pb-8">
          <div className="h-full overflow-auto bg-white/5 border border-white/10 rounded-2xl p-4">
            <AttendanceReport scope="hr" />
          </div>
        </div>
      )}

      {/* OT TAB */}
      {activeTab === 'ot' && (
        <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4 md:pb-8">
          <div className="h-full overflow-auto bg-white/5 border border-white/10 rounded-2xl p-4">
            <OvertimeManagement scope="hr" title="Company OT Requests" />
          </div>
        </div>
      )}

      {/* PUNCH PERMISSION TAB */}
      {activeTab === 'punch-permissions' && (
        <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4 md:pb-8">
          <div className="h-full overflow-auto bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white/80 text-sm font-semibold">Punch Permission Requests</h3>
                <button
                  onClick={fetchPunchPermissionRequests}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Refresh
                </button>
              </div>
              {permissionLoading ? (
                <p className="text-white/50 text-xs">Loading...</p>
              ) : permissionRequests.length === 0 ? (
                <p className="text-white/50 text-xs">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {permissionRequests.map((n) => (
                    <div key={n._id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-white/10 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-white text-sm font-semibold">{n?.data?.senderName || 'Employee'}</p>
                        <p className="text-white/60 text-xs">{n.message}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePermissionAction(n, true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                        >
                          Allow
                        </button>
                        <button
                          onClick={() => handlePermissionAction(n, false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYSLIP MANAGEMENT TAB */}
      {activeTab === 'payslips' && (
        <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4 md:pb-8">
          <div className="h-full overflow-auto bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <h3 className="text-white/80 text-sm font-semibold">Payslip Management</h3>
                <div className="flex gap-2 items-center">
                  <input
                    value={payslipQuery}
                    onChange={(e) => setPayslipQuery(e.target.value)}
                    placeholder="Search name / employeeId"
                    className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-xs text-white w-48"
                  />
                  <button
                    onClick={fetchPayslipUsers}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {payslipLoading ? (
                <p className="text-white/50 text-xs">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {payslipUsers
                    .filter(u => {
                      const q = payslipQuery.trim().toLowerCase()
                      if (!q) return true
                      return (u.name || '').toLowerCase().includes(q) || (u.employeeId || '').toLowerCase().includes(q)
                    })
                    .map((u) => (
                      <div key={u._id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-white/10 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-white text-sm font-semibold">{u.name}</p>
                          <p className="text-white/60 text-xs">{u.employeeId} • {u.department || 'No Department'}</p>
                          <p className="text-white/40 text-xs">{u.designation || 'No Designation'} • A/C: {u.accountNumber || '—'}</p>
                          <p className="text-white/40 text-xs">Status: {u.payslipSettings?.mode || 'locked'} • Last Approved: {getLatestApprovedMonth(u.payslipApprovals)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPayslipEditingUser(u)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-200 hover:bg-blue-500/30"
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT ACTIVATION TAB */}
      {activeTab === 'activations' && (
        <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4 md:pb-8">
          <div className="h-full overflow-auto bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white/80 text-sm font-semibold">Pending Account Activations</h3>
                <button
                  onClick={fetchPendingActivations}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Refresh
                </button>
              </div>
              {activationsLoading ? (
                <p className="text-white/50 text-xs">Loading...</p>
              ) : pendingActivations.length === 0 ? (
                <p className="text-white/50 text-xs">No pending activations</p>
              ) : (
                <div className="space-y-2">
                  {pendingActivations.map((user) => (
                    <div key={user._id} className="flex flex-col gap-3 border border-white/10 rounded-xl px-3 py-2">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-white text-sm font-semibold">{user.name}</p>
                          <p className="text-white/60 text-xs">{user.email} • {user.employeeId}</p>
                          <p className="text-white/50 text-xs">{user.department || 'No Department'} • Registered {new Date(user.createdAt).toLocaleDateString()}</p>
                          <p className="text-white/60 text-xs mt-1">
                            Reports To: {user.reportsTo ? `${user.reportsTo.name} (${user.reportsTo.employeeId})` : 'Not Assigned'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(user)
                              setSelectedManager(user.reportsTo?._id || '')
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-200 hover:bg-blue-500/30"
                          >
                            Edit Manager
                          </button>
                          <button
                            onClick={() => handleDownloadPayslip(user._id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
                          >
                            Download Payslip
                          </button>
                          <button
                            onClick={() => handleActivateUser(user._id, true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => handleActivateUser(user._id, false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LEAVES TAB */}
      {activeTab === 'leaves' && (
        <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4 md:pb-8">
          <div className="h-full overflow-auto bg-white/5 border border-white/10 rounded-2xl p-4">
            <LeaveSummary />
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <>
          {/* Filters */}
          <div className="px-4 md:px-8 mb-3 flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search: name / employeeId / department / email"
                className="w-full bg-white/10 border border-white/10 text-white placeholder-white/30 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="all" className="bg-slate-800">All Departments</option>
              {uniqueDepartments.map(dept => (
                <option key={dept} value={dept} className="bg-slate-800">{dept}</option>
              ))}
            </select>
            <select
              value={lateStatusFilter}
              onChange={(e) => setLateStatusFilter(e.target.value)}
              className="bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="all" className="bg-slate-800">All Late Status</option>
              <option value="ontime" className="bg-slate-800">🟢 On Time</option>
              <option value="yellow" className="bg-slate-800">🟡 Slight Late</option>
              <option value="lightred" className="bg-slate-800">🟠 Late</option>
              <option value="red" className="bg-slate-800">🔴 Very Late</option>
              <option value="nopunch" className="bg-slate-800">No Punch In</option>
            </select>
          </div>

          {/* Spreadsheet/Table */}
          <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4 md:pb-8">
            <div className="h-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-white/70 text-xs uppercase font-medium">Attendance (Excel View) • {attendanceDate}</h3>
                <p className="text-white/30 text-xs">Rows: {filteredEmployees.length}</p>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="min-w-[1500px] w-full text-xs">
                  <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-white/10">
                    <tr>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Name</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Employee ID</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Department</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Role</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Status</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Selfie</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Punch In</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Late Status</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Punch Out</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Punch In Location</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Punch Out Location</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Maps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-10 text-center text-white/40">
                          No employees found
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((u, idx) => {
                        const punchInLoc = u.punchIn?.location
                        const punchOutLoc = u.punchOut?.location
                        const punchInSelfie = u.punchIn?.selfie
                        const punchOutSelfie = u.punchOut?.selfie
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
                        const lateStatus = getLateStatus(u.punchIn?.time)
                        return (
                          <tr
                            key={u._id}
                            className={
                              idx % 2 === 0
                                ? 'bg-white/[0.02] border-b border-white/5'
                                : 'bg-transparent border-b border-white/5'
                            }
                          >
                            <td className="px-2.5 py-1.5 text-white/90 font-medium whitespace-nowrap">{u.name || u.email?.split('@')[0]}</td>
                            <td className="px-2.5 py-1.5 text-white/70 whitespace-nowrap">{u.employeeId || '—'}</td>
                            <td className="px-2.5 py-1.5 text-white/70 whitespace-nowrap">{u.department || '—'}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                u.role === 'ceo' ? 'bg-amber-500 text-white' :
                                u.role === 'hr' ? 'bg-pink-500 text-white' :
                                u.role === 'manager' ? 'bg-blue-500 text-white' :
                                'bg-slate-500 text-white'
                              }`}>
                                {(u.role || 'Employee').charAt(0).toUpperCase() + (u.role || 'employee').slice(1)}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              {u.isOnline ? (
                                <span className="inline-flex items-center gap-2 text-emerald-400">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                  </span>
                                  Online
                                </span>
                              ) : (
                                <span className="text-white/30">Offline</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <div className="flex gap-1">
                                {punchInSelfie && (
                                  <button
                                    onClick={() => window.open(punchInSelfie, '_blank')}
                                    className="w-8 h-8 rounded-full overflow-hidden border border-emerald-500/30 hover:border-emerald-400 transition-all"
                                    title="View Punch In Selfie"
                                  >
                                    <img src={punchInSelfie} alt="In" className="w-full h-full object-cover" />
                                  </button>
                                )}
                                {punchOutSelfie && (
                                  <button
                                    onClick={() => window.open(punchOutSelfie, '_blank')}
                                    className="w-8 h-8 rounded-full overflow-hidden border border-rose-500/30 hover:border-rose-400 transition-all"
                                    title="View Punch Out Selfie"
                                  >
                                    <img src={punchOutSelfie} alt="Out" className="w-full h-full object-cover" />
                                  </button>
                                )}
                                {!punchInSelfie && !punchOutSelfie && (
                                  <span className="text-white/20 text-xs">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 text-emerald-300 font-semibold whitespace-nowrap">{formatTime(u.punchIn?.time)}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              {lateStatus ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  lateStatus === 'ontime' ? 'bg-emerald-500/20 text-emerald-200' :
                                  lateStatus === 'yellow' ? 'bg-amber-500/20 text-amber-200' :
                                  lateStatus === 'lightred' ? 'bg-orange-500/20 text-orange-200' :
                                  'bg-red-500/20 text-red-200'
                                }`}>
                                  {lateStatus === 'ontime' ? '🟢 On Time' :
                                   lateStatus === 'yellow' ? '🟡 Slight Late' :
                                   lateStatus === 'lightred' ? '🟠 Late' : '🔴 Very Late'}
                                </span>
                              ) : (
                                <span className="text-white/30">—</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 text-rose-300 font-semibold whitespace-nowrap">{formatTime(u.punchOut?.time)}</td>
                            <td className="px-2.5 py-1.5 text-white/70 max-w-[350px]">
                              <span title={formatLocation(punchInLoc)} className="block truncate">{formatLocation(punchInLoc)}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-white/70 max-w-[350px]">
                              <span title={formatLocation(punchOutLoc)} className="block truncate">{formatLocation(punchOutLoc)}</span>
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                {punchInLoc?.lat ? (
                                  <button
                                    onClick={() => openInGoogleMaps(punchInLoc.lat, punchInLoc.lng)}
                                    className="text-blue-300 hover:text-blue-200 underline underline-offset-2"
                                  >
                                    In
                                  </button>
                                ) : (
                                  <span className="text-white/20">In</span>
                                )}
                                {punchOutLoc?.lat ? (
                                  <button
                                    onClick={() => openInGoogleMaps(punchOutLoc.lat, punchOutLoc.lng)}
                                    className="text-blue-300 hover:text-blue-200 underline underline-offset-2"
                                  >
                                    Out
                                  </button>
                                ) : (
                                  <span className="text-white/20">Out</span>
                                )}
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
          </div>
        </>
      )}

      {/* VERIFICATION TAB */}
      {activeTab === 'verification' && (
        <>
          {/* Verification Filter Buttons */}
          <div className="px-4 md:px-8 mb-3 flex gap-2 flex-wrap">
            {[
              { key: 'pending', label: 'Pending', color: 'amber' },
              { key: 'approved', label: 'Approved', color: 'emerald' },
              { key: 'rejected', label: 'Rejected', color: 'red' },
              { key: 'draft', label: 'Draft', color: 'gray' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setVerificationFilter(item.key)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-2 ${
                  verificationFilter === item.key 
                    ? item.key === 'pending' ? 'bg-amber-500 text-white' 
                      : item.key === 'approved' ? 'bg-emerald-500 text-white'
                      : item.key === 'rejected' ? 'bg-red-500 text-white'
                      : 'bg-gray-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {item.label}
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  verificationFilter === item.key ? 'bg-white/20' : 'bg-white/10'
                }`}>
                  {verificationStats?.[item.key] || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Verification Table */}
          <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4 md:pb-8">
            <div className="h-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-white/70 text-xs uppercase font-medium">
                  {verificationFilter === 'pending' && 'Profiles Pending Verification'}
                  {verificationFilter === 'approved' && 'Verified Employees'}
                  {verificationFilter === 'rejected' && 'Rejected Profiles'}
                  {verificationFilter === 'draft' && 'Draft Profiles (Not Submitted)'}
                </h3>
                <p className="text-white/30 text-xs">Rows: {pendingProfiles.length}</p>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="min-w-[1200px] w-full text-xs">
                  <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-white/10">
                    <tr>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Employee</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Email</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Employee ID</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Role</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Department</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Aadhar</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">PAN</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Submitted At</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Status</th>
                      <th className="text-left text-white/60 font-semibold text-[11px] uppercase tracking-wider px-2.5 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingProfiles.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <svg className="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="text-white/40">
                              {verificationFilter === 'pending' && 'No profiles pending verification'}
                              {verificationFilter === 'approved' && 'No approved profiles yet'}
                              {verificationFilter === 'rejected' && 'No rejected profiles'}
                              {verificationFilter === 'draft' && 'No employees have started profile setup'}
                            </p>
                            <p className="text-white/20 text-xs max-w-md">
                              {verificationFilter === 'pending' && 'When employees submit their profile for verification, they will appear here'}
                              {verificationFilter === 'draft' && 'Employees who have registered but not submitted profiles are shown here'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pendingProfiles.map((profile, idx) => (
                        <tr
                          key={profile._id}
                          className={`${idx % 2 === 0 ? 'bg-white/[0.02]' : ''} border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors`}
                          onClick={() => fetchProfileDetails(profile._id)}
                        >
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                {profile.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="text-white/90 font-medium">{profile.name || 'Unknown'}</p>
                                {profile.isVerifiedEmployee && (
                                  <span className="text-[10px] text-blue-400">Verified</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2.5 py-1.5 text-white/70 whitespace-nowrap">{profile.email}</td>
                          <td className="px-2.5 py-1.5 text-white/70 whitespace-nowrap">{profile.employeeId || '—'}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              profile.role === 'ceo' ? 'bg-amber-500 text-white' :
                              profile.role === 'hr' ? 'bg-pink-500 text-white' :
                              profile.role === 'manager' ? 'bg-blue-500 text-white' :
                              'bg-slate-500 text-white'
                            }`}>
                              {(profile.role || 'Employee').charAt(0).toUpperCase() + (profile.role || 'employee').slice(1)}
                            </span>
                            {(profile.role === 'hr' || profile.role === 'ceo') && currentUserRole !== 'admin' && (
                              <span className="ml-1 text-[10px] text-amber-400">(Admin only)</span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-white/70 whitespace-nowrap">{profile.department || '—'}</td>
                          <td className="px-2.5 py-1.5 text-white/70 whitespace-nowrap font-mono">
                            {profile.aadharNumber ? `XXXX-XXXX-${profile.aadharNumber.slice(-4)}` : '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-white/70 whitespace-nowrap font-mono">
                            {profile.panNumber ? `XXXXX${profile.panNumber.slice(-5)}` : '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-white/70 whitespace-nowrap">
                            {profile.profileSubmittedAt 
                              ? new Date(profile.profileSubmittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              profile.profileStatus === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              profile.profileStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              profile.profileStatus === 'rejected' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                              'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                            }`}>
                              {profile.profileStatus || 'draft'}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            <button
                              onClick={(e) => { e.stopPropagation(); fetchProfileDetails(profile._id); }}
                              className="bg-white text-slate-900 px-2.5 py-1 rounded-lg text-[11px] font-semibold hover:bg-white/90 transition-colors"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Profile Details Modal */}
      <AnimatePresence>
        {selectedProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProfile(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {profileLoading ? (
                <div className="p-12 text-center">
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="bg-black/50 px-6 py-4 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                        {selectedProfile.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-white font-bold text-lg">{selectedProfile.name}</h2>
                          {selectedProfile.isVerifiedEmployee && (
                            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                            </svg>
                          )}
                        </div>
                        <p className="text-white/50 text-sm">{selectedProfile.email} • {selectedProfile.employeeId}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProfile(null)}
                      className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  {/* Profile Content */}
                  <div className="p-6 max-h-[60vh] overflow-auto">
                    <div className="grid grid-cols-3 gap-6">
                      {/* Personal Info */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          Personal Info
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-white/50">DOB</span><span className="text-white">{selectedProfile.dateOfBirth ? new Date(selectedProfile.dateOfBirth).toLocaleDateString('en-IN') : '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">Gender</span><span className="text-white capitalize">{selectedProfile.gender || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">Blood</span><span className="text-white">{selectedProfile.bloodGroup || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">Phone</span><span className="text-white">{selectedProfile.phone || '—'}</span></div>
                        </div>
                      </div>

                      {/* Address */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                          Address
                        </h3>
                        <p className="text-white text-sm">{selectedProfile.currentAddress || 'No address'}</p>
                        <p className="text-white/50 text-xs mt-1">{[selectedProfile.city, selectedProfile.state, selectedProfile.pincode].filter(Boolean).join(', ')}</p>
                      </div>

                      {/* Documents */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Documents
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-white/50">Aadhar</span><span className="text-white font-mono">{selectedProfile.aadharNumber || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">PAN</span><span className="text-white font-mono">{selectedProfile.panNumber || '—'}</span></div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {selectedProfile.aadharFrontUrl && (
                            <button type="button" onClick={() => openDocPreview(selectedProfile.aadharFrontUrl)} className="text-blue-400 text-xs underline">Aadhar Front</button>
                          )}
                          {selectedProfile.aadharBackUrl && (
                            <button type="button" onClick={() => openDocPreview(selectedProfile.aadharBackUrl)} className="text-blue-400 text-xs underline">Aadhar Back</button>
                          )}
                          {selectedProfile.panCardUrl && (
                            <button type="button" onClick={() => openDocPreview(selectedProfile.panCardUrl)} className="text-blue-400 text-xs underline">PAN Card</button>
                          )}
                        </div>
                      </div>

                      {/* Bank Details */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                          Bank Details
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-white/50">Bank</span><span className="text-white">{selectedProfile.bankName || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">A/C No</span><span className="text-white font-mono">{selectedProfile.accountNumber || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">IFSC</span><span className="text-white font-mono">{selectedProfile.ifscCode || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">UAN</span><span className="text-white font-mono">{selectedProfile.uanNumber || '—'}</span></div>
                        </div>
                      </div>

                      {/* Emergency Contact */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                          Emergency Contact
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-white/50">Name</span><span className="text-white">{selectedProfile.emergencyContact?.name || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">Relation</span><span className="text-white capitalize">{selectedProfile.emergencyContact?.relationship || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">Phone</span><span className="text-white">{selectedProfile.emergencyContact?.phone || '—'}</span></div>
                        </div>
                      </div>

                      {/* Education (if present) */}
                      {selectedProfile.education?.length > 0 && (
                        <div className="bg-white/5 rounded-xl p-4">
                          <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                            Education (Optional)
                          </h3>
                          {selectedProfile.education.map((edu, i) => (
                            <div key={i} className="text-sm mb-2 last:mb-0">
                              <p className="text-white">{edu.degree}</p>
                              <p className="text-white/50 text-xs">{edu.institution} • {edu.yearOfPassing}{edu.percentage ? ` • ${edu.percentage}%` : ''}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Experience (if present) */}
                      {selectedProfile.experience?.length > 0 && (
                        <div className="bg-white/5 rounded-xl p-4">
                          <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            Experience (Optional)
                          </h3>
                          {selectedProfile.experience.map((exp, i) => (
                            <div key={i} className="text-sm mb-2 last:mb-0">
                              <p className="text-white">{exp.designation} at {exp.company}</p>
                              <p className="text-white/50 text-xs">
                                {exp.fromDate ? new Date(exp.fromDate).getFullYear() : ''} - {exp.toDate ? new Date(exp.toDate).getFullYear() : 'Present'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {selectedProfile.profileStatus === 'pending' && (
                    <div className="px-6 py-4 border-t border-white/10">
                      {/* Check if HR can approve this profile */}
                      {(selectedProfile.role === 'hr' || selectedProfile.role === 'ceo') && currentUserRole !== 'admin' ? (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                          <svg className="w-10 h-10 text-amber-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          <p className="text-amber-300 font-medium">Only Admin can approve {selectedProfile.role?.toUpperCase()} profiles</p>
                          <p className="text-white/50 text-sm mt-1">This profile requires Admin-level verification</p>
                        </div>
                      ) : (
                        <div className="flex gap-4">
                          <button
                            onClick={() => setShowRejectModal(true)}
                            disabled={actionLoading}
                            className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-xl transition-all border border-red-500/30 disabled:opacity-50"
                          >
                            Reject Profile
                          </button>
                          <button
                            onClick={() => handleApprove(selectedProfile._id)}
                            disabled={actionLoading}
                            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionLoading ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Approve & Verify
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Unlock Button for Approved Profiles */}
                  {selectedProfile.profileStatus === 'approved' && (
                    <div className="px-6 py-4 border-t border-white/10">
                      {(selectedProfile.role === 'hr' || selectedProfile.role === 'ceo') && currentUserRole !== 'admin' ? (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                          <svg className="w-10 h-10 text-amber-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          <p className="text-amber-300 font-medium">Only Admin can unlock {selectedProfile.role?.toUpperCase()} profiles</p>
                        </div>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-emerald-300 font-semibold">Verified Profile</p>
                              <p className="text-white/50 text-xs">Unlock to allow employee to make changes</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnlock(selectedProfile._id)}
                            disabled={actionLoading}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionLoading ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                Unlock Profile for Editing
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md"
            >
              <h3 className="text-white font-bold text-lg mb-2">Reject Profile</h3>
              <p className="text-white/50 text-sm mb-4">Provide a reason for rejection (will be shown to employee)</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none h-28"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                  className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(selectedProfile._id)}
                  disabled={!rejectionReason.trim() || actionLoading}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Manager Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => { setEditingUser(null); setSelectedManager(''); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md"
            >
              <h3 className="text-white text-lg font-bold mb-2">Edit Manager Assignment</h3>
              <p className="text-white/70 text-sm mb-1">Employee: {editingUser.name}</p>
              <p className="text-white/50 text-xs mb-4">{editingUser.email} • {editingUser.employeeId}</p>
              
              <label className="text-white/70 text-sm font-medium mb-2 block">Select Manager (Only Managers)</label>
              {currentUserRole === 'hr' && (
                <p className="text-[11px] text-white/40 mb-2">Only admins can change manager assignment.</p>
              )}
              <select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                disabled={currentUserRole === 'hr'}
                className={`w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-4 ${
                  currentUserRole === 'hr' ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <option value="">Select a manager...</option>
                {managers.map((mgr) => (
                  <option key={mgr._id} value={mgr._id}>
                    {mgr.name} ({mgr.employeeId}) - {mgr.department || 'N/A'}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between mb-2">
                <label className="text-white/70 text-sm font-medium">Salary Structure (Monthly)</label>
                <button
                  type="button"
                  onClick={() => setSalaryForm(buildDefaultSalary(salaryForm.ctcAnnual || 600000))}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Auto Fill from CTC
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-white/50 text-xs">CTC Annual</label>
                  <input
                    type="number"
                    value={salaryForm.ctcAnnual}
                    onChange={(e) => setSalaryForm({ ...salaryForm, ctcAnnual: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Basic Salary</label>
                  <input
                    type="number"
                    value={salaryForm.basisSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, basisSalary: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">HRA</label>
                  <input
                    type="number"
                    value={salaryForm.houseRentAllowance}
                    onChange={(e) => setSalaryForm({ ...salaryForm, houseRentAllowance: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Medical Allowance</label>
                  <input
                    type="number"
                    value={salaryForm.medicalAllowance}
                    onChange={(e) => setSalaryForm({ ...salaryForm, medicalAllowance: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Education Allowance</label>
                  <input
                    type="number"
                    value={salaryForm.educationAllowance}
                    onChange={(e) => setSalaryForm({ ...salaryForm, educationAllowance: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Other Allowance</label>
                  <input
                    type="number"
                    value={salaryForm.otherAllowance}
                    onChange={(e) => setSalaryForm({ ...salaryForm, otherAllowance: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">EPF</label>
                  <input
                    type="number"
                    value={salaryForm.epf}
                    onChange={(e) => setSalaryForm({ ...salaryForm, epf: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">ESIC</label>
                  <input
                    type="number"
                    value={salaryForm.esic}
                    onChange={(e) => setSalaryForm({ ...salaryForm, esic: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">TDS</label>
                  <input
                    type="number"
                    value={salaryForm.tds}
                    onChange={(e) => setSalaryForm({ ...salaryForm, tds: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Other Deductions</label>
                  <input
                    type="number"
                    value={salaryForm.otherDeductions}
                    onChange={(e) => setSalaryForm({ ...salaryForm, otherDeductions: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                <div>
                  <label className="text-white/50 text-xs">Total Earnings (Override)</label>
                  <input
                    type="number"
                    value={salaryForm.totalEarningsOverride ?? ''}
                    onChange={(e) => setSalaryForm({
                      ...salaryForm,
                      totalEarningsOverride: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    onFocus={() => setSalaryOverridesTouched(true)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Total Deductions (Override)</label>
                  <input
                    type="number"
                    value={salaryForm.totalDeductionsOverride ?? ''}
                    onChange={(e) => setSalaryForm({
                      ...salaryForm,
                      totalDeductionsOverride: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    onFocus={() => setSalaryOverridesTouched(true)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Net Pay (Override)</label>
                  <input
                    type="number"
                    value={salaryForm.netPayOverride ?? ''}
                    onChange={(e) => setSalaryForm({
                      ...salaryForm,
                      netPayOverride: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    onFocus={() => setSalaryOverridesTouched(true)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
              </div>
              <div className="text-xs text-white/50 mb-4">
                Auto Totals: Earnings {salaryTotals.totalEarnings.toLocaleString('en-IN')} • Deductions {salaryTotals.totalDeductions.toLocaleString('en-IN')} • Net Pay {salaryTotals.netPay.toLocaleString('en-IN')}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditingUser(null); setSelectedManager(''); }}
                  className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleActivateUser(editingUser._id, true, selectedManager || editingUser.reportsTo?._id, salaryForm)}
                  disabled={!selectedManager}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save & Activate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payslip Management Modal */}
      <AnimatePresence>
        {payslipEditingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setPayslipEditingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-4 w-full max-w-xl max-h-[80vh] overflow-y-auto"
            >
              <h3 className="text-white text-lg font-bold mb-1">Payslip Management</h3>
              <p className="text-white/60 text-xs mb-4">{payslipEditingUser.name} • {payslipEditingUser.employeeId}</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-white/50 text-xs">Designation</label>
                  <input
                    value={payslipProfileForm.designation}
                    onChange={(e) => setPayslipProfileForm({ ...payslipProfileForm, designation: e.target.value })}
                    disabled={currentUserRole === 'hr'}
                    className={`w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm ${
                      currentUserRole === 'hr' ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                  {currentUserRole === 'hr' && (
                    <p className="text-[11px] text-white/40 mt-1">Only admins can change designation.</p>
                  )}
                </div>
                <div>
                  <label className="text-white/50 text-xs">Bank Name</label>
                  <input
                    value={payslipProfileForm.bankName}
                    onChange={(e) => setPayslipProfileForm({ ...payslipProfileForm, bankName: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Account Number</label>
                  <input
                    value={payslipProfileForm.accountNumber}
                    onChange={(e) => setPayslipProfileForm({ ...payslipProfileForm, accountNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">PF A/C No</label>
                  <input
                    value={payslipProfileForm.pfAccountNumber}
                    onChange={(e) => setPayslipProfileForm({ ...payslipProfileForm, pfAccountNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">UAN No</label>
                  <input
                    value={payslipProfileForm.uanNumber}
                    onChange={(e) => setPayslipProfileForm({ ...payslipProfileForm, uanNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">ESIC No</label>
                  <input
                    value={payslipProfileForm.esiNumber}
                    onChange={(e) => setPayslipProfileForm({ ...payslipProfileForm, esiNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">PAN</label>
                  <input
                    value={payslipProfileForm.panNumber}
                    onChange={(e) => setPayslipProfileForm({ ...payslipProfileForm, panNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Location</label>
                  <input
                    value={payslipProfileForm.workLocation}
                    onChange={(e) => setPayslipProfileForm({ ...payslipProfileForm, workLocation: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 items-center mb-4">
                <select
                  value={payslipSettingsForm.mode}
                  onChange={(e) => setPayslipSettingsForm({ ...payslipSettingsForm, mode: e.target.value })}
                  className="bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm w-full md:w-40"
                >
                  <option value="locked" className="bg-slate-800">Locked</option>
                  <option value="unlocked" className="bg-slate-800">Unlocked</option>
                </select>
                <input
                  type="number"
                  value={payslipSettingsForm.delayMonths}
                  onChange={(e) => setPayslipSettingsForm({ ...payslipSettingsForm, delayMonths: Number(e.target.value || 0) })}
                  placeholder="Delay Months"
                  className="bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm w-full md:w-36"
                />
                <button
                  onClick={handleSavePayslipSettings}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
                >
                  Save Lock/Unlock
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-3 items-center mb-4">
                <input
                  value={payslipApprovalMonth}
                  onChange={(e) => setPayslipApprovalMonth(e.target.value)}
                  placeholder="Approve Month (YYYY-MM)"
                  className="bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm w-full md:w-48"
                />
                <select
                  value={payslipApprovalApproved ? 'approved' : 'unapproved'}
                  onChange={(e) => setPayslipApprovalApproved(e.target.value === 'approved')}
                  className="bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm w-full md:w-40"
                >
                  <option value="approved" className="bg-slate-800">Salary Paid</option>
                  <option value="unapproved" className="bg-slate-800">Not Paid</option>
                </select>
                <button
                  onClick={handlePayslipApproval}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                >
                  Save Salary Status
                </button>
              </div>

              <div className="flex items-center justify-between mb-2">
                <label className="text-white/70 text-sm font-medium">Salary Structure (Monthly)</label>
                <button
                  type="button"
                  onClick={() => setPayslipSalaryForm(buildDefaultSalary(payslipSalaryForm.ctcAnnual || 600000))}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Auto Fill from CTC
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-white/50 text-xs">CTC (Annual)</label>
                  <input
                    type="number"
                    value={payslipSalaryForm.ctcAnnual}
                    onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, ctcAnnual: Number(e.target.value || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <p className="text-white/70 text-xs font-semibold mb-2">Earnings</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-white/50 text-xs">Basic Salary</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.basisSalary}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, basisSalary: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs">House Rent Allowance</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.houseRentAllowance}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, houseRentAllowance: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs">Education Allowance</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.educationAllowance}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, educationAllowance: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs">Medical Allowance</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.medicalAllowance}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, medicalAllowance: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs">Other Allowance</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.otherAllowance}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, otherAllowance: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <p className="text-white/70 text-xs font-semibold mb-2">Deductions</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-white/50 text-xs">EPF</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.epf}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, epf: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs">ESIC</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.esic}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, esic: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs">TDS</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.tds}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, tds: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs">Other Deductions</label>
                      <input
                        type="number"
                        value={payslipSalaryForm.otherDeductions}
                        onChange={(e) => setPayslipSalaryForm({ ...payslipSalaryForm, otherDeductions: Number(e.target.value || 0) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                <div>
                  <label className="text-white/50 text-xs">Total Earnings (Override)</label>
                  <input
                    type="number"
                    value={payslipSalaryForm.totalEarningsOverride ?? ''}
                    onChange={(e) => setPayslipSalaryForm({
                      ...payslipSalaryForm,
                      totalEarningsOverride: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    onFocus={() => setPayslipOverridesTouched(true)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Total Deductions (Override)</label>
                  <input
                    type="number"
                    value={payslipSalaryForm.totalDeductionsOverride ?? ''}
                    onChange={(e) => setPayslipSalaryForm({
                      ...payslipSalaryForm,
                      totalDeductionsOverride: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    onFocus={() => setPayslipOverridesTouched(true)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs">Net Pay (Override)</label>
                  <input
                    type="number"
                    value={payslipSalaryForm.netPayOverride ?? ''}
                    onChange={(e) => setPayslipSalaryForm({
                      ...payslipSalaryForm,
                      netPayOverride: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    onFocus={() => setPayslipOverridesTouched(true)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm"
                  />
                </div>
              </div>
              <div className="text-xs text-white/50 mb-4">
                Auto Totals: Earnings {payslipTotals.totalEarnings.toLocaleString('en-IN')} • Deductions {payslipTotals.totalDeductions.toLocaleString('en-IN')} • Net Pay {payslipTotals.netPay.toLocaleString('en-IN')}
              </div>

              <div className="flex flex-col md:flex-row gap-3 items-center mb-4">
                <input
                  value={payslipMonth}
                  onChange={(e) => setPayslipMonth(e.target.value)}
                  placeholder="YYYY-MM"
                  className="bg-white/5 border border-white/10 rounded-xl p-2 text-white text-sm w-full md:w-40"
                />
                <button
                  onClick={handlePayslipDownloadForUser}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                >
                  Download Payslip
                </button>
              </div>

              <div className="flex gap-3 sticky bottom-0 bg-gradient-to-br from-slate-800 to-slate-900 pt-3">
                <button
                  onClick={() => setPayslipEditingUser(null)}
                  className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleSavePayslipProfile}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm"
                >
                  Save Profile
                </button>
                <button
                  onClick={handleSavePayslipSalary}
                  className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl text-sm"
                >
                  Save Salary
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default HRDashboard
