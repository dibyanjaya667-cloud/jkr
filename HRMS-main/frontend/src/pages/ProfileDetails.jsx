import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'
import { isStorageConfigured, uploadFileToStorage } from '../lib/storage'

// Indian Banks List (Major Banks)
const INDIAN_BANKS = [
  // Public Sector Banks
  'State Bank of India',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Indian Bank',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Bank of Maharashtra',
  'Punjab & Sind Bank',
  // Private Sector Banks
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDBI Bank',
  'Federal Bank',
  'South Indian Bank',
  'RBL Bank',
  'Bandhan Bank',
  'IDFC First Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Tamilnad Mercantile Bank',
  'Dhanlaxmi Bank',
  'Karnataka Bank',
  'CSB Bank',
  'DCB Bank',
  'Jammu & Kashmir Bank',
  'Nainital Bank',
  // Small Finance Banks
  'AU Small Finance Bank',
  'Equitas Small Finance Bank',
  'Ujjivan Small Finance Bank',
  'Jana Small Finance Bank',
  'Fincare Small Finance Bank',
  'ESAF Small Finance Bank',
  'North East Small Finance Bank',
  'Capital Small Finance Bank',
  'Suryoday Small Finance Bank',
  'Utkarsh Small Finance Bank',
  // Payment Banks
  'Paytm Payments Bank',
  'Airtel Payments Bank',
  'India Post Payments Bank',
  'Fino Payments Bank',
  'Jio Payments Bank',
  // Foreign Banks (Operating in India)
  'Citibank',
  'HSBC',
  'Standard Chartered Bank',
  'Deutsche Bank',
  'Barclays Bank',
  'DBS Bank',
  'Bank of America',
  // Regional Rural Banks (Major ones)
  'Gramin Bank',
  // Co-operative Banks (Major ones)
  'Saraswat Co-operative Bank',
  'Cosmos Co-operative Bank',
  'Other',
].sort()

// Indian States List
const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
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

// Skeleton Component
const SkeletonPulse = ({ className }) => (
  <div className={`relative overflow-hidden bg-gray-200/80 rounded ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
  </div>
)

const ProfileDetailsSkeleton = () => (
  <div className="space-y-6 p-4">
    <SkeletonPulse className="h-8 w-48 rounded-lg" />
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-2xl p-4 space-y-3">
          <SkeletonPulse className="h-5 w-32 rounded" />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonPulse className="h-12 rounded-xl" />
            <SkeletonPulse className="h-12 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  </div>
)

const ProfileDetails = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState('') // Track which doc is uploading
  const [currentStep, setCurrentStep] = useState(0) // 0-6 for 7 steps
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [bankSearch, setBankSearch] = useState('')
  const [showBankDropdown, setShowBankDropdown] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [changeForm, setChangeForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [changeLoading, setChangeLoading] = useState(false)
  const [changeMsg, setChangeMsg] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')
  
  // Profile verification state
  const [profileStatus, setProfileStatus] = useState('draft') // draft, pending, approved, rejected
  const [rejectionReason, setRejectionReason] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    // Personal Info
    name: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    maritalStatus: '',
    nationality: 'Indian',
    department: '',
    // Contact Info
    phone: '',
    alternatePhone: '',
    personalEmail: '',
    currentAddress: '',
    permanentAddress: '',
    city: '',
    state: '',
    pincode: '',
    // Identity Documents
    aadharNumber: '',
    panNumber: '',
    passportNumber: '',
    drivingLicense: '',
    voterId: '',
    // Bank Details
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    uanNumber: '',
    esiNumber: '',
    // Emergency Contact
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
    },
    // Education
    education: [],
    // Experience
    experience: [],
  })

  const fileInputRefs = {
    aadharFront: useRef(null),
    aadharBack: useRef(null),
    panCard: useRef(null),
  }

  const notify = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const token = () => localStorage.getItem('token')
  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
  const toUrl = (url) => url && !/^https?:\/\//i.test(url) ? `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}` : url || ''

  useEffect(() => {
    fetchUserData()
  }, [])

  useEffect(() => {
    if (location.state?.openChangePassword) {
      setShowChangePassword(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      const userData = res.data
      setUser(userData)
      
      // Populate form with existing data
      setFormData({
        name: userData.name || '',
        dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth).toISOString().split('T')[0] : '',
        gender: userData.gender || '',
        bloodGroup: userData.bloodGroup || '',
        maritalStatus: userData.maritalStatus || '',
        nationality: userData.nationality || 'Indian',
        department: userData.department || '',
        phone: userData.phone || '',
        alternatePhone: userData.alternatePhone || '',
        personalEmail: userData.personalEmail || '',
        currentAddress: userData.currentAddress || '',
        permanentAddress: userData.permanentAddress || '',
        city: userData.city || '',
        state: userData.state || '',
        pincode: userData.pincode || '',
        aadharNumber: userData.aadharNumber || '',
        panNumber: userData.panNumber || '',
        passportNumber: userData.passportNumber || '',
        drivingLicense: userData.drivingLicense || '',
        voterId: userData.voterId || '',
        bankName: userData.bankName || '',
        accountNumber: userData.accountNumber || '',
        ifscCode: userData.ifscCode || '',
        uanNumber: userData.uanNumber || '',
        esiNumber: userData.esiNumber || '',
        emergencyContact: userData.emergencyContact || { name: '', relationship: '', phone: '' },
        education: userData.education || [],
        experience: userData.experience || [],
      })
      
      // Set verification status
      setProfileStatus(userData.profileStatus || 'draft')
      setRejectionReason(userData.rejectionReason || '')
      setIsLocked(userData.profileStatus === 'pending' || userData.profileStatus === 'approved')
      
    } catch (error) {
      notify('Failed to load profile', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (changeForm.newPassword !== changeForm.confirmPassword) {
      setChangeMsg('New password and confirm password do not match')
      return
    }
    setChangeLoading(true)
    setChangeMsg('')
    try {
      const res = await axios.post(`${API_URL}/auth/change-password`, {
        oldPassword: changeForm.oldPassword,
        newPassword: changeForm.newPassword,
      }, { headers: { Authorization: `Bearer ${token()}` } })
      setChangeMsg(res.data?.message || 'Password updated')
      notify('Password updated successfully', 'success')
      setChangeForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setChangeMsg(err.response?.data?.message || 'Failed to update password')
    } finally {
      setChangeLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotMsg('')
    try {
      const res = await axios.post(`${API_URL}/auth/password-reset-request`, {
        email: user?.email || formData.personalEmail || '',
      })
      setForgotMsg(res.data?.message || 'Request submitted')
    } catch (err) {
      setForgotMsg(err.response?.data?.message || 'Failed to submit request')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleChange = (field, value) => {
    if (isLocked) return // Prevent changes if locked
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNestedChange = (parent, field, value) => {
    if (isLocked) return
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }))
  }

  const handleArrayChange = (arrayName, index, field, value) => {
    if (isLocked) return
    setFormData(prev => ({
      ...prev,
      [arrayName]: prev[arrayName].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const addArrayItem = (arrayName, defaultItem) => {
    if (isLocked) return
    setFormData(prev => ({
      ...prev,
      [arrayName]: [...prev[arrayName], defaultItem]
    }))
  }

  const removeArrayItem = (arrayName, index) => {
    if (isLocked) return
    setFormData(prev => ({
      ...prev,
      [arrayName]: prev[arrayName].filter((_, i) => i !== index)
    }))
  }

  const handleSave = async () => {
    if (isLocked) {
      notify('Profile is locked. Cannot edit.', 'error')
      return
    }
    try {
      setSaving(true)
      const res = await axios.put(`${API_URL}/auth/profile`, formData, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      setUser(res.data.user)
      notify('Progress saved!', 'success')
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Submit profile for HR verification
  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true)
      // First save all data
      await axios.put(`${API_URL}/auth/profile`, formData, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      // Then submit for verification
      const res = await axios.post(`${API_URL}/auth/submit-profile`, {}, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      notify(res.data.message, 'success')
      setProfileStatus('pending')
      setIsLocked(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (error) {
      const errData = error.response?.data
      if (errData?.missingFields) {
        notify(`Missing: ${errData.missingFields.slice(0, 3).join(', ')}...`, 'error')
      } else {
        notify(errData?.message || 'Submission failed', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Resubmit after rejection
  const handleResubmit = async () => {
    try {
      await axios.post(`${API_URL}/auth/resubmit-profile`, {}, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      setProfileStatus('draft')
      setIsLocked(false)
      notify('Profile unlocked! Make changes and submit again.', 'success')
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to unlock', 'error')
    }
  }

  const handleDocUpload = async (docType, file) => {
    if (!file || isLocked) return
    try {
      setUploadingDoc(docType)
      let uploadedUrl = ''

      if (isStorageConfigured()) {
        const folder = docType === 'aadharFront'
          ? 'documents/aadhar-front'
          : docType === 'aadharBack'
            ? 'documents/aadhar-back'
            : 'documents/pan-card'
        uploadedUrl = await uploadFileToStorage(file, folder)
        const res = await axios.post(
          `${API_URL}/auth/upload-document-url`,
          { docType, url: uploadedUrl },
          { headers: { Authorization: `Bearer ${token()}` } }
        )
        uploadedUrl = res.data?.url || uploadedUrl
      } else {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('docType', docType)

        const res = await axios.post(`${API_URL}/auth/upload-document`, fd, {
          headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': 'multipart/form-data'
          }
        })
        uploadedUrl = res.data?.url || ''
      }
      
      // Update only the specific URL in user state without refetching
      // This preserves the form data including aadhar/pan numbers
      setUser(prev => ({
        ...prev,
        [docType === 'aadharFront' ? 'aadharFrontUrl' :
         docType === 'aadharBack' ? 'aadharBackUrl' :
         'panCardUrl']: uploadedUrl
      }))
      
      notify('Document uploaded!', 'success')
    } catch (error) {
      notify('Upload failed', 'error')
    } finally {
      setUploadingDoc('')
    }
  }

  // Format Aadhar for display (XXXX XXXX XXXX)
  const formatAadhar = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 12)
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
  }

  // Step Icons as SVG components
  const StepIcons = {
    personal: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    contact: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    documents: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    bank: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    emergency: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    education: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 14l9-5-9-5-9 5 9 5z" />
        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
    experience: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  }

  // Steps configuration
  const steps = [
    { id: 'personal', label: 'Personal', subtitle: 'Basic Info' },
    { id: 'contact', label: 'Contact', subtitle: 'Address & Phone' },
    { id: 'documents', label: 'Documents', subtitle: 'ID Proofs' },
    { id: 'bank', label: 'Bank', subtitle: 'Salary Account' },
    { id: 'emergency', label: 'Emergency', subtitle: 'SOS Contact' },
    { id: 'education', label: 'Education', subtitle: 'Qualifications' },
    { id: 'experience', label: 'Experience', subtitle: 'Work History' },
  ]

  const currentSection = steps[currentStep]?.id
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1
  // Can submit from step 5 (emergency) onwards - education & experience are optional
  const canSubmit = currentStep >= 4 // Step 5 (emergency) index is 4

  const handleNext = async () => {
    if (!isLastStep) {
      // Auto-save progress on each step
      if (!isLocked) {
        await handleSave()
      }
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1)
    }
  }
  // Calculate profile completion percentage
  const calculateCompletion = () => {
    const requiredFields = ['name', 'dateOfBirth', 'gender', 'phone', 'currentAddress', 'aadharNumber', 'panNumber']
    const filled = requiredFields.filter(f => formData[f] && formData[f] !== '').length
    return Math.round((filled / requiredFields.length) * 100)
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex justify-center">
      <div className="relative w-full max-w-md h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col overflow-hidden">
        <ProfileDetailsSkeleton />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex justify-center">
      <div className="relative w-full max-w-md h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col overflow-hidden md:my-4 md:h-[calc(100vh-2rem)] md:rounded-[28px] md:border md:border-white/10 md:shadow-2xl">
        
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl text-sm font-medium shadow-lg ${
                toast.type === 'success' ? 'bg-emerald-500 text-white' : 
                toast.type === 'error' ? 'bg-red-500 text-white' : 
                'bg-gray-800 text-white'
              }`}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Banner for Pending/Approved/Rejected */}
        {profileStatus !== 'draft' && (
          <motion.div
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            className={`px-4 py-3 flex items-center gap-3 ${
              profileStatus === 'pending' ? 'bg-amber-500' :
              profileStatus === 'approved' ? 'bg-emerald-500' :
              'bg-red-500'
            }`}
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              {profileStatus === 'pending' && (
                <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {profileStatus === 'approved' && (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
              {profileStatus === 'rejected' && (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">
                {profileStatus === 'pending' && 'Verification Pending'}
                {profileStatus === 'approved' && 'Profile Verified'}
                {profileStatus === 'rejected' && 'Profile Rejected'}
              </p>
              <p className="text-white/80 text-xs">
                {profileStatus === 'pending' && 'HR is reviewing your details'}
                {profileStatus === 'approved' && 'You are a verified employee'}
                {profileStatus === 'rejected' && rejectionReason}
              </p>
            </div>
            {profileStatus === 'rejected' && (
              <button
                onClick={handleResubmit}
                className="px-3 py-1.5 bg-white text-red-500 text-xs font-semibold rounded-lg"
              >
                Edit & Resubmit
              </button>
            )}
          </motion.div>
        )}

        {/* Header */}
        <div className="bg-black px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-white font-bold text-lg">
                {isLocked ? 'View Profile' : 'Complete Profile'}
              </h1>
              <p className="text-white/50 text-xs">
                {isLocked ? 'Read-only mode' : `Step ${currentStep + 1} of ${steps.length}`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-white/50 text-xs">Progress</span>
              <p className="text-white font-bold">{calculateCompletion()}%</p>
            </div>
          </div>

          {/* Step Progress Bar */}
          <div className="flex gap-1.5">
            {steps.map((step, idx) => (
              <motion.div
                key={step.id}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  isLocked ? 'bg-white/50' :
                  idx < currentStep ? 'bg-emerald-500' :
                  idx === currentStep ? 'bg-white' :
                  'bg-white/20'
                }`}
                initial={false}
                animate={{ 
                  scale: idx === currentStep ? [1, 1.1, 1] : 1 
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => { setShowChangePassword(true); setChangeMsg('') }}
              className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-lg"
            >
              Change Password
            </button>
            <button
              onClick={() => { setShowForgotPassword(true); setForgotMsg('') }}
              className="px-3 py-1.5 bg-white/10 text-white text-xs font-semibold rounded-lg border border-white/10"
            >
              Forgot Password
            </button>
          </div>
        </div>

        {/* Current Step Info */}
        <div className="px-4 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isLocked ? 'bg-gray-300 text-gray-500' : 'bg-black text-white'
            }`}>
              {isLocked ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : StepIcons[steps[currentStep]?.id]}
            </div>
            <div className="flex-1">
              <h2 className="text-gray-800 font-semibold text-lg">{steps[currentStep]?.label}</h2>
              <p className="text-gray-400 text-xs">{steps[currentStep]?.subtitle}</p>
            </div>
            {isLocked && (
              <span className="px-2 py-1 bg-gray-200 text-gray-500 text-xs font-medium rounded-lg">
                Locked
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-8">
          <AnimatePresence mode="wait">
            {/* Personal Information */}
            {currentSection === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                
                {/* Name */}
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>

                {/* DOB & Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Date of Birth *</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Gender *</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleChange('gender', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Blood Group & Marital Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Blood Group</label>
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => handleChange('bloodGroup', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    >
                      <option value="">Select</option>
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Marital Status</label>
                    <select
                      value={formData.maritalStatus}
                      onChange={(e) => handleChange('maritalStatus', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    >
                      <option value="">Select</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => handleChange('department', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <option value="">Select</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Nationality */}
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => handleChange('nationality', e.target.value)}
                    placeholder="Indian"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
              </motion.div>
            )}

            {/* Contact Information */}
            {currentSection === 'contact' && (
              <motion.div
                key="contact"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >

                {/* Phone Numbers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Mobile *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Alternate</label>
                    <input
                      type="tel"
                      value={formData.alternatePhone}
                      onChange={(e) => handleChange('alternatePhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Optional"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>

                {/* Personal Email */}
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Personal Email</label>
                  <input
                    type="email"
                    value={formData.personalEmail}
                    onChange={(e) => handleChange('personalEmail', e.target.value)}
                    placeholder="personal@email.com"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>

                {/* Current Address */}
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Current Address *</label>
                  <textarea
                    value={formData.currentAddress}
                    onChange={(e) => handleChange('currentAddress', e.target.value)}
                    placeholder="House/Flat No, Street, Area"
                    rows={2}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
                  />
                </div>

                {/* Permanent Address */}
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Permanent Address</label>
                  <textarea
                    value={formData.permanentAddress}
                    onChange={(e) => handleChange('permanentAddress', e.target.value)}
                    placeholder="Same as current or different"
                    rows={2}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
                  />
                </div>

                {/* City, State, Pincode */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      placeholder="State"
                      className="w-full px-3 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Pincode</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => handleChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="w-full px-3 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Documents */}
            {currentSection === 'documents' && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Aadhar */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-800 font-semibold text-sm">Aadhar Card</p>
                      <p className="text-gray-400 text-xs">12-digit UIDAI number</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={formatAadhar(formData.aadharNumber)}
                    onChange={(e) => handleChange('aadharNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="XXXX XXXX XXXX"
                    maxLength={14}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 mb-3"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => fileInputRefs.aadharFront.current?.click()}
                      disabled={uploadingDoc === 'aadharFront'}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                        user?.aadharFrontUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      } ${uploadingDoc === 'aadharFront' ? 'opacity-70' : ''}`}
                    >
                      {uploadingDoc === 'aadharFront' ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          {user?.aadharFrontUrl ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          )}
                          {user?.aadharFrontUrl ? 'Front ✓' : 'Upload Front'}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => fileInputRefs.aadharBack.current?.click()}
                      disabled={uploadingDoc === 'aadharBack'}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                        user?.aadharBackUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      } ${uploadingDoc === 'aadharBack' ? 'opacity-70' : ''}`}
                    >
                      {uploadingDoc === 'aadharBack' ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          {user?.aadharBackUrl ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          )}
                          {user?.aadharBackUrl ? 'Back ✓' : 'Upload Back'}
                        </>
                      )}
                    </button>
                  </div>
                  <input ref={fileInputRefs.aadharFront} type="file" accept="image/*" className="hidden" onChange={(e) => handleDocUpload('aadharFront', e.target.files?.[0])} />
                  <input ref={fileInputRefs.aadharBack} type="file" accept="image/*" className="hidden" onChange={(e) => handleDocUpload('aadharBack', e.target.files?.[0])} />
                </div>

                {/* PAN */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-800 font-semibold text-sm">PAN Card</p>
                      <p className="text-gray-400 text-xs">10-character alphanumeric</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={formData.panNumber.toUpperCase()}
                    onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 uppercase mb-3"
                  />
                  <button
                    onClick={() => fileInputRefs.panCard.current?.click()}
                    disabled={uploadingDoc === 'panCard'}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                      user?.panCardUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } ${uploadingDoc === 'panCard' ? 'opacity-70' : ''}`}
                  >
                    {uploadingDoc === 'panCard' ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        {user?.panCardUrl ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        )}
                        {user?.panCardUrl ? 'PAN Card ✓' : 'Upload PAN Card'}
                      </>
                    )}
                  </button>
                  <input ref={fileInputRefs.panCard} type="file" accept="image/*" className="hidden" onChange={(e) => handleDocUpload('panCard', e.target.files?.[0])} />
                </div>

                {/* Other Documents */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                  <p className="text-gray-800 font-semibold text-sm">Other Documents (Optional)</p>
                  
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Passport Number</label>
                    <input
                      type="text"
                      value={formData.passportNumber.toUpperCase()}
                      onChange={(e) => handleChange('passportNumber', e.target.value.toUpperCase())}
                      placeholder="A1234567"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Driving License</label>
                    <input
                      type="text"
                      value={formData.drivingLicense.toUpperCase()}
                      onChange={(e) => handleChange('drivingLicense', e.target.value.toUpperCase())}
                      placeholder="DL-1234567890"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Voter ID</label>
                    <input
                      type="text"
                      value={formData.voterId.toUpperCase()}
                      onChange={(e) => handleChange('voterId', e.target.value.toUpperCase())}
                      placeholder="ABC1234567"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bank Details */}
            {currentSection === 'bank' && (
              <motion.div
                key="bank"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-amber-700 text-xs">
                    Bank details are used for salary processing. Please enter correct information.
                  </p>
                </div>

                {/* Bank Name with Searchable Dropdown */}
                <div className="relative">
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Bank Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => {
                        handleChange('bankName', e.target.value)
                        setBankSearch(e.target.value)
                        setShowBankDropdown(true)
                      }}
                      onFocus={() => setShowBankDropdown(true)}
                      placeholder="Search or select bank..."
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBankDropdown(!showBankDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      <svg className={`w-5 h-5 transition-transform ${showBankDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Dropdown */}
                  <AnimatePresence>
                    {showBankDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                      >
                        {INDIAN_BANKS
                          .filter(bank => 
                            bank.toLowerCase().includes((formData.bankName || '').toLowerCase())
                          )
                          .map((bank, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                handleChange('bankName', bank)
                                setShowBankDropdown(false)
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                                formData.bankName === bank ? 'bg-black text-white hover:bg-black' : 'text-gray-700'
                              }`}
                            >
                              {bank}
                            </button>
                          ))
                        }
                        {INDIAN_BANKS.filter(bank => 
                          bank.toLowerCase().includes((formData.bankName || '').toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-3 text-gray-400 text-sm text-center">
                            No banks found. Type to add custom.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Click outside to close */}
                {showBankDropdown && (
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowBankDropdown(false)}
                  />
                )}

                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Account Number</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => handleChange('accountNumber', e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter account number"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifscCode.toUpperCase()}
                    onChange={(e) => handleChange('ifscCode', e.target.value.toUpperCase().slice(0, 11))}
                    placeholder="e.g., SBIN0001234"
                    maxLength={11}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">UAN (PF)</label>
                    <input
                      type="text"
                      value={formData.uanNumber}
                      onChange={(e) => handleChange('uanNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="12 digits"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">ESI Number</label>
                    <input
                      type="text"
                      value={formData.esiNumber}
                      onChange={(e) => handleChange('esiNumber', e.target.value.replace(/\D/g, ''))}
                      placeholder="Optional"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Emergency Contact */}
            {currentSection === 'emergency' && (
              <motion.div
                key="emergency"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-red-700 text-xs">
                    This person will be contacted in case of emergency at workplace.
                  </p>
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Contact Name</label>
                  <input
                    type="text"
                    value={formData.emergencyContact.name}
                    onChange={(e) => handleNestedChange('emergencyContact', 'name', e.target.value)}
                    placeholder="e.g., Father's name"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Relationship</label>
                  <select
                    value={formData.emergencyContact.relationship}
                    onChange={(e) => handleNestedChange('emergencyContact', 'relationship', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <option value="">Select relationship</option>
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="spouse">Spouse</option>
                    <option value="sibling">Sibling</option>
                    <option value="friend">Friend</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.emergencyContact.phone}
                    onChange={(e) => handleNestedChange('emergencyContact', 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
              </motion.div>
            )}

            {/* Education */}
            {currentSection === 'education' && (
              <motion.div
                key="education"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400 text-sm">Add your qualifications</p>
                  <button
                    onClick={() => addArrayItem('education', { degree: '', institution: '', yearOfPassing: '', percentage: '' })}
                    className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg"
                  >
                    + Add
                  </button>
                </div>

                {formData.education.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-6 text-center">
                    <p className="text-gray-500 text-sm">No education added yet</p>
                    <p className="text-gray-400 text-xs mt-1">Click "+ Add" to add your qualification</p>
                  </div>
                ) : (
                  formData.education.map((edu, index) => (
                    <div key={index} className="bg-white rounded-2xl p-4 border border-gray-100 relative">
                      <button
                        onClick={() => removeArrayItem('education', index)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <p className="text-gray-400 text-xs font-medium mb-3">Qualification {index + 1}</p>
                      
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => handleArrayChange('education', index, 'degree', e.target.value)}
                          placeholder="Degree (e.g., B.Tech, MBA)"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                        />
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => handleArrayChange('education', index, 'institution', e.target.value)}
                          placeholder="Institution/University"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={edu.yearOfPassing}
                            onChange={(e) => handleArrayChange('education', index, 'yearOfPassing', e.target.value)}
                            placeholder="Year"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                          />
                          <input
                            type="number"
                            value={edu.percentage}
                            onChange={(e) => handleArrayChange('education', index, 'percentage', e.target.value)}
                            placeholder="% / CGPA"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* Experience */}
            {currentSection === 'experience' && (
              <motion.div
                key="experience"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400 text-sm">Add your work history</p>
                  <button
                    onClick={() => addArrayItem('experience', { company: '', designation: '', fromDate: '', toDate: '', reasonForLeaving: '' })}
                    className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg"
                  >
                    + Add
                  </button>
                </div>

                {formData.experience.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-6 text-center">
                    <p className="text-gray-500 text-sm">No experience added yet</p>
                    <p className="text-gray-400 text-xs mt-1">Click "+ Add" for previous jobs</p>
                  </div>
                ) : (
                  formData.experience.map((exp, index) => (
                    <div key={index} className="bg-white rounded-2xl p-4 border border-gray-100 relative">
                      <button
                        onClick={() => removeArrayItem('experience', index)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <p className="text-gray-400 text-xs font-medium mb-3">Experience {index + 1}</p>
                      
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => handleArrayChange('experience', index, 'company', e.target.value)}
                          placeholder="Company Name"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                        />
                        <input
                          type="text"
                          value={exp.designation}
                          onChange={(e) => handleArrayChange('experience', index, 'designation', e.target.value)}
                          placeholder="Designation/Role"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-gray-400 text-[10px] block mb-1">From</label>
                            <input
                              type="date"
                              value={exp.fromDate ? new Date(exp.fromDate).toISOString().split('T')[0] : ''}
                              onChange={(e) => handleArrayChange('experience', index, 'fromDate', e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-gray-400 text-[10px] block mb-1">To</label>
                            <input
                              type="date"
                              value={exp.toDate ? new Date(exp.toDate).toISOString().split('T')[0] : ''}
                              onChange={(e) => handleArrayChange('experience', index, 'toDate', e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={exp.reasonForLeaving}
                          onChange={(e) => handleArrayChange('experience', index, 'reasonForLeaving', e.target.value)}
                          placeholder="Reason for leaving"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm"
                        />
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Navigation (Fixed) */}
        <div className="p-4 bg-white border-t border-gray-100">
          {/* Show different UI based on status */}
          {isLocked && profileStatus === 'approved' ? (
            // Approved - Show verified badge
            <div className="text-center py-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
                <span className="text-emerald-700 font-semibold">Verified Employee</span>
              </div>
            </div>
          ) : isLocked && profileStatus === 'pending' ? (
            // Pending - Show waiting message
            <div className="text-center py-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <svg className="w-5 h-5 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-amber-700 font-medium">Awaiting HR Verification</span>
              </div>
            </div>
          ) : (
            // Draft/Rejected - Show navigation buttons
            <>
              <div className="flex gap-3">
                {/* Back Button */}
                {!isFirstStep && (
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={handleBack}
                    className="flex-1 py-4 bg-gray-100 text-gray-700 font-semibold rounded-2xl flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </motion.button>
                )}

                {/* Next / Submit Buttons */}
                {canSubmit && !isLastStep ? (
                  // From step 5 onwards, show both Continue (optional) and Submit buttons
                  <>
                    <motion.button
                      layout
                      onClick={handleNext}
                      disabled={saving}
                      className="flex-1 py-4 bg-gray-100 text-gray-700 font-semibold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      Continue
                      <span className="text-xs text-gray-400">(Optional)</span>
                    </motion.button>
                    <motion.button
                      layout
                      onClick={handleFinalSubmit}
                      disabled={saving || submitting}
                      className="flex-1 py-4 bg-emerald-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Submit
                        </>
                      )}
                    </motion.button>
                  </>
                ) : (
                  // Regular Next or Final Submit button
                  <motion.button
                    layout
                    onClick={isLastStep ? handleFinalSubmit : handleNext}
                    disabled={saving || submitting}
                    className={`flex-1 py-4 font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all ${
                      isLastStep 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-black text-white'
                    } ${isFirstStep ? 'flex-[2]' : ''} disabled:opacity-50`}
                  >
                    {saving || submitting ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {submitting ? 'Submitting...' : 'Saving...'}
                      </>
                    ) : isLastStep ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Submit for Verification
                      </>
                    ) : (
                      <>
                        Next
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </motion.button>
                )}
              </div>

              {/* Step Indicator Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentStep 
                        ? 'w-6 bg-black' 
                        : idx < currentStep 
                          ? 'bg-emerald-500' 
                          : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <AnimatePresence>
          {showChangePassword && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowChangePassword(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-black w-full max-w-sm rounded-2xl p-6 border border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-white text-lg font-bold mb-2">Change Password</h2>
                <p className="text-white/60 text-sm mb-4">Use your current password and set a new one.</p>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <input
                    type="password"
                    value={changeForm.oldPassword}
                    onChange={(e) => setChangeForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                    placeholder="Old password"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                    required
                  />
                  <input
                    type="password"
                    value={changeForm.newPassword}
                    onChange={(e) => setChangeForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="New password"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                    required
                  />
                  <input
                    type="password"
                    value={changeForm.confirmPassword}
                    onChange={(e) => setChangeForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm new password"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                    required
                  />
                  {changeMsg && (
                    <div className="text-xs text-white/70 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      {changeMsg}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={changeLoading}
                    className="w-full bg-white text-black py-3 rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-60"
                  >
                    {changeLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showForgotPassword && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowForgotPassword(false)}
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
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm focus:outline-none"
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
    </div>
  )
}

export default ProfileDetails
