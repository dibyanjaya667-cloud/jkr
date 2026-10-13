import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'
import logo from '../components/logo.png'

function Register({ setToken, setUser }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    employeeId: '',
    reportsTo: '',
    department: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [stage, setStage] = useState('form')
  const [otp, setOtp] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpSentMsg, setOtpSentMsg] = useState('')
  const [managers, setManagers] = useState([])
  const [managersLoading, setManagersLoading] = useState(false)
  const [managersError, setManagersError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchManagers()
  }, [])

  const fetchManagers = async () => {
    setManagersError('')
    setManagersLoading(true)
    try {
      const response = await axios.get(`${API_URL}/public/managers`)
      setManagers(response.data)
    } catch (error) {
      console.error('Error fetching managers:', error)
      setManagers([])
      setManagersError('Unable to load managers. Please try again.')
    } finally {
      setManagersLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const getPasswordStrength = (pwd) => {
    let score = 0
    if (pwd.length >= 8) score += 1
    if (/[a-z]/.test(pwd)) score += 1
    if (/[A-Z]/.test(pwd)) score += 1
    if (/\d/.test(pwd)) score += 1
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1

    const label = score >= 4 ? 'Strong' : score >= 3 ? 'Medium' : 'Weak'
    const color = score >= 4 ? 'bg-emerald-500' : score >= 3 ? 'bg-amber-500' : 'bg-red-500'
    return { score, label, color }
  }

  const passwordStrength = getPasswordStrength(formData.password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8 || passwordStrength.score < 4) {
      setError('Password must be strong (8+ chars with upper, lower, number, special)')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        employeeId: formData.employeeId,
        reportsTo: formData.reportsTo,
        department: formData.department
      })

      const otpSent = response?.data?.otpSent !== false
      const message = response?.data?.message || (otpSent
        ? 'OTP sent to your email. Please verify to continue.'
        : 'Registration successful. OTP could not be sent. Please use Resend OTP.')

      setError('')
      setOtpError('')
      setOtpSentMsg(message)
      setStage('verify')
    } catch (error) {
      setError(error.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setOtpError('')
    if (!otp.trim()) {
      setOtpError('Please enter OTP')
      return
    }

    setOtpLoading(true)
    try {
      await axios.post(`${API_URL}/auth/verify-email`, {
        email: formData.email,
        otp: otp.trim()
      })
      alert('Email verified. Your account is pending HR activation.')
      navigate('/login')
    } catch (error) {
      setOtpError(error.response?.data?.message || 'OTP verification failed')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setOtpError('')
    setOtpSentMsg('')
    setOtpLoading(true)
    try {
      const response = await axios.post(`${API_URL}/auth/resend-email-otp`, {
        email: formData.email
      })
      const otpSent = response?.data?.otpSent !== false
      const message = response?.data?.message || (otpSent
        ? 'New OTP sent to your email.'
        : 'OTP saved. Email failed, try again later.')

      if (otpSent) {
        setOtpSentMsg(message)
      } else {
        setOtpError(message)
      }
    } catch (error) {
      setOtpError(error.response?.data?.message || 'Failed to resend OTP')
    } finally {
      setOtpLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-4 pb-2 px-4 text-center"
      >
        <div className="w-20 h-20 rounded-3xl mx-auto mb-3 flex items-center justify-center bg-white">
          <img src={logo} alt="HRMS Logo" className="w-16 h-16 object-contain" />
        </div>
        <h1 className="text-xl font-bold text-black">Create Account</h1>
        <p className="text-gray-500 mt-0.5 text-xs">Join HRMS today</p>
      </motion.div>

      {/* Main Content */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex-1 px-4 pb-3"
      >
        {error && stage === 'form' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-3 rounded-xl mb-4 text-sm"
          >
            {error}
          </motion.div>
        )}

        {stage === 'verify' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-3 rounded-xl mb-4 text-sm"
          >
            {otpSentMsg || `OTP sent to ${formData.email}`}
          </motion.div>
        )}

        {otpError && stage === 'verify' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm"
          >
            {otpError}
          </motion.div>
        )}

        {stage === 'verify' ? (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <div>
              <label className="text-gray-600 text-sm font-medium ml-1">Email</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-black placeholder-gray-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-600 text-sm font-medium ml-1">Email OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              />
            </div>
            <motion.button 
              type="submit"
              disabled={otpLoading}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-black text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900 transition-all mt-2"
            >
              {otpLoading ? 'Verifying...' : 'Verify Email'}
            </motion.button>
            <button
              type="button"
              onClick={handleResendOtp}
              className="w-full text-sm font-semibold text-black underline"
              disabled={otpLoading}
            >
              Resend OTP
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-gray-600 text-xs font-medium ml-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Your full name"
                className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              />
            </div>

            <div>
              <label className="text-gray-600 text-xs font-medium ml-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              />
            </div>

            <div>
              <label className="text-gray-600 text-xs font-medium ml-1">Employee ID</label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                required
                placeholder="EMP001"
                className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              />
            </div>

            <div>
              <label className="text-gray-600 text-xs font-medium ml-1">Department</label>
              <div className="relative">
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23000'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1rem'
                  }}
                >
                  <option value="">Select department…</option>
                  <option value="MANAGEMENT">MANAGEMENT</option>
                  <option value="ADMINISTRATION & HR">ADMINISTRATION & HR</option>
                  <option value="LEGAL">LEGAL</option>
                  <option value="ACCOUNTS">ACCOUNTS</option>
                  <option value="BUSINESS DEVELOPMENT">BUSINESS DEVELOPMENT</option>
                  <option value="BIM">BIM</option>
                  <option value="DESIGN">DESIGN</option>
                  <option value="GIS">GIS</option>
                  <option value="PMC">PMC</option>
                  <option value="TRAINING & DEVELOPMENT">TRAINING & DEVELOPMENT</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-gray-600 text-xs font-medium ml-1">Select Manager</label>
            <div className="relative">
              <select
                name="reportsTo"
                value={formData.reportsTo}
                onChange={handleChange}
                required
                disabled={managersLoading || !!managersError}
                className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23000'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem'
                }}
              >
                <option value="">{managersLoading ? 'Loading managers…' : 'Choose manager…'}</option>
                {managers.map((manager) => (
                  <option key={manager._id} value={manager._id}>
                    {(manager.name || manager.email?.split('@')[0])}{manager.role ? ` (${String(manager.role).toUpperCase()})` : ''}{manager.department ? ` - ${manager.department}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {managersError && (
              <div className="flex items-center justify-between gap-3 mt-1 ml-1">
                <p className="text-xs text-red-600">{managersError}</p>
                <button
                  type="button"
                  onClick={fetchManagers}
                  className="text-xs font-semibold text-black underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-gray-600 text-xs font-medium ml-1">Password</label>
              <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Min 8 characters"
                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 pr-10 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7 1.13-2.58 3.2-4.69 5.73-5.83M9.88 9.88a3 3 0 104.24 4.24M6.1 6.1L3 3m18 18l-3.1-3.1" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
            </div>
            <div className="mt-2">
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${passwordStrength.color}`}
                  style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Password strength: <span className="font-semibold text-gray-700">{passwordStrength.label}</span></p>
            </div>
            </div>

            <div>
              <label className="text-gray-600 text-xs font-medium ml-1">Confirm Password</label>
              <div className="relative mt-1">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm password"
                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 pr-10 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7 1.13-2.58 3.2-4.69 5.73-5.83M9.88 9.88a3 3 0 104.24 4.24M6.1 6.1L3 3m18 18l-3.1-3.1" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
            </div>
            </div>
          </div>

          <motion.button 
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-black text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900 transition-all mt-1"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Creating...
              </span>
            ) : 'Create Account'}
          </motion.button>
          <div className="text-center pt-1">
            <p className="text-gray-500 text-xs">
              Already have an account?{' '}
              <Link to="/login" className="text-black font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </form>
        )}
      </motion.div>
    </div>
  )
}

export default Register
