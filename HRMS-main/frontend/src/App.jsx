import { useState, useEffect, useMemo } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ProfileDetails from './pages/ProfileDetails'
import AdminPanel from './pages/AdminPanel'
import AdminMapView from './pages/AdminMapView'
import AdminEmployeeMap from './pages/AdminEmployeeMap'
import AdminLogin from './pages/AdminLogin'
import AdminActivity from './pages/AdminActivity'
import AdminReports from './pages/AdminReports'
import LocationShare from './pages/LocationShare'
import SelfieCapture from './pages/SelfieCapture'
import UserManagement from './pages/UserManagement'
import TeamDashboard from './pages/TeamDashboard'
import HRDashboard from './pages/HRDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'
import LeaveManagement from './pages/LeaveManagement'
import WFHManagement from './pages/WFHManagement'
import { API_URL } from './lib/api'
import SocialWidget from './components/SocialWidget'

function AppShell({ token, user, onLogout, setToken, setUser }) {
  const location = useLocation()
  const pathname = location?.pathname || ''
  const isAdminScreen = pathname.startsWith('/admin')
    || pathname.startsWith('/user-management')
    || pathname.startsWith('/leave-management')
    || pathname.startsWith('/wfh-management')
  const isAuthLoading = !!token && !user

  const [installPromptEvent, setInstallPromptEvent] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const installPromptLimit = 3
  const installPromptKey = 'hrms_install_prompt_count'

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setInstallPromptEvent(e)
      if (isStandalone) return
      const count = Number(localStorage.getItem(installPromptKey) || '0')
      if (count >= installPromptLimit) return
      localStorage.setItem(installPromptKey, String(count + 1))
      setShowInstallPrompt(true)
    }

    const handleAppInstalled = () => {
      setShowInstallPrompt(false)
      setInstallPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isStandalone])

  const handleInstallClick = async () => {
    if (!installPromptEvent) return
    try {
      await installPromptEvent.prompt()
      await installPromptEvent.userChoice
    } finally {
      setShowInstallPrompt(false)
      setInstallPromptEvent(null)
    }
  }

  return (
    <div className="w-full min-h-screen bg-black flex justify-center">
      <div className={`w-full ${isAdminScreen ? 'max-w-none' : 'max-w-[430px]'} min-h-screen bg-white relative`}>
        {showInstallPrompt && (
          <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">Add HRMS to Home Screen</p>
                <button
                  onClick={() => setShowInstallPrompt(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-4 py-4">
                <p className="text-xs text-gray-600">Install shortcut for quick access on your home screen.</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setShowInstallPrompt(false)}
                    className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold"
                  >
                    Later
                  </button>
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 py-2 rounded-xl bg-black text-white text-sm font-semibold"
                  >
                    Install
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <Routes>
          <Route 
            path="/login" 
            element={token ? <Navigate to="/dashboard" /> : <Login setToken={setToken} setUser={setUser} />} 
          />
          <Route
            path="/meadmin"
            element={
              token && ['admin', 'ceo'].includes(user?.role)
                ? <Navigate to="/admin" />
                : <AdminLogin setToken={setToken} setUser={setUser} />
            }
          />
          <Route 
            path="/register" 
            element={token ? <Navigate to="/dashboard" /> : <Register setToken={setToken} setUser={setUser} />} 
          />
          <Route 
            path="/dashboard" 
            element={token ? <Dashboard onLogout={onLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/profile-details" 
            element={token ? <ProfileDetails /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin" 
            element={
              token
                ? (['admin', 'ceo'].includes(user?.role) ? <AdminPanel onLogout={onLogout} /> : <Navigate to="/meadmin" />)
                : <Navigate to="/meadmin" />
            }
          />
          <Route
            path="/admin-activity"
            element={
              !token
                ? <Navigate to="/meadmin" />
                : isAuthLoading
                  ? <div className="min-h-screen bg-black flex items-center justify-center text-white/70 text-sm">Loading...</div>
                  : (['admin', 'ceo', 'hr'].includes(user?.role) ? <AdminActivity /> : <Navigate to="/dashboard" />)
            }
          />
          <Route
            path="/admin-reports"
            element={
              !token
                ? <Navigate to="/meadmin" />
                : isAuthLoading
                  ? <div className="min-h-screen bg-black flex items-center justify-center text-white/70 text-sm">Loading...</div>
                  : (['admin', 'ceo', 'hr', 'manager'].includes(user?.role) ? <AdminReports /> : <Navigate to="/dashboard" />)
            }
          />
          <Route 
            path="/admin-map" 
            element={
              token
                ? (['admin', 'ceo'].includes(user?.role) ? <AdminMapView onLogout={onLogout} /> : <Navigate to="/meadmin" />)
                : <Navigate to="/meadmin" />
            }
          />

          <Route 
            path="/admin-employee-map" 
            element={
              token
                ? (['admin', 'ceo'].includes(user?.role) ? <AdminEmployeeMap onLogout={onLogout} /> : <Navigate to="/meadmin" />)
                : <Navigate to="/meadmin" />
            }
          />

          <Route
            path="/location-share"
            element={token ? <LocationShare /> : <Navigate to="/login" />}
          />
          <Route
            path="/selfie-capture"
            element={token ? <SelfieCapture /> : <Navigate to="/login" />}
          />
          <Route 
            path="/user-management" 
            element={
              token
                ? (['admin', 'ceo', 'hr'].includes(user?.role) ? <UserManagement /> : <Navigate to="/dashboard" />)
                : <Navigate to="/meadmin" />
            }
          />
          <Route 
            path="/my-team" 
            element={
              token
                ? (['admin', 'ceo', 'hr', 'manager', 'employee'].includes(user?.role) 
                    ? <TeamDashboard /> 
                    : <Navigate to="/dashboard" />)
                : <Navigate to="/login" />
            }
          />
          {/* Role-based Dashboards */}
          <Route 
            path="/hr-dashboard" 
            element={
              token
                ? (user?.role === 'hr' ? <HRDashboard onLogout={onLogout} /> : <Navigate to="/dashboard" />)
                : <Navigate to="/login" />
            }
          />
          <Route 
            path="/manager-dashboard" 
            element={
              token
                ? (user?.role === 'manager' ? <ManagerDashboard onLogout={onLogout} /> : <Navigate to="/dashboard" />)
                : <Navigate to="/login" />
            }
          />
          <Route 
            path="/employee-dashboard" 
            element={
              token
                ? (user?.role === 'employee' ? <EmployeeDashboard onLogout={onLogout} /> : <Navigate to="/dashboard" />)
                : <Navigate to="/login" />
            }
          />
          {/* Leave Management - All users can access */}
          <Route 
            path="/leave-management" 
            element={
              token
                ? <LeaveManagement />
                : <Navigate to="/login" />
            }
          />
          {/* WFH Management - All users can access */}
          <Route
            path="/wfh-management"
            element={
              token
                ? <WFHManagement />
                : <Navigate to="/login" />
            }
          />
          <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} />} />
        </Routes>
        {token && <SocialWidget currentUser={user} />}
      </div>
    </div>
  )
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    setToken(savedToken)
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  useEffect(() => {
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config
        if (error?.response?.status === 401 && original && !original._retry) {
          const refreshToken = localStorage.getItem('refreshToken')
          if (!refreshToken) return Promise.reject(error)
          original._retry = true
          try {
            const refreshRes = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
            const newToken = refreshRes.data?.token
            const newRefresh = refreshRes.data?.refreshToken
            if (newToken) {
              localStorage.setItem('token', newToken)
              setToken(newToken)
              original.headers.Authorization = `Bearer ${newToken}`
            }
            if (newRefresh) {
              localStorage.setItem('refreshToken', newRefresh)
            }
            return axios(original)
          } catch (refreshError) {
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('user')
            setToken(null)
            setUser(null)
            return Promise.reject(refreshError)
          }
        }
        return Promise.reject(error)
      }
    )

    return () => {
      axios.interceptors.response.eject(resInterceptor)
    }
  }, [])

  useEffect(() => {
    const hydrateUser = async () => {
      if (!token) return
      try {
        const res = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setUser(res.data)
        localStorage.setItem('user', JSON.stringify(res.data))
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
      }
    }

    hydrateUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    try {
      if (refreshToken) {
        await axios.post(`${API_URL}/auth/logout`, { refreshToken }, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      }
    } catch {
      // ignore
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return (
    <Router>
      <AppShell
        token={token}
        user={user}
        onLogout={handleLogout}
        setToken={setToken}
        setUser={setUser}
      />
    </Router>
  )
}

export default App
