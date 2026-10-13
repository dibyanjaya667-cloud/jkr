import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'

const ROLES = [
  { value: 'ceo', label: 'CEO', color: 'bg-amber-500', icon: '👑', level: 1 },
  { value: 'hr', label: 'HR', color: 'bg-pink-500', icon: '🧑‍💼', level: 2 },
  { value: 'manager', label: 'Manager', color: 'bg-blue-500', icon: '📊', level: 3 },
  { value: 'employee', label: 'Employee', color: 'bg-slate-500', icon: '👤', level: 4 },
]

const DEPARTMENTS = [
  'MANAGEMENT',
  'ADMINISTRATION & HR',
  'LEGAL',
  'ACCOUNTS',
  'BUSINESS DEVELOPMENT',
  'BIM',
  'DESIGN',
  'GIS',
  'PMC',
  'TRAINING & DEVELOPMENT',
  'OTHER',
]

const getRoleConfig = (role) => ROLES.find(r => r.value === role) || { label: role, color: 'bg-gray-500', icon: '👤', level: 5 }

const getRoleBadge = (role) => {
  const roleConfig = getRoleConfig(role)
  return (
    <span className={`${roleConfig.color} text-white text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1`}>
      <span>{roleConfig.icon}</span>
      {roleConfig.label}
    </span>
  )
}

// Hierarchical Tree Node Component
function TreeNode({ user, subordinates, level = 0, onEdit, onDelete, onAddSubordinate, expandedNodes, toggleExpand }) {
  const hasChildren = subordinates && subordinates.length > 0
  const isExpanded = expandedNodes.has(user._id)
  const roleConfig = getRoleConfig(user.role)
  
  return (
    <div className="select-none">
      {/* Node */}
      <div 
        className={`flex items-center gap-2 py-2 px-3 rounded-xl transition-all hover:bg-white/10 group ${level === 0 ? 'bg-white/5' : ''}`}
        style={{ marginLeft: level * 24 }}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={() => hasChildren && toggleExpand(user._id)}
          className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${
            hasChildren ? 'hover:bg-white/20 cursor-pointer' : 'opacity-0'
          }`}
        >
          {hasChildren && (
            <svg 
              className={`w-4 h-4 text-white/60 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* Role Icon */}
        <div className={`w-10 h-10 ${roleConfig.color} rounded-xl flex items-center justify-center shadow-lg`}>
          <span className="text-lg">{roleConfig.icon}</span>
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold truncate">{user.name || user.email?.split('@')[0]}</span>
            {getRoleBadge(user.role)}
            {user.isActive === false && (
              <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">Inactive</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span>{user.employeeId}</span>
            {user.department && <span>• {user.department}</span>}
            {user.designation && <span>• {user.designation}</span>}
          </div>
        </div>

        {/* Subordinate Count */}
        {hasChildren && (
          <div className="bg-white/10 px-2 py-1 rounded-lg">
            <span className="text-white/70 text-xs font-medium">{subordinates.length} reports</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddSubordinate(user)}
            className="p-2 hover:bg-emerald-500/20 rounded-lg transition-colors"
            title="Add subordinate"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(user)}
            className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
            title="Edit user"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(user._id)}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
            title="Delete user"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Connector Line */}
            <div 
              className="border-l-2 border-white/10 ml-6"
              style={{ marginLeft: level * 24 + 16 }}
            >
              {subordinates.map((sub, idx) => (
                <TreeNode
                  key={sub.user._id}
                  user={sub.user}
                  subordinates={sub.children}
                  level={level + 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddSubordinate={onAddSubordinate}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [supervisors, setSupervisors] = useState([])
  const [managers, setManagers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('hierarchy') // 'hierarchy' | 'list'
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  const [preSelectedSupervisor, setPreSelectedSupervisor] = useState(null)
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    role: 'employee',
    reportsTo: '',
    department: '',
    designation: '',
    manager: '',
  })

  const isHR = currentUserRole === 'hr'
  const hrRoleOnlyEdit = isHR && Boolean(editingUser)

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data)
      
      // Auto expand first level
      const topLevel = res.data.filter(u => !u.reportsTo)
      setExpandedNodes(new Set(topLevel.map(u => u._id)))
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching users:', error)
      if (error.response?.status === 403) {
        navigate('/dashboard')
      }
      setLoading(false)
    }
  }, [navigate])

  const fetchManagers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/managers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setManagers(res.data)
    } catch (error) {
      console.error('Error fetching managers:', error)
    }
  }, [])

  const fetchSupervisors = async (role) => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/admin/potential-supervisors/${role}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSupervisors(res.data)
    } catch (error) {
      console.error('Error fetching supervisors:', error)
    }
  }

  useEffect(() => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setCurrentUserRole(payload.role || '')
      }
    } catch (e) {
      // ignore
    }
    fetchUsers()
    fetchManagers()
  }, [fetchUsers, fetchManagers])

  useEffect(() => {
    if (formData.role) {
      fetchSupervisors(formData.role)
    }
  }, [formData.role])

  // Build hierarchical tree from flat user list
  const hierarchyTree = useMemo(() => {
    const userMap = new Map()
    users.forEach(u => userMap.set(u._id, { user: u, children: [] }))
    
    const roots = []
    
    users.forEach(u => {
      const node = userMap.get(u._id)
      if (u.role === 'ceo') {
        roots.push(node)
        return
      }
      if (u.reportsTo?._id) {
        const parent = userMap.get(u.reportsTo._id)
        if (parent) {
          parent.children.push(node)
        } else {
          roots.push(node)
        }
      } else {
        roots.push(node)
      }
    })
    
    // Sort roots and children by role level then name
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        const levelA = getRoleConfig(a.user.role).level
        const levelB = getRoleConfig(b.user.role).level
        if (levelA !== levelB) return levelA - levelB
        return (a.user.name || '').localeCompare(b.user.name || '')
      })
      nodes.forEach(n => sortNodes(n.children))
    }
    sortNodes(roots)
    
    return roots
  }, [users])

  // Filtered tree for search
  const filteredTree = useMemo(() => {
    if (!searchQuery) return hierarchyTree
    
    const query = searchQuery.toLowerCase()
    const matchingIds = new Set()
    
    // Find all matching users and their ancestors
    const findMatches = (user) => {
      const matches = 
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.employeeId?.toLowerCase().includes(query) ||
        user.department?.toLowerCase().includes(query)
      return matches
    }
    
    // Get all ancestors of a user
    const getAncestors = (userId, ancestors = []) => {
      const user = users.find(u => u._id === userId)
      if (user?.reportsTo?._id) {
        ancestors.push(user.reportsTo._id)
        getAncestors(user.reportsTo._id, ancestors)
      }
      return ancestors
    }
    
    users.forEach(u => {
      if (findMatches(u)) {
        matchingIds.add(u._id)
        getAncestors(u._id).forEach(id => matchingIds.add(id))
      }
    })
    
    // Filter tree to only show matching nodes
    const filterNodes = (nodes) => {
      return nodes
        .filter(n => matchingIds.has(n.user._id))
        .map(n => ({
          ...n,
          children: filterNodes(n.children)
        }))
    }
    
    // Auto expand all when searching
    if (searchQuery) {
      setExpandedNodes(new Set(Array.from(matchingIds)))
    }
    
    return filterNodes(hierarchyTree)
  }, [hierarchyTree, searchQuery, users])

  const toggleExpand = (userId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedNodes(new Set(users.map(u => u._id)))
  }

  const collapseAll = () => {
    setExpandedNodes(new Set())
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      let payload = { ...formData }
      if (hrRoleOnlyEdit) {
        payload = { role: formData.role }
      }
      if (!payload.reportsTo) delete payload.reportsTo
      if (!payload.manager) delete payload.manager
      if (!payload.password && editingUser) delete payload.password

      if (editingUser) {
        await axios.put(`${API_URL}/admin/users/${editingUser._id}`, payload, { headers })
      } else {
        await axios.post(`${API_URL}/admin/users`, payload, { headers })
      }
      
      setShowModal(false)
      setEditingUser(null)
      setPreSelectedSupervisor(null)
      resetForm()
      fetchUsers()
    } catch (error) {
      alert(error.response?.data?.message || 'Error saving user')
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setPreSelectedSupervisor(null)
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      employeeId: user.employeeId || '',
      role: user.role || 'employee',
      reportsTo: user.reportsTo?._id || '',
      department: user.department || '',
      designation: user.designation || '',
      manager: user.manager?._id || '',
    })
    setShowModal(true)
  }

  const handleAddSubordinate = (supervisor) => {
    setEditingUser(null)
    setPreSelectedSupervisor(supervisor)
    
    // Determine default role for subordinate
    // Hierarchy: Employee < Manager < HR < CEO
    const supervisorRole = supervisor.role
    let defaultRole = 'employee'
    if (supervisorRole === 'ceo') defaultRole = 'hr'
    else if (supervisorRole === 'hr') defaultRole = 'manager'
    else if (supervisorRole === 'manager') defaultRole = 'employee'
    
    setFormData({
      name: '',
      email: '',
      password: '',
      employeeId: '',
      role: defaultRole,
      reportsTo: supervisor._id,
      department: supervisor.department || '',
      designation: '',
      manager: '',
    })
    setShowModal(true)
  }

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? All subordinates will become unassigned.')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchUsers()
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting user')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      employeeId: '',
      role: 'employee',
      reportsTo: '',
      department: '',
      designation: '',
      manager: '',
    })
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setPreSelectedSupervisor(null)
    resetForm()
    setShowModal(true)
  }

  // Get unassigned users (no supervisor)
  const unassignedUsers = users.filter(u => !u.reportsTo && u.role !== 'ceo' && u.role !== 'admin')

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-violet-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <p className="text-white/50">Loading Organization...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-xl px-5 md:px-8 py-4 flex items-center justify-between border-b border-white/10">
        <div>
          <h1 className="text-lg font-bold text-white">🏢 Organization Hierarchy</h1>
          <p className="text-white/50 text-xs">Manage Employee Structure & Reporting Lines</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className="text-xs text-white bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg transition-colors font-medium"
          >
            + Add Employee
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="text-xs text-white/70 hover:text-white bg-white/10 px-3 py-2 rounded-lg"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-5 md:px-8 py-4 flex flex-wrap gap-3 items-center border-b border-white/5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 border border-white/10 text-white placeholder-white/30 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>

        {/* View Toggle */}
        <div className="flex bg-white/10 rounded-xl p-1">
          <button
            onClick={() => setViewMode('hierarchy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'hierarchy' ? 'bg-violet-500 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            🌳 Tree View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'list' ? 'bg-violet-500 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            📋 List View
          </button>
        </div>

        {/* Expand/Collapse */}
        {viewMode === 'hierarchy' && (
          <div className="flex gap-1">
            <button
              onClick={expandAll}
              className="text-xs text-white/60 hover:text-white bg-white/10 px-3 py-2 rounded-lg"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs text-white/60 hover:text-white bg-white/10 px-3 py-2 rounded-lg"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="px-5 md:px-8 py-4 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-white/60 text-xs">Total</p>
          <p className="text-xl font-bold text-white">{users.length}</p>
        </div>
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role.value).length
          return (
            <div key={role.value} className={`${role.color}/20 border border-white/10 rounded-xl p-3`}>
              <p className="text-white/60 text-xs flex items-center gap-1">
                <span>{role.icon}</span> {role.label}
              </p>
              <p className="text-xl font-bold text-white">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden px-5 md:px-8 pb-4">
        <div className="h-full flex gap-4">
          {/* Hierarchy Tree */}
          <div className={`${viewMode === 'hierarchy' ? 'flex-1' : 'hidden'} bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col`}>
            <div className="flex-1 overflow-auto p-4">
              {filteredTree.length === 0 ? (
                <div className="text-center py-10">
                  <span className="text-4xl mb-4 block">🏢</span>
                  <p className="text-white/50">No employees found</p>
                  <p className="text-white/30 text-sm mt-1">Add your first employee to start building the hierarchy</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTree.map(node => (
                    <TreeNode
                      key={node.user._id}
                      user={node.user}
                      subordinates={node.children}
                      level={0}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onAddSubordinate={handleAddSubordinate}
                      expandedNodes={expandedNodes}
                      toggleExpand={toggleExpand}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* List View */}
          <div className={`${viewMode === 'list' ? 'flex-1' : 'hidden'} bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col`}>
            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10">
                  <tr>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase px-4 py-3">Employee</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase px-4 py-3">Role</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase px-4 py-3">Reports To</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase px-4 py-3">Department</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase px-4 py-3">Status</th>
                    <th className="text-left text-white/60 font-semibold text-xs uppercase px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => 
                    !searchQuery || 
                    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((user, idx) => (
                    <tr key={user._id} className={idx % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 ${getRoleConfig(user.role).color} rounded-lg flex items-center justify-center`}>
                            <span className="text-sm">{getRoleConfig(user.role).icon}</span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.name || '—'}</p>
                            <p className="text-white/50 text-xs">{user.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                      <td className="px-4 py-3 text-white/70">
                        {user.reportsTo ? (
                          <div className="flex items-center gap-2">
                            <span>{user.reportsTo.name}</span>
                            <span className="text-xs text-white/40">({getRoleConfig(user.reportsTo.role).label})</span>
                          </div>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">{user.department || '—'}</td>
                      <td className="px-4 py-3">
                        {user.isActive !== false ? (
                          <span className="text-emerald-400 text-xs">Active</span>
                        ) : (
                          <span className="text-red-400 text-xs">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(user)} className="text-blue-400 hover:text-blue-300 text-xs">Edit</button>
                          <button onClick={() => handleDelete(user._id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unassigned Users Panel */}
          {viewMode === 'hierarchy' && unassignedUsers.length > 0 && (
            <div className="w-72 bg-amber-500/10 border border-amber-500/20 rounded-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-amber-500/20">
                <h3 className="text-amber-300 font-semibold text-sm flex items-center gap-2">
                  ⚠️ Unassigned Employees
                </h3>
                <p className="text-amber-300/60 text-xs mt-1">Click to assign a supervisor</p>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {unassignedUsers.map(user => (
                  <div
                    key={user._id}
                    onClick={() => handleEdit(user)}
                    className="bg-white/10 hover:bg-white/20 rounded-xl p-3 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 ${getRoleConfig(user.role).color} rounded-lg flex items-center justify-center`}>
                        <span className="text-sm">{getRoleConfig(user.role).icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{user.name || user.email}</p>
                        <p className="text-white/50 text-xs">{user.employeeId}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-lg font-bold text-white mb-1">
                {editingUser ? '✏️ Edit Employee' : preSelectedSupervisor ? '➕ Add Subordinate' : '➕ Add Employee'}
              </h2>
              {preSelectedSupervisor && (
                <p className="text-white/50 text-sm mb-4">
                  Adding under: <span className="text-violet-400 font-medium">{preSelectedSupervisor.name}</span> ({getRoleConfig(preSelectedSupervisor.role).label})
                </p>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/60 text-xs block mb-1">Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={isHR}
                      className={`w-full bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                        isHR ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs block mb-1">Employee ID *</label>
                    <input
                      type="text"
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleInputChange}
                      disabled={!!editingUser || isHR}
                      className={`w-full bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                        (editingUser || isHR) ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-white/60 text-xs block mb-1">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isHR}
                    className={`w-full bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                      isHR ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="text-white/60 text-xs block mb-1">
                    Password {editingUser && <span className="text-white/40">(leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isHR}
                    className={`w-full bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                      isHR ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    {...(!editingUser && { required: true })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/60 text-xs block mb-1">Role *</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/60 text-xs block mb-1">Reports To</label>
                    <select
                      name="reportsTo"
                      value={formData.reportsTo}
                      onChange={handleInputChange}
                      disabled={isHR}
                      className={`w-full bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                        isHR ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">None (Top Level)</option>
                      {supervisors.map(s => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({getRoleConfig(s.role).label})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/60 text-xs block mb-1">Department</label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      disabled={isHR}
                      className={`w-full bg-white/10 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                        isHR ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="" className="bg-slate-800">Select department…</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept} className="bg-slate-800">{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/60 text-xs block mb-1">Designation</label>
                    <input
                      type="text"
                      name="designation"
                      value={formData.designation}
                      onChange={handleInputChange}
                      placeholder="e.g., Senior Developer"
                      disabled={isHR}
                      className={`w-full bg-white/10 border border-white/10 text-white placeholder-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                        isHR ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>

                {isHR && (
                  <p className="text-[11px] text-white/40">HR can only update Role for existing users.</p>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setPreSelectedSupervisor(null); }}
                    className="flex-1 bg-white/10 text-white py-2.5 rounded-lg text-sm hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isHR && !editingUser}
                    className={`flex-1 bg-violet-500 hover:bg-violet-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isHR && !editingUser ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {editingUser ? 'Update Employee' : 'Add Employee'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default UserManagement
