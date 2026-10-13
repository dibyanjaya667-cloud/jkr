import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'
import logo from '../components/logo.png'

function Login({ setToken, setUser }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        ...formData,
      })
      localStorage.setItem('token', response.data.token)
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken)
      }
      localStorage.setItem('user', JSON.stringify(response.data.user))
      setToken(response.data.token)
      setUser?.(response.data.user)
      navigate(['admin', 'ceo'].includes(response.data?.user?.role) ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotMsg('')
    try {
      const res = await axios.post(`${API_URL}/auth/password-reset-request`, { email: forgotEmail })
      setForgotMsg(res.data?.message || 'Request submitted')
    } catch (err) {
      setForgotMsg(err.response?.data?.message || 'Failed to submit request')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-8 pb-4 px-5"
      >
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 bg-white">
          <img src={logo} alt="HRMS Logo" className="w-16 h-16 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-black">Welcome back</h1>
        <p className="text-gray-500 mt-2">Sign in to your account</p>
      </motion.div>

      {/* Main Content */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 px-5"
      >
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-3 rounded-xl mb-6 text-sm"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-800 text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className="w-full mt-2 bg-gray-100 border-0 rounded-xl px-4 py-3 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>

          <div>
            <label className="text-gray-800 text-sm font-medium">Password</label>
            <div className="relative mt-2">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="w-full bg-gray-100 border-0 rounded-xl px-4 py-3 pr-12 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black transition-all"
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
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setShowForgot(true); setForgotEmail(formData.email || '') }}
              className="text-sm text-gray-500 font-medium hover:text-black"
            >
              Forgot Password?
            </button>
          </div>

          <motion.button 
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-black text-white font-semibold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900 transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </motion.button>
          <div className="text-center pt-2">
            <p className="text-gray-500 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-black font-semibold hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowForgot(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-black w-full max-w-sm rounded-2xl p-6 border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-white text-lg font-bold mb-2">Forgot Password</h2>
              <p className="text-white/60 text-sm mb-4">Request a temporary password from Admin.</p>
              <form onSubmit={handleForgot} className="space-y-3">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  required
                />
                {forgotMsg && (
                  <div className="text-xs text-white/70 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    {forgotMsg}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-white text-black py-3 rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-60"
                >
                  {forgotLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Login
