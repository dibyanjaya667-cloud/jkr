import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'

function AdminLogin({ setToken, setUser }) {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        ...formData,
      })

      if (!['admin', 'ceo'].includes(response.data?.user?.role)) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
        setError('Access denied. Admin only.')
        return
      }

      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      setToken(response.data.token)
      setUser(response.data.user)
      navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.message || 'Admin login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-16 pb-8 px-6"
      >
        <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-black">Admin Login</h1>
        <p className="text-gray-500 mt-2">Sign in to admin panel</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 px-6"
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-gray-800 text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="admin@hrms.com"
              className="w-full mt-2 bg-gray-100 border-0 rounded-xl px-4 py-4 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>

          <div>
            <label className="text-gray-800 text-sm font-medium">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              className="w-full mt-2 bg-gray-100 border-0 rounded-xl px-4 py-4 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-black text-white font-semibold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900 transition-all"
          >
            {loading ? 'Signing in...' : 'Sign In (Admin)'}
          </motion.button>
        </form>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="p-6 text-center">
        <p className="text-gray-500 text-sm">
          Employee login?{' '}
          <Link to="/login" className="text-black font-semibold hover:underline">
            Go to User Login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

export default AdminLogin
