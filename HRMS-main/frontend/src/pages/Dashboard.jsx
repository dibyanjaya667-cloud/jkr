import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Cropper from 'react-easy-crop'
import axios from 'axios'
import { API_URL } from '../lib/api'
import { downloadPayslipImage, openPayslipImage } from '../lib/payslipImage'
import { isStorageConfigured, uploadFileToStorage } from '../lib/storage'
import Wall from '../components/Wall'

const createImage = (url) => new Promise((resolve, reject) => {
  const image = new Image()
  image.addEventListener('load', () => resolve(image))
  image.addEventListener('error', (error) => reject(error))
  image.setAttribute('crossOrigin', 'anonymous')
  image.src = url
})

const getCroppedBlob = async (imageSrc, pixelCrop) => {
  if (!imageSrc || !pixelCrop?.width || !pixelCrop?.height) return null
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
  })
}

// ============ PROFESSIONAL SKELETON LOADER COMPONENTS ============
const SkeletonPulse = ({ className }) => (
  <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded ${className}`} />
)

// Dashboard Stats Card Skeleton
const StatsCardSkeleton = () => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
    <div className="flex items-center gap-3 mb-3">
      <SkeletonPulse className="w-10 h-10 rounded-xl" />
      <SkeletonPulse className="h-4 w-20 rounded" />
    </div>
    <SkeletonPulse className="h-8 w-24 rounded mb-2" />
    <SkeletonPulse className="h-3 w-16 rounded" />
  </div>
)

// Attendance Card Skeleton
const AttendanceCardSkeleton = () => (
  <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <SkeletonPulse className="h-5 w-32 rounded" />
      <SkeletonPulse className="h-6 w-20 rounded-full" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white/80 rounded-xl p-3">
        <SkeletonPulse className="h-3 w-16 rounded mb-2" />
        <SkeletonPulse className="h-6 w-20 rounded" />
      </div>
      <div className="bg-white/80 rounded-xl p-3">
        <SkeletonPulse className="h-3 w-16 rounded mb-2" />
        <SkeletonPulse className="h-6 w-20 rounded" />
      </div>
    </div>
  </div>
)

// Punch Button Skeleton
const PunchButtonSkeleton = () => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
    <div className="flex gap-3">
      <SkeletonPulse className="flex-1 h-14 rounded-xl" />
      <SkeletonPulse className="flex-1 h-14 rounded-xl" />
    </div>
  </div>
)

// Quick Actions Skeleton
const QuickActionsSkeleton = () => (
  <div className="grid grid-cols-4 gap-3">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex flex-col items-center gap-2">
        <SkeletonPulse className="w-12 h-12 rounded-xl" />
        <SkeletonPulse className="h-3 w-10 rounded" />
      </div>
    ))}
  </div>
)

// Inbox Item Skeleton
const InboxItemSkeleton = () => (
  <div className="flex items-center gap-3 p-4 bg-white rounded-2xl">
    <SkeletonPulse className="w-12 h-12 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <SkeletonPulse className="h-4 w-3/4 rounded" />
      <SkeletonPulse className="h-3 w-1/2 rounded" />
    </div>
    <SkeletonPulse className="h-3 w-12 rounded" />
  </div>
)

// Profile Info Skeleton
const ProfileInfoSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-4">
      <SkeletonPulse className="w-20 h-20 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <SkeletonPulse className="h-6 w-3/4 rounded" />
        <SkeletonPulse className="h-4 w-1/2 rounded" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-gray-50 rounded-xl p-3">
          <SkeletonPulse className="h-3 w-16 rounded mb-2" />
          <SkeletonPulse className="h-5 w-24 rounded" />
        </div>
      ))}
    </div>
  </div>
)

// Attendance History Skeleton
const AttendanceHistorySkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <SkeletonPulse className="h-4 w-24 rounded" />
          <SkeletonPulse className="h-6 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <SkeletonPulse className="h-3 w-12 rounded mb-1" />
            <SkeletonPulse className="h-5 w-16 rounded" />
          </div>
          <div>
            <SkeletonPulse className="h-3 w-12 rounded mb-1" />
            <SkeletonPulse className="h-5 w-16 rounded" />
          </div>
          <div>
            <SkeletonPulse className="h-3 w-12 rounded mb-1" />
            <SkeletonPulse className="h-5 w-16 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

// Weekly Analytics Skeleton
const WeeklyAnalyticsSkeleton = () => (
  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl p-4 mb-4 shadow-lg">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <SkeletonPulse className="w-8 h-8 rounded-lg" />
        <SkeletonPulse className="h-5 w-28 rounded" />
      </div>
      <div className="flex gap-1">
        <SkeletonPulse className="h-7 w-16 rounded-full" />
        <SkeletonPulse className="h-7 w-16 rounded-full" />
      </div>
    </div>
    {/* Chart Area */}
    <div className="flex items-end justify-between gap-2 h-32 mb-3">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <SkeletonPulse 
            className="w-full rounded-t-lg" 
            style={{ height: `${Math.random() * 60 + 30}%` }} 
          />
          <SkeletonPulse className="h-3 w-6 rounded mt-2" />
        </div>
      ))}
    </div>
    {/* Stats Row */}
    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
      <div className="text-center">
        <SkeletonPulse className="h-6 w-12 rounded mx-auto mb-1" />
        <SkeletonPulse className="h-3 w-16 rounded mx-auto" />
      </div>
      <div className="text-center">
        <SkeletonPulse className="h-6 w-12 rounded mx-auto mb-1" />
        <SkeletonPulse className="h-3 w-16 rounded mx-auto" />
      </div>
      <div className="text-center">
        <SkeletonPulse className="h-6 w-12 rounded mx-auto mb-1" />
        <SkeletonPulse className="h-3 w-16 rounded mx-auto" />
      </div>
    </div>
  </div>
)

// Calendar Skeleton
const CalendarSkeleton = () => (
  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm mb-4">
    {/* Month Header */}
    <div className="flex items-center justify-between mb-3">
      <SkeletonPulse className="w-8 h-8 rounded-lg" />
      <SkeletonPulse className="h-5 w-28 rounded" />
      <SkeletonPulse className="w-8 h-8 rounded-lg" />
    </div>
    {/* Day Labels */}
    <div className="grid grid-cols-7 gap-1 mb-2">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((_, i) => (
        <SkeletonPulse key={i} className="h-4 w-4 rounded mx-auto" />
      ))}
    </div>
    {/* Calendar Grid */}
    <div className="grid grid-cols-7 gap-1">
      {Array(35).fill(null).map((_, i) => (
        <SkeletonPulse key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  </div>
)

// Full Page Loading Skeleton
const DashboardSkeleton = () => (
  <div className="min-h-screen bg-black flex justify-center">
    <div className="relative w-full max-w-md h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col overflow-hidden md:my-4 md:h-[calc(100vh-2rem)] md:rounded-[28px] md:border md:border-white/10 md:shadow-2xl">
      {/* Header Skeleton */}
      <div className="bg-black/95 px-4 py-3 flex items-center justify-between rounded-b-2xl">
        <div className="flex items-center gap-3">
          <SkeletonPulse className="w-9 h-9 rounded-xl !bg-white/20" />
          <div className="space-y-1">
            <SkeletonPulse className="h-4 w-24 rounded !bg-white/20" />
            <SkeletonPulse className="h-3 w-16 rounded !bg-white/10" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonPulse className="w-10 h-10 rounded-xl !bg-white/10" />
          <SkeletonPulse className="w-10 h-10 rounded-xl !bg-white/10" />
        </div>
      </div>
      
      {/* Content Skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Actions Card */}
        <QuickActionsSkeleton />
        
        {/* Punch Buttons */}
        <PunchButtonSkeleton />
        
        {/* Weekly Analytics */}
        <WeeklyAnalyticsSkeleton />
        
        {/* OT Card */}
        <SkeletonPulse className="h-20 w-full rounded-2xl" />
        
        {/* Calendar */}
        <CalendarSkeleton />
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
      </div>
      
      {/* Bottom Nav Skeleton */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/95 backdrop-blur-xl rounded-t-3xl px-4 py-3 border-t border-white/10">
        <div className="flex justify-around">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <SkeletonPulse className="w-6 h-6 rounded !bg-white/20" />
              <SkeletonPulse className="h-2 w-8 rounded !bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)
// ============ END SKELETON COMPONENTS ============


// Avatar color palette - vibrant colors like in the reference image
const avatarColors = [
  'from-orange-400 to-orange-600',
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600',
  'from-pink-400 to-pink-600',
  'from-amber-400 to-amber-600',
  'from-cyan-400 to-cyan-600',
  'from-rose-400 to-rose-600',
  'from-indigo-400 to-indigo-600',
  'from-teal-400 to-teal-600',
  'from-fuchsia-400 to-fuchsia-600',
  'from-lime-400 to-lime-600',
]

// Get consistent color for a user based on their ID or name
const getAvatarColor = (user) => {
  const str = user?._id || user?.email || user?.name || 'default'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

// Get initials: first letter of first name + first letter of last name
// If no last name, use first 2 letters of first name
const getInitials = (user) => {
  const name = user?.name || user?.email?.split('@')[0] || ''
  if (!name) return '?'
  
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }
  // Only one word - take first 2 characters
  return name.slice(0, 2).toUpperCase()
}

// Office timings configuration
const OFFICE_CONFIG = {
  startHour: 9,      // 9 AM
  startMin: 0,
  endHour: 18,       // 6:30 PM
  endMin: 30,
  overtimeGraceMinutes: 60, // Minimum threshold minutes (no OT until duty end + this)
  workDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday (0 = Sunday)
}

const computeOvertimeMinutesFallback = (record, options = {}) => {
  if (!record?.punchIn?.time) return 0

  const punchInTime = new Date(record.punchIn.time)
  if (Number.isNaN(punchInTime.getTime())) return 0

  let punchOutTime = record?.punchOut?.time ? new Date(record.punchOut.time) : null
  if (punchOutTime && Number.isNaN(punchOutTime.getTime())) punchOutTime = null

  // For *today* while still working, treat punch-out time as now (to show live OT).
  if (!punchOutTime && options.assumeNowIfNoPunchOut) {
    const now = new Date()
    const recordDay = new Date(punchInTime)
    if (recordDay.toDateString() === now.toDateString()) {
      const cutoff = new Date(recordDay)
      cutoff.setHours(23, 59, 59, 999)
      punchOutTime = now.getTime() > cutoff.getTime() ? cutoff : now
    }
  }

  if (!punchOutTime) return 0

  const totalWorkedMinutes = Math.max(0, Math.floor((punchOutTime - punchInTime) / (1000 * 60)))

  // Sunday: all worked minutes are OT
  if (punchOutTime.getDay() === 0) {
    return totalWorkedMinutes
  }

  // Mon–Sat OT policy (matches backend):
  // 1) Time-based OT:
  //    - Duty end is 6:30 PM
  //    - If punch-out is before/at 7:30 PM => 0 OT
  //    - If after 7:30 PM => OT = minutes after 6:30 PM
  // 2) Duration-based OT:
  //    - Any minutes worked beyond shift duration (9h 30m)
  // Final OT = max(time-based, duration-based)
  const dutyEnd = new Date(punchInTime)
  dutyEnd.setHours(OFFICE_CONFIG.endHour, OFFICE_CONFIG.endMin, 0, 0)
  const thresholdEnd = new Date(dutyEnd)
  thresholdEnd.setMinutes(thresholdEnd.getMinutes() + (OFFICE_CONFIG.overtimeGraceMinutes || 0))
  const timeBasedOT = punchOutTime.getTime() <= thresholdEnd.getTime()
    ? 0
    : Math.max(0, Math.floor((punchOutTime - dutyEnd) / (1000 * 60)))

  const shiftMinutes = ((OFFICE_CONFIG.endHour * 60 + OFFICE_CONFIG.endMin) - (OFFICE_CONFIG.startHour * 60 + OFFICE_CONFIG.startMin))
  const durationBasedOT = Math.max(0, totalWorkedMinutes - shiftMinutes)

  return Math.max(timeBasedOT, durationBasedOT)
}

const getOvertimeMinutes = (record, options = {}) => {
  if (!record) return 0
  const status = record?.punchOut?.overtimeStatus || (record?.punchOut?.overtimeMinutes > 0 ? 'pending' : 'none')
  const adjusted = typeof record?.punchOut?.overtimeAdjustedMinutes === 'number'
    ? record.punchOut.overtimeAdjustedMinutes
    : null
  const stored = typeof record?.punchOut?.overtimeMinutes === 'number'
    ? record.punchOut.overtimeMinutes
    : null
  const computed = computeOvertimeMinutesFallback(record, options)
  if (record?.punchOut?.time) {
    if (status !== 'approved') return 0
    const base = typeof adjusted === 'number' ? adjusted : stored
    return typeof base === 'number' ? Math.max(base, computed || 0) : (computed || 0)
  }
  return computed || 0
}

// Live Productive Hours Timer Component
function ProductiveTimer({ punchInTime, punchOutTime, attendanceDate, punchOutMissing }) {
  const [elapsed, setElapsed] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const tick = () => setCurrentTime(new Date())
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!punchInTime) {
      setElapsed({ hours: 0, minutes: 0, seconds: 0 })
      return
    }

    const startTime = new Date(punchInTime)
    if (Number.isNaN(startTime.getTime())) {
      setElapsed({ hours: 0, minutes: 0, seconds: 0 })
      return
    }

    const cutoff = new Date(startTime)
    cutoff.setHours(23, 59, 59, 999)

    const updateTimer = () => {
      const now = new Date()
      const endTime = punchOutTime
        ? new Date(punchOutTime)
        : (now.getTime() > cutoff.getTime() ? cutoff : now)

      const diff = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000))
      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60
      setElapsed({ hours, minutes, seconds })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [punchInTime, punchOutTime, attendanceDate])

  const formatNum = (n) => n.toString().padStart(2, '0')
  const totalMins = elapsed.hours * 60 + elapsed.minutes
  const targetMins = 9 * 60 + 30 // 9.5 hours
  const progress = Math.min((totalMins / targetMins) * 100, 100)
  const remainingMins = Math.max(targetMins - totalMins, 0)
  const remainingH = Math.floor(remainingMins / 60)
  const remainingM = remainingMins % 60
  const isMissingPunchOut = (() => {
    if (!punchInTime) return false
    if (punchOutMissing) return true
    if (punchOutTime) return false
    const now = new Date()
    const cutoff = new Date(punchInTime)
    cutoff.setHours(23, 59, 59, 999)
    return now.getTime() > cutoff.getTime()
  })()

  // Calculate real clock hand angles
  const hours12 = currentTime.getHours() % 12
  const mins = currentTime.getMinutes()
  const secs = currentTime.getSeconds()
  const hourAngle = (hours12 * 30) + (mins * 0.5) + (secs * (0.5 / 60))
  const minuteAngle = (mins * 6) + (secs * 0.1)
  // Use continuous angle to avoid wrap-around "spin" at 59 -> 0
  const totalSeconds = (currentTime.getHours() * 3600) + (mins * 60) + secs
  const secondAngle = totalSeconds * 6

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden bg-white rounded-3xl p-4 mb-4 shadow-xl border border-gray-100/80"
    >
      {/* Lottie background - more visible */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60">
        <dotlottie-wc
          src="https://lottie.host/8ac5ad5a-dc23-472c-8ccc-09ab2a007702/Ecn49ZGxQZ.lottie"
          autoplay
          loop
          style={{ width: '320%', height: '320%' }}
        ></dotlottie-wc>
      </div>

      {/* Lighter overlay so Lottie shows through */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/45 via-white/35 to-gray-50/45" />

      {/* Animated corner accent */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 rounded-full blur-2xl"
      />

      <div className="relative z-10 flex items-center gap-4">
        {/* Real Time Clock - Black themed */}
        <div className="relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center shadow-xl shadow-gray-900/30"
          >
            {/* Real time clock face */}
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
              {/* Clock circle */}
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" fill="none" />
              
              {/* Hour markers */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
                <line
                  key={i}
                  x1="12"
                  y1="3"
                  x2="12"
                  y2={i % 3 === 0 ? "4.5" : "4"}
                  stroke="white"
                  strokeWidth={i % 3 === 0 ? "1.5" : "0.75"}
                  transform={`rotate(${angle} 12 12)`}
                />
              ))}
              
              {/* Hour hand - real time */}
              <line
                x1="12" y1="12" x2="12" y2="7"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                transform={`rotate(${hourAngle} 12 12)`}
              />
              
              {/* Minute hand - real time */}
              <line
                x1="12" y1="12" x2="12" y2="5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                transform={`rotate(${minuteAngle} 12 12)`}
              />
              
              {/* Second hand - real time with smooth animation */}
              <line
                x1="12" y1="12" x2="12" y2="4"
                stroke="#10B981"
                strokeWidth="1"
                strokeLinecap="round"
                transform={`rotate(${secondAngle} 12 12)`}
              />
              
              {/* Center dot */}
              <circle cx="12" cy="12" r="1.5" fill="#10B981" />
            </svg>
          </motion.div>

          {/* Pulsing live indicator */}
          <motion.span
            animate={{ 
              scale: [1, 1.3, 1],
              boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.4)', '0 0 0 8px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"
          />
        </div>

        {/* Timer Display */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-gray-800 text-xs font-bold uppercase tracking-wider"
            >
              Productive Time
            </motion.span>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded-full"
            >
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-emerald-700 text-[10px] font-bold">LIVE</span>
            </motion.div>
          </div>

          <div className="flex items-baseline gap-1">
            <motion.span
              key={`hours-${elapsed.hours}`}
              initial={{ y: -10, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="text-3xl font-black text-gray-900 tabular-nums tracking-tight"
            >{formatNum(elapsed.hours)}</motion.span>
            <motion.span 
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-gray-500 text-2xl font-bold"
            >:</motion.span>
            <motion.span
              key={`mins-${elapsed.minutes}`}
              initial={{ y: -10, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="text-3xl font-black text-gray-900 tabular-nums tracking-tight"
            >{formatNum(elapsed.minutes)}</motion.span>
            <motion.span 
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-gray-500 text-2xl font-bold"
            >:</motion.span>
            <motion.span
              key={`secs-${elapsed.seconds}`}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="text-3xl font-black text-emerald-600 tabular-nums tracking-tight"
            >{formatNum(elapsed.seconds)}</motion.span>
          </div>
        </div>

        {/* Progress Ring */}
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90">
            <circle cx="28" cy="28" r="24" stroke="rgba(0,0,0,0.1)" strokeWidth="5" fill="none" />
            <motion.circle
              cx="28" cy="28" r="24"
              stroke="url(#progressGradientNew)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={151}
              initial={{ strokeDashoffset: 151 }}
              animate={{ strokeDashoffset: 151 - (progress * 1.51) }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id="progressGradientNew" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span 
              key={Math.round(progress)}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold text-gray-900"
            >{Math.round(progress)}%</motion.span>
          </div>
        </div>
      </div>

      {/* Bottom status bar - more visible colors */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-3 flex items-center justify-between"
      >
        <div className="relative overflow-hidden flex items-center gap-2 bg-black/85 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10 shadow-lg shadow-black/20">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/18 to-transparent rotate-12 blur-md"
            animate={{ x: ['-40%', '260%'] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
          />
          <svg className={`relative z-10 w-3.5 h-3.5 ${isMissingPunchOut ? 'text-rose-300' : 'text-amber-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="relative z-10 text-white text-xs font-extrabold tracking-wide">
            {isMissingPunchOut ? 'Punch-out missing' : (progress >= 100 ? 'Target achieved!' : `${remainingH}h ${remainingM}m remaining`)}
          </span>
        </div>

        <div className="relative overflow-hidden flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10 shadow-lg shadow-black/20">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/16 to-transparent rotate-12 blur-md"
            animate={{ x: ['-60%', '240%'] }}
            transition={{ duration: 3.0, repeat: Infinity, ease: 'linear' }}
          />
          <svg className="relative z-10 w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="relative z-10 text-white text-xs font-extrabold tracking-wide">Target: 9h 30m</span>
        </div>
      </motion.div>

      {/* Late Status Badge */}
      {punchInTime && (() => {
        const time = new Date(punchInTime)
        const hours = time.getHours()
        const minutes = time.getMinutes()
        const totalMins = hours * 60 + minutes
        const target = 9 * 60
        let statusLabel, statusColor, statusIcon, statusBg
        
        if (totalMins <= target + 10) {
          statusLabel = 'On Time'
          statusColor = 'from-emerald-500 to-emerald-600'
          statusBg = 'bg-emerald-50/80'
          statusIcon = (
            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          )
        } else if (totalMins <= target + 45) {
          statusLabel = 'Slight Late'
          statusColor = 'from-amber-500 to-amber-600'
          statusBg = 'bg-amber-50/80'
          statusIcon = (
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )
        } else if (totalMins <= target + 60) {
          statusLabel = 'Late'
          statusColor = 'from-orange-500 to-orange-600'
          statusBg = 'bg-orange-50/80'
          statusIcon = (
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        } else {
          statusLabel = 'Very Late'
          statusColor = 'from-red-500 to-red-600'
          statusBg = 'bg-red-50/80'
          statusIcon = (
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )
        }
        
        return (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
            className="mt-3"
          >
            <div className={`relative overflow-hidden ${statusBg} backdrop-blur-sm border-2 border-white/60 rounded-2xl px-4 py-3 shadow-lg`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${statusColor} flex items-center justify-center shadow-md`}>
                    {statusIcon}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Arrival Status</p>
                    <p className="text-sm font-extrabold text-gray-900">{statusLabel}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium">Punched at</p>
                  <p className="text-sm font-bold text-gray-900">{new Date(punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })()}
    </motion.div>
  )
}

// Weekly Analytics Graph Component
function WeeklyAnalytics({ attendanceHistory }) {
  const toLocalDateKey = (d) => {
    const dt = new Date(d)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const fromLocalDateKey = (key) => {
    const [y, m, d] = key.split('-').map((v) => parseInt(v, 10))
    if (!y || !m || !d) return new Date()
    return new Date(y, m - 1, d)
  }

  const [range, setRange] = useState('week')
  const [selectedDateKey, setSelectedDateKey] = useState(() => toLocalDateKey(new Date()))

  // Keep analytics "live" for today when punch-out is missing.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const { rangeData, maxHours, selectedRecord, selectedSummary, totals } = useMemo(() => {
    const today = now
    const safeSelectedKey = selectedDateKey || toLocalDateKey(today)
    const anchorDate = fromLocalDateKey(safeSelectedKey)
    const rangeDays = range === 'month' ? 30 : 7
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    const historyMap = new Map(
      (attendanceHistory || []).map((a) => [toLocalDateKey(a.date), a])
    )

    const findRecordByKey = (key) => historyMap.get(key) || null

    const makeSummary = (record, dateKey) => {
      const date = fromLocalDateKey(dateKey)
      const isToday = toLocalDateKey(date) === toLocalDateKey(today)

      const punchInTime = record?.punchIn?.time ? new Date(record.punchIn.time) : null
      const cutoff = new Date(date)
      cutoff.setHours(23, 59, 59, 999)
      const missingPunchOut = record?.punchOut?.suspectReason === 'MISSING_PUNCH_OUT'

      const punchOutTime = record?.punchOut?.time
        ? new Date(record.punchOut.time)
        : missingPunchOut && punchInTime
          ? cutoff
          : isToday && punchInTime
            ? (today.getTime() > cutoff.getTime() ? cutoff : today)
            : null

      let workHours = 0
      let status = 'absent'

      if (punchInTime && punchOutTime) {
        const totalMins = Math.max(0, (punchOutTime - punchInTime) / (1000 * 60))
        workHours = totalMins / 60
        status = record?.punchOut?.time ? 'completed' : 'working'
      } else if (punchInTime && !punchOutTime) {
        status = 'working'
      }

      const workHoursCapped = Math.min(workHours, 9.5)
      const otMins = getOvertimeMinutes(record, { assumeNowIfNoPunchOut: true })
      const otHours = otMins / 60

      return {
        dateKey,
        date,
        day: days[date.getDay()],
        dateNum: date.getDate(),
        labelShort: range === 'month' ? String(date.getDate()) : days[date.getDay()],
        isSunday: date.getDay() === 0,
        isToday,
        status,
        workHours: parseFloat(workHoursCapped.toFixed(1)),
        otHours: parseFloat(otHours.toFixed(1)),
        total: parseFloat((workHoursCapped + otHours).toFixed(1)),
      }
    }

    const list = []
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(anchorDate)
      d.setDate(anchorDate.getDate() - i)
      const key = toLocalDateKey(d)
      const record = findRecordByKey(key)
      list.push(makeSummary(record, key))
    }

    const max = Math.max(...list.map((d) => d.total), 10)

    const selectedRec = findRecordByKey(safeSelectedKey)
    const selectedSum = makeSummary(selectedRec, safeSelectedKey)

    const totalWork = list.reduce((sum, d) => sum + d.workHours, 0)
    const totalOT = list.reduce((sum, d) => sum + d.otHours, 0)
    const daysWorked = list.filter((d) => d.total > 0).length

    return {
      rangeData: list,
      maxHours: max,
      selectedRecord: selectedRec,
      selectedSummary: selectedSum,
      totals: {
        totalWork: totalWork.toFixed(1),
        totalOT: totalOT.toFixed(1),
        daysWorked,
      },
    }
  }, [attendanceHistory, range, selectedDateKey, now])

  const formatTime = (d) => {
    if (!d) return '--:--'
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const isAfterMissedPunchOutCutoff = (dayDate, nowDate) => {
    if (!dayDate || !nowDate) return false
    const cutoff = new Date(dayDate)
    cutoff.setHours(23, 59, 59, 999)
    return nowDate.getTime() > cutoff.getTime()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-3xl p-4 mb-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Analytics</h3>
          <p className="text-gray-400 text-xs">Weekly / Monthly + date wise</p>
        </div>

        <div className="inline-flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setRange('week')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              range === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setRange('month')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              range === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-violet-500"></span>
            <span className="text-gray-500">Work</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-500"></span>
            <span className="text-gray-500">OT</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Date</label>
          <input
            type="date"
            value={selectedDateKey}
            onChange={(e) => setSelectedDateKey(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg"
          />
        </div>
      </div>

      <div className={`h-32 ${range === 'month' ? 'overflow-x-auto' : ''}`}>
        <div className={`flex items-end justify-between gap-2 h-32 ${range === 'month' ? 'min-w-[720px] pr-2' : ''}`}>
          {rangeData.map((d) => {
            const isSelected = d.dateKey === selectedDateKey
            return (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setSelectedDateKey(d.dateKey)}
                className="flex-1 flex flex-col items-center outline-none"
              >
                <div className={`relative w-full flex flex-col items-center justify-end h-24 ${isSelected ? 'ring-2 ring-blue-400/60 rounded-xl' : ''}`}>
                  {d.otHours > 0 && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.otHours / maxHours) * 100}%` }}
                      transition={{ duration: 0.35 }}
                      className="w-full max-w-[28px] bg-gradient-to-t from-amber-500 to-orange-400 rounded-t-lg"
                      title={`OT: ${d.otHours}h`}
                    />
                  )}

                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.workHours / maxHours) * 100}%` }}
                    transition={{ duration: 0.35 }}
                    className={`w-full max-w-[28px] rounded-t-lg ${
                      d.isSunday
                        ? 'bg-gradient-to-t from-rose-500 to-pink-400'
                        : 'bg-gradient-to-t from-violet-600 to-purple-500'
                    } ${d.otHours > 0 ? 'rounded-t-none' : ''}`}
                    title={`Work: ${d.workHours}h`}
                  />

                  {d.total > 0 && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute -top-5 text-[10px] font-bold text-gray-600"
                    >
                      {d.total}h
                    </motion.span>
                  )}
                </div>

                <div className={`mt-2 text-center ${d.isToday ? 'bg-violet-100 rounded-lg px-1.5 py-0.5' : ''}`}>
                  <p className={`text-[10px] font-bold ${
                    d.isToday ? 'text-violet-600' : d.isSunday ? 'text-rose-500' : 'text-gray-600'
                  }`}>
                    {d.labelShort}
                  </p>
                  <p className="text-[9px] text-gray-400">{range === 'month' ? '' : d.dateNum}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 bg-gray-50 border border-gray-100 rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-800">
              {selectedSummary.day} • {selectedSummary.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-[11px] text-gray-500">
              Status: <span className="font-semibold text-gray-700">{selectedSummary.status}</span>
              {selectedSummary.status === 'working' && !selectedRecord?.punchOut?.time ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Live (not punched out)
                </span>
              ) : null}
              {(() => {
                const missing = selectedRecord?.punchOut?.suspectReason === 'MISSING_PUNCH_OUT'
                if (missing) {
                  return (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Missed punch-out
                    </span>
                  )
                }
                if (!!selectedRecord?.punchIn?.time && !selectedRecord?.punchOut?.time && isAfterMissedPunchOutCutoff(selectedSummary.date, now)) {
                  return (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Missed punch-out
                    </span>
                  )
                }
                return null
              })()}
              {selectedSummary.isSunday ? ' • Sunday OT' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-800">{selectedSummary.total}h</p>
            <p className="text-[11px] text-gray-500">Work {selectedSummary.workHours}h • OT {selectedSummary.otHours}h</p>
            {selectedSummary.status === 'working' && !selectedRecord?.punchOut?.time ? (
              <p className="mt-0.5 text-[10px] text-gray-400">
                Work/OT keeps running until you punch out.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 p-2">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Punch In</p>
            <p className="text-sm font-bold text-gray-800">{formatTime(selectedRecord?.punchIn?.time)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-2">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Punch Out</p>
            <p className={`text-sm font-bold ${selectedRecord?.punchOut?.suspectReason === 'MISSING_PUNCH_OUT' ? 'text-rose-500' : 'text-gray-800'}`}>
              {selectedRecord?.punchOut?.suspectReason === 'MISSING_PUNCH_OUT'
                ? 'Missing'
                : formatTime(selectedRecord?.punchOut?.time)
              }
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-lg font-bold text-violet-600">{totals.totalWork}h</p>
          <p className="text-[10px] text-gray-400">Total Work</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-amber-600">{totals.totalOT}h</p>
          <p className="text-[10px] text-gray-400">Total OT</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{totals.daysWorked}</p>
          <p className="text-[10px] text-gray-400">Days Worked</p>
        </div>
      </div>
    </motion.div>
  )
}

// Compact Attendance Calendar Component (in scrollable content)
function AttendanceCalendar({ attendanceHistory }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Build calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    
    // Create attendance map
    const attendanceMap = {}
    attendanceHistory?.forEach((record) => {
      const dateKey = new Date(record.date).toDateString()
      const hasIn = !!record.punchIn?.time
      const hasOut = !!record.punchOut?.time
      
      // Late detection: punch-in after 9:10 AM
      let isLate = false
      if (hasIn) {
        const punchTime = new Date(record.punchIn.time)
        const mins = punchTime.getHours() * 60 + punchTime.getMinutes()
        isLate = mins > 9 * 60 + 10 // after 9:10 AM
      }
      
      attendanceMap[dateKey] = {
        present: hasIn,
        hasOut,
        isLate,
      }
    })

    const days = []
    
    // Padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push({ empty: true })
    }
    
    // Days of the month
    const today = new Date()
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d)
      const dateKey = date.toDateString()
      const record = attendanceMap[dateKey]
      const isToday = date.toDateString() === today.toDateString()
      const isFuture = date > today
      const isSunday = date.getDay() === 0
      
      days.push({
        date,
        day: d,
        isToday,
        isFuture,
        isSunday,
        present: record?.present || false,
        hasOut: record?.hasOut || false,
        isLate: record?.isLate || false,
      })
    }
    
    return days
  }, [currentMonth, attendanceHistory])

  // Count stats for this month
  const stats = useMemo(() => {
    let presentDays = 0
    let absentDays = 0
    let lateDays = 0
    let onTimeDays = 0
    let sundayDays = 0
    let halfDays = 0 // present but no punch-out
    
    calendarDays.forEach((day) => {
      if (day.empty || day.isFuture) return
      if (day.isSunday) { sundayDays++; return }
      if (day.present) {
        presentDays++
        if (day.isLate) lateDays++
        else onTimeDays++
        if (!day.hasOut && !day.isToday) halfDays++
      } else {
        absentDays++
      }
    })
    
    return { presentDays, absentDays, lateDays, onTimeDays, sundayDays, halfDays }
  }, [calendarDays])

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    if (next <= new Date()) {
      setCurrentMonth(next)
    }
  }

  // Get cell color based on status
  const getCellClass = (day) => {
    if (day.isFuture) return 'bg-white/5 text-white/20'
    if (day.isSunday) return 'bg-violet-500/30 text-violet-300'
    if (day.present && day.isLate) return 'bg-amber-500 text-white'
    if (day.present) return 'bg-emerald-500 text-white'
    return 'bg-red-500/40 text-red-200'
  }

  return (
    <div className="bg-black border border-white/10 rounded-2xl p-3 shadow-lg shadow-black/30">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-bold text-white/90 text-xs">
          {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button 
          onClick={nextMonth} 
          disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
        >
          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekDays.map((day, i) => (
          <div key={i} className={`text-center text-[8px] font-medium ${i === 0 ? 'text-violet-400' : 'text-white/40'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid - smaller cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, idx) => (
          <div key={idx}>
            {day.empty ? (
              <div className="w-full h-5"></div>
            ) : (
              <div
                className={`w-full h-5 rounded flex items-center justify-center text-[9px] font-medium ${getCellClass(day)} ${day.isToday ? 'ring-1 ring-cyan-400 ring-offset-1 ring-offset-black' : ''}`}
              >
                {day.day}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-2.5 text-[7px] text-white/60 flex-wrap">
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded bg-emerald-500"></span> Present ({stats.presentDays})
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded bg-red-500/60"></span> Absent ({stats.absentDays})
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded bg-amber-500"></span> Late ({stats.lateDays})
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded bg-violet-500/50"></span> Sunday ({stats.sundayDays})
        </span>
      </div>
    </div>
  )
}

function Dashboard({ onLogout }) {
  const [user, setUser] = useState(null)
  const [manager, setManager] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [profileTab, setProfileTab] = useState('time')
  const [punchShowCount, setPunchShowCount] = useState(10)
  const [punchOtOnly, setPunchOtOnly] = useState(false)
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [leaveStatus, setLeaveStatus] = useState({ onLeave: false, permissionAllowed: false, permissionNote: '' })
  const [leaveRequesting, setLeaveRequesting] = useState(false)
  const [leaveRequestSent, setLeaveRequestSent] = useState(false)
  const [punchLoading, setPunchLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [userSettings, setUserSettings] = useState({
    notificationsEnabled: true,
    emailAlerts: false,
    privacy: {
      showProfileToTeam: true,
      showOnlineStatus: true,
      shareLocation: false,
    },
  })
  const [notification, setNotification] = useState(null)
  const [liveLocation, setLiveLocation] = useState(null)
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmModal, setConfirmModal] = useState({ show: false, type: null })
  const [payslipModalOpen, setPayslipModalOpen] = useState(false)
  const [payslipAvailability, setPayslipAvailability] = useState({ canDownload: false, month: null })
  const [payslipLoading, setPayslipLoading] = useState(false)
  const [profileUploading, setProfileUploading] = useState(false)
  const [profileUploadProgress, setProfileUploadProgress] = useState(0)
  const [imagePreview, setImagePreview] = useState(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [pendingCropFile, setPendingCropFile] = useState(null)
  
  // Inbox state
  const [inboxCategory, setInboxCategory] = useState('all')
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState({ total: 0, byCategory: {} })
  const [inboxLoading, setInboxLoading] = useState(false)
  
  const navigate = useNavigate()

  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
  const getLeaveRequestKey = (userId, dateKey) => `leave_punch_req:${userId || 'me'}:${dateKey}`
  const toAssetUrl = (maybeRelativeUrl) => {
    if (!maybeRelativeUrl) return ''
    if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl
    const normalized = String(maybeRelativeUrl).startsWith('/') ? String(maybeRelativeUrl) : `/${maybeRelativeUrl}`
    return `${API_ORIGIN}${normalized}`
  }

  const openImagePreview = (src, label = 'Profile') => {
    if (!src) return
    setImagePreview({ src, label })
  }

  const closeImagePreview = () => setImagePreview(null)

  const openCropper = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropImageSrc(reader.result)
      setPendingCropFile(file)
      setCropOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const resetCropper = () => {
    setCropOpen(false)
    setCropImageSrc('')
    setCropZoom(1)
    setCrop({ x: 0, y: 0 })
    setCroppedAreaPixels(null)
    setPendingCropFile(null)
  }

  const uploadProfileFile = async (file) => {
    if (!file) return
    try {
      const token = localStorage.getItem('token')
      setProfileUploading(true)
      setProfileUploadProgress(0)
      let nextUrl = ''

      if (isStorageConfigured()) {
        const form = new FormData()
        form.append('file', file)
        form.append('folder', 'profile')
        const storageRes = await axios.post(`${API_URL}/storage/upload`, form, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          onUploadProgress: (evt) => {
            if (!evt.total) return
            const percent = Math.round((evt.loaded / evt.total) * 100)
            setProfileUploadProgress(percent)
          },
        })
        const uploadedUrl = storageRes?.data?.url
        const profileRes = await axios.post(
          `${API_URL}/auth/profile-pic-url`,
          { url: uploadedUrl },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        nextUrl = profileRes?.data?.profilePicUrl || uploadedUrl
      } else {
        const form = new FormData()
        form.append('file', file)
        const uploadRes = await axios.post(`${API_URL}/auth/profile-pic`, form, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          onUploadProgress: (evt) => {
            if (!evt.total) return
            const percent = Math.round((evt.loaded / evt.total) * 100)
            setProfileUploadProgress(percent)
          },
        })
        nextUrl = uploadRes?.data?.profilePicUrl
      }
      if (nextUrl) {
        setUser((prev) => {
          const nextUser = { ...(prev || {}), profilePicUrl: nextUrl }
          localStorage.setItem('user', JSON.stringify(nextUser))
          return nextUser
        })
      }
      showNotification('Profile picture updated', 'success')
      await fetchUserData()
    } catch (err) {
      console.error('Profile upload failed:', err)
      showNotification(err.response?.data?.message || 'Upload failed', 'error')
    } finally {
      setProfileUploading(false)
      setProfileUploadProgress(0)
    }
  }

  const handleCropSave = async () => {
    try {
      const blob = await getCroppedBlob(cropImageSrc, croppedAreaPixels)
      if (!blob) {
        showNotification('Crop failed', 'error')
        return
      }
      const fileName = pendingCropFile?.name || `profile-${Date.now()}.jpg`
      const file = new File([blob], fileName, { type: blob.type || pendingCropFile?.type || 'image/jpeg' })
      resetCropper()
      await uploadProfileFile(file)
    } catch (err) {
      console.error('Crop failed:', err)
      showNotification('Crop failed', 'error')
    }
  }

  const watchIdRef = useRef(null)
  const lastSentAtRef = useRef(0)
  const punchRangeInitializedRef = useRef(false)
  const profileInputRef = useRef(null)

  useEffect(() => {
    fetchUserData()
    fetchTodayAttendance()
    fetchAttendanceHistory()
    fetchLeaveStatus()
    fetchUserSettings() // Fetch user settings to enhance dashboard functionality
  }, [])

  useEffect(() => {
    if (!leaveStatus.onLeave || leaveStatus.permissionAllowed) return undefined
    const interval = setInterval(() => {
      fetchLeaveStatus()
    }, 30000)
    return () => clearInterval(interval)
  }, [leaveStatus.onLeave, leaveStatus.permissionAllowed])

  useEffect(() => {
    if (!leaveStatus.onLeave || leaveStatus.permissionAllowed) return
    const todayKey = new Date().toISOString().slice(0, 10)
    const reqKey = getLeaveRequestKey(user?._id, todayKey)
    const fallbackKey = getLeaveRequestKey('me', todayKey)
    const stored = localStorage.getItem(reqKey) || localStorage.getItem(fallbackKey)
    if (stored != null) setLeaveRequestSent(stored === '1')
  }, [user?._id, leaveStatus.onLeave, leaveStatus.permissionAllowed])

  // Fetch inbox data when inbox tab is active
  useEffect(() => {
    if (activeTab === 'inbox') {
      fetchInboxData()
    }
  }, [activeTab, inboxCategory])

  // Live notification stream (SSE)
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || typeof window === 'undefined' || typeof EventSource === 'undefined') return

    let pollFallback
    let errorCount = 0
    let es
    let retryTimeout
    let retryMs = 2000
    let closed = false

    const onMessage = (e) => {
      if (!e?.data) return
      let data
      try { data = JSON.parse(e.data) } catch { return }
      if (!data?._id) return

      setNotifications((prev) => {
        if (prev.some((n) => n._id === data._id)) return prev
        return [data, ...prev]
      })
      fetchUnreadCount()

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(data.title || 'Notification', { body: data.message || '' })
        } catch { /* ignore */ }
      }
    }

    const connect = () => {
      if (closed) return
      if (es) {
        es.removeEventListener('notification', onMessage)
        es.close()
      }
      es = new EventSource(`${API_URL}/notifications/stream?token=${encodeURIComponent(token)}`)
      es.addEventListener('notification', onMessage)
      es.addEventListener('connected', () => {
        errorCount = 0
        retryMs = 2000
      })
      es.onerror = () => {
        errorCount += 1
        if (errorCount >= 3 && !pollFallback) {
          pollFallback = setInterval(() => {
            fetchInboxData()
          }, 15000)
        }
        try { es.close() } catch { /* ignore */ }
        if (!retryTimeout && !closed) {
          const wait = Math.min(30000, retryMs)
          retryMs = Math.min(30000, retryMs * 2)
          retryTimeout = setTimeout(() => {
            retryTimeout = null
            connect()
          }, wait)
        }
      }
    }

    connect()

    return () => {
      closed = true
      if (retryTimeout) clearTimeout(retryTimeout)
      if (es) {
        es.removeEventListener('notification', onMessage)
        es.close()
      }
      if (pollFallback) clearInterval(pollFallback)
    }
  }, [])

  // Fetch unread count for badge
  const fetchUnreadCount = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const res = await axios.get(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUnreadCount(res.data)
    } catch (err) {
      console.error('Failed to fetch unread count:', err)
    }
  }

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchInboxData = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    
    setInboxLoading(true)
    try {
      // Fetch combined inbox data (notifications + friend requests + attendance + leave)
      const category = inboxCategory === 'all' ? '' : inboxCategory
      const res = await axios.get(`${API_URL}/notifications/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { category, limit: 50 }
      })

      setNotifications(res.data || [])

      // Trigger browser notifications for new unread items
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const lastNotified = Number(localStorage.getItem('notif_last_ts') || 0)
        const fresh = (res.data || [])
          .filter(n => n.source === 'notification' && !n.isRead)
          .filter(n => new Date(n.createdAt).getTime() > lastNotified)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

        if (fresh.length > 0) {
          fresh.forEach((n) => {
            try {
              new Notification(n.title || 'Notification', {
                body: n.message || '',
                tag: n._id || String(new Date(n.createdAt).getTime()),
              })
            } catch { /* ignore */ }
          })
          const latestTs = Math.max(...fresh.map(n => new Date(n.createdAt).getTime()))
          localStorage.setItem('notif_last_ts', String(latestTs))
        }
      }
      await fetchUnreadCount()
    } catch (err) {
      console.error('Failed to fetch inbox data:', err)
    } finally {
      setInboxLoading(false)
    }
  }

  const fetchLeaveStatus = async () => {
    const token = localStorage.getItem('token')
    if (!token) return false
    try {
      const res = await axios.get(`${API_URL}/leave/today-status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const payload = res.data || { onLeave: false, permissionAllowed: false, permissionNote: '' }
      setLeaveStatus(payload)
      const todayKey = new Date().toISOString().slice(0, 10)
      const reqKey = getLeaveRequestKey(user?._id, todayKey)
      const fallbackKey = getLeaveRequestKey('me', todayKey)
      if (payload.permissionAllowed) {
        setLeaveRequestSent(false)
        localStorage.removeItem(reqKey)
        localStorage.removeItem(fallbackKey)
      } else if (payload.onLeave) {
        const stored = localStorage.getItem(reqKey) || localStorage.getItem(fallbackKey)
        if (stored != null) setLeaveRequestSent(stored === '1')
      }
      return true
    } catch {
      // ignore
      return false
    }
  }

  // Mark notification as read (only for real notifications)
  const markAsRead = async (notifId) => {
    const token = localStorage.getItem('token')
    if (!token) return
    
    // Skip if it's a generated notification (not from DB)
    if (notifId.startsWith('fr_') || notifId.startsWith('att_') || notifId.startsWith('leave_') || notifId === 'profile_pending' || notifId === 'profile_verified' || notifId === 'profile_rejected') {
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n))
      return
    }
    
    try {
      await axios.put(`${API_URL}/notifications/${notifId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n))
      fetchUnreadCount()
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      await axios.put(`${API_URL}/notifications/mark-all-read`, 
        { category: inboxCategory === 'all' ? '' : inboxCategory },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      fetchUnreadCount()
      showNotification('All marked as read', 'success')
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  // Delete notification
  const deleteNotification = async (notifId) => {
    const token = localStorage.getItem('token')
    if (!token) return
    
    // For generated notifications, just remove from local state
    if (notifId.startsWith('fr_') || notifId.startsWith('att_') || notifId.startsWith('leave_') || notifId === 'profile_pending' || notifId === 'profile_verified' || notifId === 'profile_rejected') {
      setNotifications(prev => prev.filter(n => n._id !== notifId))
      return
    }
    
    try {
      await axios.delete(`${API_URL}/notifications/${notifId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setNotifications(prev => prev.filter(n => n._id !== notifId))
      fetchUnreadCount()
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  // Clear all notifications
  const clearAllNotifications = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      await axios.delete(`${API_URL}/notifications/clear/all`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { category: inboxCategory === 'all' ? '' : inboxCategory }
      })
      setNotifications([])
      fetchUnreadCount()
      showNotification('All notifications cleared', 'success')
    } catch (err) {
      console.error('Failed to clear notifications:', err)
    }
  }

  useEffect(() => {
    if (activeTab !== 'profile') return
    if (profileTab !== 'time') return
    setPunchShowCount(10)
  }, [activeTab, profileTab])

  const joinRangeDays = useMemo(() => {
    const createdAt = user?.createdAt ? new Date(user.createdAt) : null
    if (!createdAt || Number.isNaN(createdAt.getTime())) return null
    const today = getAttendanceDay6am(new Date())
    const start = new Date(createdAt)
    start.setHours(0, 0, 0, 0)
    return Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  }, [user?.createdAt])

  useEffect(() => {
    // Default: show from joining date (like Keka), but don't keep overriding manual changes.
    if (punchRangeInitializedRef.current) return
    if (!joinRangeDays) return
    setPunchShowCount(joinRangeDays)
    punchRangeInitializedRef.current = true
  }, [joinRangeDays])

  useEffect(() => {
    const onMessage = (event) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return
      const data = event.data
      if (!data || typeof data !== 'object') return

      // Verify it's our attendance message
      if (data.kind === 'attendance:update' && data.attendance) {
        setTodayAttendance(data.attendance)
        if (data.location) setLiveLocation(data.location)
        setPunchLoading(false)
        showNotification(
          data.mode === 'out' ? 'Punched Out Successfully!' : 'Punched In Successfully!',
          'success'
        )
        // Refresh history after punch
        fetchAttendanceHistory()
      }

      if (data.kind === 'attendance:error') {
        setPunchLoading(false)
        showNotification(data.message || 'Failed', 'error')
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUser(response.data)
      localStorage.setItem('user', JSON.stringify(response.data))
      setManager(response.data.manager)
      setLoading(false)
      return true
    } catch (error) {
      console.error('Error fetching user:', error)
      setLoading(false)
      return false
    }
  }

  const fetchTodayAttendance = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/attendance/today`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTodayAttendance(response.data.attendance)
      return true
    } catch (error) {
      console.error('Error fetching attendance:', error)
      return false
    }
  }

  const fetchUserSettings = async () => {
    setSettingsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/auth/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data?.settings) {
        setUserSettings((prev) => ({
          ...prev,
          ...res.data.settings,
          privacy: { ...prev.privacy, ...(res.data.settings.privacy || {}) },
        }))
      }
      return true
    } catch (error) {
      console.error('Error fetching settings:', error)
      return false
    } finally {
      setSettingsLoading(false)
    }
  }

  const updateUserSettings = async (next) => {
    setSettingsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.put(`${API_URL}/auth/settings`, next, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data?.settings) {
        setUserSettings(res.data.settings)
      }
      showNotification('Settings updated', 'success')
      return true
    } catch (error) {
      console.error('Error updating settings:', error)
      showNotification('Settings update failed', 'error')
      return false
    } finally {
      setSettingsSaving(false)
    }
  }

  const fetchAttendanceHistory = async () => {
    setAttendanceLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/attendance/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setAttendanceHistory(response.data.attendance || [])
      return true
    } catch (error) {
      console.error('Error fetching attendance history:', error)
      return false
    } finally {
      setAttendanceLoading(false)
    }
  }

  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    window.location.reload()
  }

  const formatTime = (d) => {
    if (!d) return '--:--'
    try {
      return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '--:--'
    }
  }

  const formatDateLabel = (d) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
  }

  const formatMinutes = (mins) => {
    const m = Math.max(0, Number(mins) || 0)
    const h = Math.floor(m / 60)
    const mm = m % 60
    if (h <= 0) return `${mm}m`
    if (mm <= 0) return `${h}h`
    return `${h}h ${mm}m`
  }

  const applySettingsUpdate = (next) => {
    setUserSettings(next)
    updateUserSettings(next)
  }

  const toggleSetting = (path) => {
    if (settingsSaving) return
    if (path === 'notificationsEnabled') {
      applySettingsUpdate({ ...userSettings, notificationsEnabled: !userSettings.notificationsEnabled })
    } else if (path === 'emailAlerts') {
      applySettingsUpdate({ ...userSettings, emailAlerts: !userSettings.emailAlerts })
    } else if (path === 'privacy.showProfileToTeam') {
      applySettingsUpdate({
        ...userSettings,
        privacy: { ...userSettings.privacy, showProfileToTeam: !userSettings.privacy.showProfileToTeam },
      })
    } else if (path === 'privacy.showOnlineStatus') {
      applySettingsUpdate({
        ...userSettings,
        privacy: { ...userSettings.privacy, showOnlineStatus: !userSettings.privacy.showOnlineStatus },
      })
    } else if (path === 'privacy.shareLocation') {
      applySettingsUpdate({
        ...userSettings,
        privacy: { ...userSettings.privacy, shareLocation: !userSettings.privacy.shareLocation },
      })
    }
  }

  const sortedAttendanceHistory = useMemo(() => {
    const list = Array.isArray(attendanceHistory) ? attendanceHistory : []
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [attendanceHistory])

  // Attendance day resets at 6:00 AM (local time).
  function getAttendanceDay6am(now = new Date()) {
    const d = new Date(now)
    if (d.getHours() < 6) d.setDate(d.getDate() - 1)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const attendanceByDayKey = useMemo(() => {
    const map = new Map()
    for (const rec of sortedAttendanceHistory) {
      const key = new Date(rec?.date).toDateString()
      if (!map.has(key)) map.set(key, rec)
    }
    return map
  }, [sortedAttendanceHistory])

  // Single source of truth for "today": prefer /attendance/today, fallback to history.
  const effectiveTodayAttendance = useMemo(() => {
    if (todayAttendance?.punchIn?.time || todayAttendance?.punchOut?.time) return todayAttendance
    const todayKey = getAttendanceDay6am(new Date()).toDateString()
    return attendanceByDayKey.get(todayKey) || todayAttendance || null
  }, [todayAttendance, attendanceByDayKey])

  const timeRangeDays = useMemo(() => {
    const today = getAttendanceDay6am(new Date())
    const days = []
    const n = Math.max(0, Number(punchShowCount) || 0)
    for (let i = 0; i < n; i++) {
      const day = new Date(today)
      day.setDate(day.getDate() - i)
      const key = day.toDateString()
      days.push({ day, key, rec: attendanceByDayKey.get(key) || null })
    }
    return days
  }, [attendanceByDayKey, punchShowCount])

  const timeDaysFiltered = useMemo(() => {
    if (!punchOtOnly) return timeRangeDays
    return timeRangeDays.filter(({ rec }) => {
      if (!rec) return false
      const otMinutes = getOvertimeMinutes(rec)
      return (Number(otMinutes) || 0) > 0
    })
  }, [timeRangeDays, punchOtOnly])

  const isAfterMissedPunchOutCutoff = (dayDate, nowDate = new Date()) => {
    if (!dayDate || !nowDate) return false
    const cutoff = new Date(dayDate)
    cutoff.setHours(23, 59, 59, 999)
    return nowDate.getTime() > cutoff.getTime()
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported')
    }

    // Collect multiple GPS fixes for a short window and pick the best accuracy.
    // This reduces the chance of getting a coarse/Wi‑Fi based wrong location.
    const best = await new Promise((resolve, reject) => {
      let bestFix = null
      const startedAt = Date.now()
      const maxMs = 15000
      const targetAcc = 50

      const done = (val, isError) => {
        try {
          if (watchId != null) navigator.geolocation.clearWatch(watchId)
        } catch {
          // ignore
        }
        if (isError) reject(val)
        else resolve(val)
      }

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const candidate = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
          }

          const candAcc = typeof candidate.accuracy === 'number' ? candidate.accuracy : Number.POSITIVE_INFINITY
          const bestAcc = bestFix && typeof bestFix.accuracy === 'number' ? bestFix.accuracy : Number.POSITIVE_INFINITY
          if (!bestFix || candAcc < bestAcc) {
            bestFix = candidate
          }

          // If we got decent precision, stop early.
          if (candidate.accuracy && candidate.accuracy <= targetAcc) {
            done(bestFix)
            return
          }

          // Otherwise, keep listening until timeout window.
          if (Date.now() - startedAt >= maxMs) {
            done(bestFix || candidate)
          }
        },
        (err) => {
          done(err, true)
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      )

      // Safety timeout (in case watchPosition doesn’t return)
      setTimeout(() => {
        if (bestFix) done(bestFix)
        else done(new Error('Unable to get location. Turn on GPS + allow Precise location.'), true)
      }, maxMs + 2000)
    })

    // Address lookup is optional and often rate-limited (Nominatim 503). Use coords reliably.
    return {
      ...best,
      address: `${best.lat.toFixed(6)}, ${best.lng.toFixed(6)}`,
    }
  }

  const sendLiveLocation = useCallback(async (loc) => {
    const now = Date.now()
    // throttle to avoid spamming server + geocoding providers
    if (now - lastSentAtRef.current < 15000) return
    lastSentAtRef.current = now

    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/attendance/location`, loc, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (e) {
      // silent: live updates should never block UI
      console.error('Live location update failed:', e)
    }
  }, [])


  const startLiveTracking = useCallback(() => {
    if (!navigator.geolocation) return
    if (watchIdRef.current != null) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
          // don't reverse-geocode for live updates (rate-limits). coords are the "exact" truth.
          address: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
        }
        setLiveLocation(loc)
        sendLiveLocation(loc)
      },
      (err) => {
        console.warn('Live location watch error:', err)
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    )
  }, [sendLiveLocation])

  const stopLiveTracking = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const ensurePunchPermissions = async () => {
    if (!navigator.geolocation) {
      throw new Error('Location is not supported on this device')
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera is not supported on this device')
    }

    // Request camera permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      throw new Error('Camera access required. Please allow camera permission.')
    }

    // Request location permission
    try {
      await getCurrentLocation()
    } catch {
      throw new Error('Location access required. Please enable GPS and allow location.')
    }
  }

  useEffect(() => {
    const punchedIn = !!effectiveTodayAttendance?.punchIn?.time
    const punchedOut = !!effectiveTodayAttendance?.punchOut?.time

    if (punchedIn && !punchedOut) {
      startLiveTracking()
    } else {
      stopLiveTracking()
    }

    return () => {
      stopLiveTracking()
    }
  }, [effectiveTodayAttendance?.punchIn?.time, effectiveTodayAttendance?.punchOut?.time, startLiveTracking, stopLiveTracking])

  const handlePunchIn = async () => {
    try {
      await ensurePunchPermissions()
      setConfirmModal({ show: true, type: 'in' })
    } catch (error) {
      showNotification(error?.message || 'Please enable camera and location', 'error')
    }
  }

  const handlePunchOut = async () => {
    try {
      await ensurePunchPermissions()
      setConfirmModal({ show: true, type: 'out' })
    } catch (error) {
      showNotification(error?.message || 'Please enable camera and location', 'error')
    }
  }

  const handleLeavePermissionRequest = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    if (leaveRequesting || leaveRequestSent) return
    setLeaveRequesting(true)
    try {
      await axios.post(`${API_URL}/leave/punch-permission-request`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setLeaveRequestSent(true)
      const todayKey = new Date().toISOString().slice(0, 10)
      const reqKey = getLeaveRequestKey(user?._id, todayKey)
      localStorage.setItem(reqKey, '1')
      localStorage.setItem(getLeaveRequestKey('me', todayKey), '1')
      showNotification('Request sent to HR', 'success')
    } catch {
      showNotification('Failed to send request', 'error')
    } finally {
      setLeaveRequesting(false)
    }
  }

  const confirmPunch = (type) => {
    setConfirmModal({ show: false, type: null })
    setPunchLoading(true)
    showNotification('Opening selfie verification...', 'success')

    const url = `/selfie-capture?mode=${type}&ts=${Date.now()}`
    const w = window.open(url, '_blank')
    if (!w) {
      setPunchLoading(false)
      showNotification('Popup blocked. Please allow popups for this site.', 'error')
    }
  }

  const cancelConfirm = () => {
    setConfirmModal({ show: false, type: null })
  }

  const showNotification = (message, type) => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const fetchPayslipAvailability = async () => {
    const token = localStorage.getItem('token')
    setPayslipLoading(true)
    try {
      const res = await axios.get(`${API_URL}/auth/payslip-availability`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPayslipAvailability(res.data || { canDownload: false, month: null })
    } catch (error) {
      setPayslipAvailability({ canDownload: false, month: null })
    } finally {
      setPayslipLoading(false)
    }
  }

  const openPayslipModal = async () => {
    setPayslipModalOpen(true)
    await fetchPayslipAvailability()
  }

  const fetchPayslipData = async () => {
    const token = localStorage.getItem('token')
    if (!payslipAvailability?.canDownload || !payslipAvailability?.month) {
      showNotification('Payslip not approved yet', 'error')
      return null
    }
    const res = await axios.get(`${API_URL}/auth/payslip`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { month: payslipAvailability.month },
    })
    return res.data
  }

  const handleViewPayslip = async () => {
    try {
      const data = await fetchPayslipData()
      if (!data) return
      await openPayslipImage(data)
    } catch (error) {
      showNotification(error.response?.data?.message || 'Payslip view failed', 'error')
    }
  }

  const handleDownloadPayslip = async () => {
    try {
      const data = await fetchPayslipData()
      if (!data) return
      await downloadPayslipImage(data, `PaySlip-${payslipAvailability.month}.png`)
      showNotification('Payslip downloaded', 'success')
    } catch (error) {
      showNotification(error.response?.data?.message || 'Payslip download failed', 'error')
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const asked = localStorage.getItem('notif_permission_asked')
    if (asked) return
    if (Notification.permission === 'default') {
      localStorage.setItem('notif_permission_asked', '1')
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          showNotification('Notifications enabled', 'success')
        } else if (perm === 'denied') {
          showNotification('Notifications blocked. Enable from browser settings.', 'error')
        }
      }).catch(() => {
        showNotification('Notification permission failed', 'error')
      })
    }
  }, [])

  const handleLogout = async () => {
    // No auto punch-out - user must manually punch out
    stopLiveTracking()
    onLogout()
    navigate('/login')
  }

  const tabs = [
    { id: 'inbox', label: 'Inbox' },
    { id: 'team', label: 'Team' },
    { id: 'home', label: 'Home' },
    { id: 'wall', label: 'Wall' },
    { id: 'profile', label: 'Profile' },
  ]

  const TabIcon = ({ id, active }) => {
    const color = active ? 'white' : 'rgba(255,255,255,0.5)'
    switch(id) {
      case 'home':
        return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
      case 'team':
        return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      case 'inbox':
        return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-9 8h18a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      case 'wall':
        return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14a2 2 0 012 2v6H3V5a2 2 0 012-2zm-2 10h18v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z" /></svg>
      case 'profile':
        return <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
      default:
        return null
    }
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="min-h-screen bg-black flex justify-center">
      <div className="relative w-full max-w-md h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col overflow-hidden md:my-4 md:h-[calc(100vh-2rem)] md:rounded-[28px] md:border md:border-white/10 md:shadow-2xl">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between rounded-b-2xl">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 bg-gradient-to-br ${getAvatarColor(user)} rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold text-white ${user?.profilePicUrl ? 'cursor-zoom-in' : ''}`}
            onClick={() => user?.profilePicUrl && openImagePreview(toAssetUrl(user.profilePicUrl), 'Profile')}
            role={user?.profilePicUrl ? 'button' : undefined}
            aria-label={user?.profilePicUrl ? 'Preview profile photo' : undefined}
          >
            {user?.profilePicUrl ? (
              <img src={toAssetUrl(user.profilePicUrl)} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              getInitials(user)
            )}
          </div>
          <div>
            <p className="text-white font-semibold text-sm flex items-center gap-1">
              {(user?.name?.trim() || user?.email?.split('@')[0] || 'User')}
              {user?.isVerifiedEmployee && (
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24" title="Verified Employee">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              )}
            </p>
            <p className="text-emerald-300 text-xs">
              {user?.profileStatus === 'pending' ? 'Verification Pending' : 'Online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            onClick={handleRefresh}
            disabled={refreshing}
            className={`w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center ${refreshing ? 'opacity-60 cursor-not-allowed' : ''}`}
            title="Refresh"
          >
            <motion.svg
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.6, repeat: refreshing ? Infinity : 0, ease: "linear" }}
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v6h6M20 20v-6h-6M5.5 9A7 7 0 0117 6.5L10 13m8.5 2A7 7 0 017 17.5L14 11"
              />
            </motion.svg>
          </motion.button>
          {/* Menu Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowMenu(true)}
            className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </motion.button>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className={`absolute top-8 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium ${
              notification.type === 'success' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-red-500 text-white'
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={closeImagePreview}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeImagePreview}
                className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg"
                aria-label="Close preview"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="bg-white rounded-2xl p-2">
                <img src={imagePreview.src} alt={imagePreview.label} className="w-full h-auto rounded-xl object-contain" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cropper Modal */}
      <AnimatePresence>
        {cropOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-2xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">Crop profile photo</p>
                <button
                  onClick={resetCropper}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  aria-label="Close cropper"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="relative w-full h-72 bg-black">
                {cropImageSrc && (
                  <Cropper
                    image={cropImageSrc}
                    crop={crop}
                    zoom={cropZoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setCropZoom}
                    onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                  />
                )}
              </div>
              <div className="px-4 py-4">
                <label className="text-xs text-gray-500">Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={resetCropper}
                    className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCropSave}
                    className="flex-1 py-2 rounded-xl bg-black text-white text-sm font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-black px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    {confirmModal.type === 'in' ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {confirmModal.type === 'in' ? 'Punch In' : 'Punch Out'}
                    </h3>
                    <p className="text-white/60 text-[11px]">
                      {confirmModal.type === 'in' ? 'Start your work day' : 'End your work day'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5">
                <p className="text-gray-600 text-[13px] text-center mb-5">
                  {confirmModal.type === 'in' 
                    ? 'Your selfie and location will be recorded.' 
                    : 'Your selfie and location will be recorded.'}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={cancelConfirm}
                    className="flex-1 px-4 py-2.5 bg-white text-black font-semibold text-sm rounded-xl hover:bg-gray-100 border border-black transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => confirmPunch(confirmModal.type)}
                    className="flex-1 px-4 py-2.5 bg-black text-white font-semibold text-sm rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    Confirm
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Main Content (scrolls behind fixed bottom bar) */}
      <div className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="px-4 pt-4 pb-6 max-w-md mx-auto"
            >
              {/* Quick Actions Card */}
              <motion.div 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="relative bg-black rounded-3xl p-4 mb-4 overflow-hidden shadow-xl shadow-black/30 border border-white/10"
              >
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 0.5 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
                />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white/60 text-xs">Quick actions</p>
                    </div>
                    <span className="text-white/60 text-xs">
                      {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => navigate('/leave-management')}
                      className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/15 transition-colors rounded-2xl px-2 py-2"
                    >
                      <span className="w-9 h-9 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </span>
                      <div className="text-[9px] font-semibold leading-tight text-white/85 text-center">
                        <div>Apply</div>
                        <div>Leave</div>
                      </div>
                    </button>

                    <button
                      onClick={() => navigate('/wfh-management')}
                      className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/15 transition-colors rounded-2xl px-2 py-2"
                    >
                      <span className="w-9 h-9 rounded-2xl bg-sky-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      </span>
                      <div className="text-[9px] font-semibold leading-tight text-white/85 text-center">
                        <div>Apply</div>
                        <div>WFH</div>
                      </div>
                    </button>

                    <button
                      onClick={openPayslipModal}
                      className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/15 transition-colors rounded-2xl px-2 py-2"
                    >
                      <span className="w-9 h-9 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2M5 11h14v10H5V11z" /></svg>
                      </span>
                      <div className="text-[9px] font-semibold leading-tight text-white/85 text-center">
                        <div>View</div>
                        <div>Payslip</div>
                      </div>
                    </button>

                    <button
                      onClick={() => showNotification('Leave balance available soon', 'success')}
                      className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/15 transition-colors rounded-2xl px-2 py-2"
                    >
                      <span className="w-9 h-9 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 00-2-2H5m14 8v-4a2 2 0 00-2-2h-2" /></svg>
                      </span>
                      <div className="text-[9px] font-semibold leading-tight text-white/85 text-center">
                        <div>Leave</div>
                        <div>Balance</div>
                      </div>
                    </button>

                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('open-social-find'))}
                      className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/15 transition-colors rounded-2xl px-2 py-2"
                    >
                      <span className="w-9 h-9 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-fuchsia-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </span>
                      <div className="text-[9px] font-semibold leading-tight text-white/85 text-center">
                        <div>Find</div>
                        <div>Colleague</div>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Punch In/Out */}
              {leaveStatus.onLeave && !leaveStatus.permissionAllowed ? (
                <div className="mb-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-amber-600 text-xs font-semibold uppercase tracking-wide">On approved leave</p>
                      <p className="text-gray-700 text-sm font-medium">Punching is disabled while on leave.</p>
                      <p className="text-gray-500 text-xs mt-1">Request permission from HR to punch today.</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={handleLeavePermissionRequest}
                      disabled={leaveRequesting || leaveRequestSent}
                      className={`w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${(leaveRequesting || leaveRequestSent) ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}
                    >
                      {leaveRequesting ? 'Sending request...' : (leaveRequestSent ? 'Requested' : 'Request Punch Permission')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {leaveStatus.onLeave && leaveStatus.permissionAllowed && (
                    <div className="mb-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                      <p className="text-emerald-600 text-xs font-semibold uppercase tracking-wide">Leave permission granted</p>
                      <p className="text-gray-600 text-xs">You can punch today. {leaveStatus.permissionNote || ''}</p>
                    </div>
                  )}
                  <div className="relative grid grid-cols-2 gap-3 mb-4">
                    {/* Star Animation Background */}
                    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                      {[...Array(12)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-1 h-1 bg-white rounded-full"
                          style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                          }}
                          animate={{
                            scale: [0, 1, 0],
                            opacity: [0, 0.8, 0],
                          }}
                          transition={{
                            duration: 2 + Math.random() * 2,
                            repeat: Infinity,
                            delay: Math.random() * 3,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                    
                    <motion.button
                      onClick={handlePunchIn}
                      disabled={punchLoading || !!effectiveTodayAttendance?.punchIn?.time}
                      whileTap={{ scale: 0.98 }}
                      whileHover={{ scale: 1.01 }}
                      className={`relative rounded-xl p-3 text-left overflow-hidden shadow-md ring-1 ring-white/15 transition-all ${
                        effectiveTodayAttendance?.punchIn?.time 
                          ? 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-500/20 cursor-not-allowed opacity-80'
                          : 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-green-500/20 hover:shadow-lg hover:shadow-green-500/25'
                      }`}
                    >
                      <motion.div
                        animate={{ x: ['-150%', '250%'] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]"
                      />
                      <div className="relative z-10">
                          <div className="relative w-9 h-9 mb-2">
                          {punchLoading && (
                            <motion.div
                              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute inset-0 bg-white rounded-xl"
                            />
                          )}
                          <div className="relative w-full h-full bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                            {punchLoading ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                              />
                            ) : (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                            )}
                          </div>
                        </div>
                          <p className="font-bold text-white text-base">
                          {punchLoading ? 'Processing...' : effectiveTodayAttendance?.punchIn?.time ? 'Punched In' : 'Punch In'}
                        </p>
                        <p className="text-white/70 text-xs">
                          {effectiveTodayAttendance?.punchIn?.time 
                            ? new Date(effectiveTodayAttendance.punchIn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : 'Start your day'
                          }
                        </p>
                      </div>
                    </motion.button>
                    
                    <motion.button
                      onClick={handlePunchOut}
                      disabled={punchLoading || !effectiveTodayAttendance?.punchIn?.time || !!effectiveTodayAttendance?.punchOut?.time}
                      whileTap={{ scale: 0.98 }}
                      whileHover={{ scale: 1.01 }}
                      className={`relative rounded-xl p-3 text-left overflow-hidden shadow-md ring-1 ring-white/15 transition-all ${
                        !effectiveTodayAttendance?.punchIn?.time || !!effectiveTodayAttendance?.punchOut?.time
                          ? 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-500/20 cursor-not-allowed opacity-80'
                          : 'bg-gradient-to-br from-rose-500 to-red-600 shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/25'
                      }`}
                    >
                      <motion.div
                        animate={{ x: ['-150%', '250%'] }}
                        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.8 }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[25deg]"
                      />
                      <div className="relative z-10">
                          <div className="relative w-9 h-9 mb-2">
                          {punchLoading && (
                            <motion.div
                              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute inset-0 bg-white rounded-xl"
                            />
                          )}
                          <div className="relative w-full h-full bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                            {punchLoading ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                              />
                            ) : (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            )}
                          </div>
                        </div>
                          <p className="font-bold text-white text-base">
                          {punchLoading ? 'Processing...' : effectiveTodayAttendance?.punchOut?.time ? 'Punched Out' : 'Punch Out'}
                        </p>
                        <p className="text-white/70 text-xs">
                          {effectiveTodayAttendance?.punchOut?.time 
                            ? new Date(effectiveTodayAttendance.punchOut.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : !effectiveTodayAttendance?.punchIn?.time ? 'Punch in first' : 'End your day'
                          }
                        </p>
                      </div>
                    </motion.button>
                  </div>
                </>
              )}

              {/* Live Productive Hours Timer */}
              {(() => {
                const punchOutMissing = effectiveTodayAttendance?.punchOut?.suspectReason === 'MISSING_PUNCH_OUT'
                if (!effectiveTodayAttendance?.punchIn?.time) return null
                if (!punchOutMissing && effectiveTodayAttendance?.punchOut?.time) return null
                return (
                  <ProductiveTimer
                    punchInTime={effectiveTodayAttendance.punchIn.time}
                    punchOutTime={effectiveTodayAttendance?.punchOut?.time || null}
                    attendanceDate={effectiveTodayAttendance?.date || null}
                    punchOutMissing={punchOutMissing}
                  />
                )
              })()}

              {/* Weekly Analytics Graph */}
              <WeeklyAnalytics attendanceHistory={attendanceHistory} />

              {/* OT Display - Below Punch Buttons */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-amber-600 text-xs font-medium uppercase tracking-wide">Today's OT</p>
                    <p className="text-gray-800 font-bold text-lg">
                      {(() => {
                        const mins = getOvertimeMinutes(effectiveTodayAttendance, { assumeNowIfNoPunchOut: true })
                        return mins > 0
                          ? `${Math.floor(mins / 60)}h ${mins % 60}m`
                          : '0h 0m'
                      })()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Total OT</p>
                  <p className="text-amber-600 font-bold">
                    {(() => {
                      const totalOT = attendanceHistory.reduce((sum, a) => {
                        return sum + getOvertimeMinutes(a)
                      }, 0);
                      const hrs = Math.floor(totalOT / 60);
                      const mins = totalOT % 60;
                      return `${hrs}h ${mins}m`;
                    })()}
                  </p>
                </div>
              </motion.div>

              {/* Compact Attendance Calendar */}
              <div className="mb-4">
                <AttendanceCalendar attendanceHistory={attendanceHistory} />
              </div>

              <div className="mb-4 flex justify-center">
                <button
                  onClick={() => { setActiveTab('profile'); setProfileTab('time'); }}
                  className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-full shadow-sm"
                >
                  See details
                </button>
              </div>

              {/* Quick Stats */}
              {(() => {
                const today = new Date()
                const thisMonth = today.getMonth()
                const thisYear = today.getFullYear()
                const daysPassed = today.getDate()
                let workingDaysPassed = 0
                for (let d = 1; d <= daysPassed; d++) {
                  const dt = new Date(thisYear, thisMonth, d)
                  if (dt.getDay() !== 0) workingDaysPassed++
                }
                const present = attendanceHistory.filter(a => a.punchIn?.time).length
                const presentThisMonth = attendanceHistory.filter(a => {
                  if (!a.punchIn?.time) return false
                  const ad = new Date(a.date)
                  return ad.getMonth() === thisMonth && ad.getFullYear() === thisYear
                }).length
                const absent = Math.max(0, workingDaysPassed - presentThisMonth)
                const onTime = attendanceHistory.filter(a => {
                  if (!a.punchIn?.time) return false
                  const t = new Date(a.punchIn.time)
                  return (t.getHours() * 60 + t.getMinutes()) <= 9 * 60 + 10
                }).length
                const late = attendanceHistory.filter(a => {
                  if (!a.punchIn?.time) return false
                  const t = new Date(a.punchIn.time)
                  return (t.getHours() * 60 + t.getMinutes()) > 9 * 60 + 10
                }).length
                const noOut = attendanceHistory.filter(a => {
                  if (!a.punchIn?.time) return false
                  const ad = new Date(a.date)
                  const isToday = ad.toDateString() === today.toDateString()
                  return !isToday && !a.punchOut?.time
                }).length

                const stats = [
                  { label: 'Present', value: present, color: 'bg-emerald-500' },
                  { label: 'Absent', value: absent, color: 'bg-red-500' },
                  { label: 'On Time', value: onTime, color: 'bg-violet-500' },
                  { label: 'Late', value: late, color: 'bg-amber-500' },
                  { label: 'No Out', value: noOut, color: 'bg-gray-500' },
                ]

                return (
                  <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl px-2 py-3 mb-5 shadow-sm">
                    <div className="flex justify-between items-center">
                      {stats.map((s, i) => (
                        <div key={i} className="flex flex-col items-center flex-1">
                          <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center mb-1 shadow-sm`}>
                            <span className="text-white text-xs font-bold">{s.value}</span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-medium leading-tight">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

           
            </motion.div>
          )}

          {activeTab === 'inbox' && (
            <motion.div
              key="inbox"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="px-4 pt-4 pb-6"
            >
              {/* Header with actions */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Inbox</h2>
                <div className="flex gap-2">
                  {notifications.some(n => !n.isRead) && (
                    <button
                      onClick={markAllAsRead}
                      className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-full"
                    >
                      Mark All Read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="px-3 py-1.5 bg-red-500/10 text-red-500 text-xs font-semibold rounded-full border border-red-200"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                {[
                  { id: 'all', label: 'All', icon: 'inbox' },
                  { id: 'social', label: 'Social', icon: 'users' },
                  { id: 'attendance', label: 'Attendance', icon: 'clock' },
                  { id: 'leave', label: 'Leave', icon: 'calendar' },
                  { id: 'profile', label: 'Profile', icon: 'user' },
                  { id: 'system', label: 'System', icon: 'bell' },
                ].map(cat => {
                  const isActive = inboxCategory === cat.id
                  const count = cat.id === 'all' ? unreadCount.total : (unreadCount.byCategory?.[cat.id] || 0)
                  
                  const getIcon = () => {
                    const cls = `w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`
                    switch(cat.icon) {
                      case 'inbox': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                      case 'users': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      case 'clock': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      case 'calendar': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      case 'user': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      case 'bell': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      default: return null
                    }
                  }
                  
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setInboxCategory(cat.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        isActive 
                          ? 'bg-black text-white border-black shadow-lg' 
                          : 'bg-white/70 text-gray-600 border-white/60 hover:bg-white'
                      }`}
                    >
                      {getIcon()}
                      <span>{cat.label}</span>
                      {count > 0 && (
                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {inboxLoading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3, 4, 5].map((i) => <InboxItemSkeleton key={i} />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.length === 0 ? (
                    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl p-8 shadow-sm text-center">
                      <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-gray-800 font-semibold">All caught up!</p>
                      <p className="text-gray-400 text-sm mt-1">No notifications in this category.</p>
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const getNotifStyle = () => {
                        switch(notif.type) {
                          case 'connection_request':
                          case 'connection_accepted':
                            return { bg: 'bg-violet-50', iconBg: 'bg-violet-500', icon: <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg> }
                          case 'leave_approved':
                            return { bg: 'bg-emerald-50', iconBg: 'bg-emerald-500', icon: <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> }
                          case 'leave_rejected':
                            return { bg: 'bg-red-50', iconBg: 'bg-red-500', icon: <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> }
                          case 'profile_approved':
                            return { bg: 'bg-emerald-50', iconBg: 'bg-emerald-500', icon: <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" /></svg> }
                          case 'profile_rejected':
                            return { bg: 'bg-red-50', iconBg: 'bg-red-500', icon: <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
                          case 'profile_unlocked':
                            return { bg: 'bg-amber-50', iconBg: 'bg-amber-500', icon: <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg> }
                          case 'punch_reminder':
                          case 'missed_punch':
                            return { bg: 'bg-amber-50', iconBg: 'bg-amber-500', icon: <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
                          case 'attendance_marked':
                          case 'overtime_recorded':
                            return { bg: 'bg-blue-50', iconBg: 'bg-blue-500', icon: <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> }
                          default:
                            return { bg: 'bg-gray-50', iconBg: 'bg-gray-500', icon: <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> }
                        }
                      }
                      
                      const style = getNotifStyle()
                      const formatIST = (date) => {
                        if (!date) return ''
                        return new Date(date).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: 'Asia/Kolkata',
                        })
                      }
                      const displayMessage = (item) => {
                        if (item?.type === 'attendance_marked') {
                          const title = (item?.title || '').toLowerCase()
                          if (title.includes('punch in')) return 'Punch in success'
                          if (title.includes('punch out')) return 'Punch out success'
                          return 'Attendance updated'
                        }
                        return item?.message || ''
                      }
                      
                      return (
                        <motion.div
                          key={notif._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`relative ${style.bg} ${!notif.isRead ? 'border-l-4 border-blue-500' : ''} backdrop-blur-xl rounded-2xl p-4 shadow-sm`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon or Profile Pic */}
                            {notif.data?.senderProfilePic ? (
                              <img 
                                src={toAssetUrl(notif.data.senderProfilePic)} 
                                alt="" 
                                className="w-10 h-10 rounded-xl object-cover"
                              />
                            ) : (
                              <div className={`w-10 h-10 ${style.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                {style.icon}
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-gray-800 text-sm">{notif.title}</p>
                                  <p className="text-gray-600 text-xs mt-0.5">{displayMessage(notif)}</p>
                                </div>
                                <span className="text-gray-400 text-[10px] whitespace-nowrap">{formatIST(notif.createdAt)}</span>
                              </div>
                              
                              {/* Action buttons for specific types */}
                              {notif.type === 'connection_request' && (
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-social-panel'))}
                                    className="px-3 py-1 bg-violet-500 text-white text-xs font-semibold rounded-full"
                                  >
                                    View Request
                                  </button>
                                </div>
                              )}
                              
                              {notif.type === 'profile_unlocked' && (
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => navigate('/profile-details')}
                                    className="px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full"
                                  >
                                    Edit Profile
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              {!notif.isRead && (
                                <button
                                  onClick={() => markAsRead(notif._id)}
                                  className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
                                  title="Mark as read"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </button>
                              )}
                              <button
                                onClick={() => deleteNotification(notif._id)}
                                className="w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-colors"
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                          
                          {/* Unread indicator dot */}
                          {!notif.isRead && (
                            <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                        </motion.div>
                      )
                    })
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'wall' && (
            <motion.div
              key="wall"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-5"
            >
              <Wall currentUser={user} />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-5"
            >
              {/* Profile Header Row - Professional Card */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative mb-4 rounded-3xl overflow-hidden border border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-sm"
              >
                {/* Subtle top accent */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500"></div>

                {/* Soft background wash */}
                <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40"></div>

                {/* Edit Button */}
                <button
                  onClick={() => navigate('/profile-details')}
                  className="absolute top-3 right-3 z-10 w-8 h-8 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center shadow-sm border border-slate-200"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Content */}
                <div className="relative p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Name with Verified Badge */}
                    <div className="flex items-center gap-2">
                      <h2 className="text-slate-900 font-bold text-xl truncate">
                        {(user?.name?.trim() || user?.email?.split('@')[0] || 'User')}
                      </h2>
                      {user?.isVerifiedEmployee && (
                        <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                          </svg>
                          <span className="text-blue-600 text-[10px] font-semibold">Verified</span>
                        </div>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm truncate mt-0.5">{user?.email || ''}</p>
                    
                    {/* Profile Status Badge */}
                    {user?.profileStatus && user?.profileStatus !== 'approved' && (
                      <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg text-xs font-medium ${
                        user.profileStatus === 'pending' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : user.profileStatus === 'rejected'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-gray-50 text-gray-600 border border-gray-200'
                      }`}>
                        {user.profileStatus === 'pending' && (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Verification Pending
                          </>
                        )}
                        {user.profileStatus === 'rejected' && (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Profile Rejected - Edit & Resubmit
                          </>
                        )}
                        {user.profileStatus === 'draft' && (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Complete Your Profile
                          </>
                        )}
                      </div>
                    )}

                    {/* Manager & Department chips */}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-xl px-3 py-2 border border-slate-200/70 bg-white/80">
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Manager</p>
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {manager?.name || user?.reportsTo?.name || 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-xl px-3 py-2 border border-slate-200/70 bg-white/80">
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Department</p>
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {user?.department || manager?.department || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* ID & Since badges */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {user?.employeeId && (
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-900/5 text-slate-700 font-semibold border border-slate-200">
                          ID: {user.employeeId}
                        </span>
                      )}
                      {user?.createdAt && (
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-900/5 text-slate-600 font-medium border border-slate-200">
                          Since {formatDateLabel(user.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Avatar with ring */}
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg ring-2 ring-indigo-200 bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500">
                  {user?.profilePicUrl ? (
                    <img
                      src={toAssetUrl(user.profilePicUrl)}
                      alt="Profile"
                      className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                      onClick={() => openImagePreview(toAssetUrl(user.profilePicUrl), 'Profile')}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
                      {(user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  {profileUploading && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-[10px] font-semibold">
                      <div className="w-12 h-12 rounded-full border-4 border-white/20 relative">
                        <div
                          className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin"
                        />
                      </div>
                      <div className="mt-1">Uploading {profileUploadProgress}%</div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white/90 backdrop-blur flex items-center justify-center ring-1 ring-slate-200"
                    aria-label="Upload profile photo"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h3l2-2h8l2 2h3v14H3V7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17a4 4 0 100-8 4 4 0 000 8z" />
                    </svg>
                  </button>

                  <input
                    ref={profileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      openCropper(file)
                      e.target.value = ''
                    }}
                  />
                </div>
                </div>
              </motion.div>

              {/* Profile Sections */}
              <div className="mb-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    { id: 'personal', label: 'Personal Info' },
                    { id: 'time', label: 'Time' },
                    { id: 'finance', label: 'Finance' },
                    { id: 'performance', label: 'Performance' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (t.id === 'personal') {
                          // If profile is approved, show verified profile details, else navigate to edit
                          if (user?.profileStatus === 'approved') {
                            setProfileTab('personal')
                          } else {
                            navigate('/profile-details')
                          }
                        } else {
                          setProfileTab(t.id)
                        }
                      }}
                      className={`shrink-0 px-3 py-2 rounded-full text-xs border transition-colors flex items-center gap-1.5 ${
                        profileTab === t.id
                          ? 'bg-black text-white border-black'
                          : t.id === 'personal' && user?.profileStatus === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-white/70 text-gray-600 border-white/60'
                      }`}
                    >
                      {t.id === 'personal' && user?.profileStatus === 'approved' ? (
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                        </svg>
                      ) : t.id === 'personal' ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      ) : null}
                      {t.label}
                      {t.id === 'personal' && user?.profileStatus === 'approved' && (
                        <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {profileTab === 'time' && (
                <div className="space-y-2 mb-4">
                  {attendanceLoading ? (
                    <AttendanceHistorySkeleton />
                  ) : (
                  <>
                  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-800 font-semibold text-sm">
                          {joinRangeDays && (Number(punchShowCount) || 0) >= joinRangeDays
                            ? 'Since joining'
                            : `Last ${Math.max(0, Number(punchShowCount) || 0)} days`}
                        </p>
                        <p className="text-gray-400 text-[10px]">Attendance record</p>
                      </div>
                      <button
                        onClick={() => setPunchOtOnly((v) => !v)}
                        className={`px-2.5 py-1 rounded-full text-[10px] border transition-colors ${
                          punchOtOnly ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white/70 text-gray-600 border-white/60'
                        }`}
                      >
                        {punchOtOnly ? 'OT Only' : 'All'}
                      </button>
                    </div>
                  </div>

                  {timeDaysFiltered.length === 0 ? (
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                      <p className="text-gray-500 text-sm">
                        {punchOtOnly ? 'No OT found in this range.' : 'No records found.'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 bg-gray-900 text-white text-[8px] font-bold uppercase tracking-wider">
                        <div className="col-span-2 px-2 py-2">Date</div>
                        <div className="col-span-2 px-1 py-2 text-center">In</div>
                        <div className="col-span-2 px-1 py-2 text-center">Out</div>
                        <div className="col-span-2 px-1 py-2 text-center">Work</div>
                        <div className="col-span-2 px-1 py-2 text-center">OT</div>
                        <div className="col-span-2 px-1 py-2 text-center">Status</div>
                      </div>

                      {/* Table Rows */}
                      {timeDaysFiltered.map(({ day, rec }, idx) => {
                        const isSunday = day.getDay() === 0
                        const now = new Date()
                        const afterCutoff = isAfterMissedPunchOutCutoff(day, now)

                        const inTime = rec?.punchIn?.time
                        const outTime = rec?.punchOut?.time
                        const missingPunchOut = rec?.punchOut?.suspectReason === 'MISSING_PUNCH_OUT'
                        const otMinutes = rec ? getOvertimeMinutes(rec) : 0
                        const hasOt = (Number(otMinutes) || 0) > 0

                        // Only calculate work time when both punch-in AND real punch-out exist
                        const workMins = (() => {
                          if (!inTime || !outTime) return 0
                          if (missingPunchOut) return 0
                          const start = new Date(inTime).getTime()
                          const end = new Date(outTime).getTime()
                          if (!end) return 0
                          return Math.floor((end - start) / (1000 * 60))
                        })()
                        const workH = Math.floor(workMins / 60)
                        const workM = workMins % 60

                        const missedPunchIn = rec && !inTime
                        const missedPunchOut = (rec && !!inTime && !outTime && afterCutoff) || (rec && !!inTime && missingPunchOut)
                        const complete = rec && !!inTime && !!outTime && !missingPunchOut
                        const isAbsent = !rec && !isSunday

                        // Late check
                        const getLateLabel = () => {
                          if (!inTime) return null
                          const t = new Date(inTime)
                          const totalMins = t.getHours() * 60 + t.getMinutes()
                          const target = 9 * 60
                          if (totalMins <= target + 10) return { text: '✓', cls: 'text-emerald-600 bg-emerald-50' }
                          if (totalMins <= target + 45) return { text: 'SL', cls: 'text-amber-600 bg-amber-50' }
                          if (totalMins <= target + 60) return { text: 'L', cls: 'text-orange-600 bg-orange-50' }
                          return { text: 'VL', cls: 'text-red-600 bg-red-50' }
                        }

                        // Status label
                        const getStatus = () => {
                          if (isSunday) return { text: 'Sun', cls: 'bg-violet-100 text-violet-700' }
                          if (isAbsent) return { text: 'A', cls: 'bg-red-100 text-red-600' }
                          if (missedPunchOut) return { text: 'No Out', cls: 'bg-orange-100 text-orange-700' }
                          if (complete) return { text: 'P', cls: 'bg-emerald-100 text-emerald-700' }
                          if (rec && !!inTime && !outTime) return { text: 'Live', cls: 'bg-cyan-100 text-cyan-700' }
                          return { text: 'A', cls: 'bg-red-100 text-red-600' }
                        }

                        const status = getStatus()
                        const late = getLateLabel()
                        const isToday = day.toDateString() === new Date().toDateString()
                        const dateStr = day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        const dayName = day.toLocaleDateString('en-IN', { weekday: 'short' })

                        return (
                          <div
                            key={rec?._id || `${day.toISOString()}-${idx}`}
                            className={`grid grid-cols-12 items-center text-[10px] border-b border-gray-100 ${
                              isToday ? 'bg-cyan-50/80' : isSunday ? 'bg-violet-50/50' : isAbsent ? 'bg-red-50/30' : missedPunchOut ? 'bg-orange-50/40' : idx % 2 === 0 ? 'bg-white/40' : 'bg-gray-50/40'
                            }`}
                          >
                            {/* Date */}
                            <div className="col-span-2 px-2 py-1.5">
                              <p className="font-bold text-gray-800 text-[10px] leading-tight">{dateStr}</p>
                              <p className="text-gray-400 text-[8px]">{dayName}</p>
                            </div>
                            {/* In */}
                            <div className="col-span-2 px-1 py-1.5 text-center">
                              <span className={`font-semibold ${inTime ? 'text-gray-800' : 'text-gray-300'}`}>
                                {inTime ? new Date(inTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/ /g,'') : '--'}
                              </span>
                              {late && (
                                <span className={`ml-0.5 inline-block text-[7px] font-bold px-1 rounded ${late.cls}`}>{late.text}</span>
                              )}
                            </div>
                            {/* Out */}
                            <div className="col-span-2 px-1 py-1.5 text-center">
                              <span className={`font-semibold ${outTime ? 'text-gray-800' : 'text-gray-300'}`}>
                                {outTime ? new Date(outTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/ /g,'') : '--'}
                              </span>
                            </div>
                            {/* Work */}
                            <div className="col-span-2 px-1 py-1.5 text-center">
                              {workMins > 0 ? (
                                <span className="font-bold text-gray-800">{workH}h{workM > 0 ? ` ${workM}m` : ''}</span>
                              ) : (
                                <span className="text-gray-300">--</span>
                              )}
                            </div>
                            {/* OT */}
                            <div className="col-span-2 px-1 py-1.5 text-center">
                              {hasOt ? (
                                <span className="font-bold text-emerald-600">{formatMinutes(otMinutes)}</span>
                              ) : (
                                <span className="text-gray-300">--</span>
                              )}
                            </div>
                            {/* Status */}
                            <div className="col-span-2 px-1 py-1.5 text-center">
                              <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full ${status.cls}`}>
                                {status.text}
                              </span>
                            </div>
                          </div>
                        )
                      })}

                      {/* Summary Row */}
                      <div className="grid grid-cols-12 bg-gray-100 text-[9px] font-bold border-t-2 border-gray-300">
                        <div className="col-span-2 px-2 py-2 text-gray-600">Total</div>
                        <div className="col-span-2 px-1 py-2 text-center text-gray-500">
                          {timeDaysFiltered.filter(({ rec }) => rec?.punchIn?.time).length} days
                        </div>
                        <div className="col-span-2 px-1 py-2 text-center text-gray-500">
                          {timeDaysFiltered.filter(({ rec }) => rec?.punchOut?.time).length} out
                        </div>
                        <div className="col-span-2 px-1 py-2 text-center text-gray-800">
                          {(() => {
                            let totalMins = 0
                            timeDaysFiltered.forEach(({ day, rec }) => {
                              const inTime = rec?.punchIn?.time
                              const outTime = rec?.punchOut?.time
                              if (!inTime) return
                              const start = new Date(inTime).getTime()
                              const end = outTime ? new Date(outTime).getTime() : 0
                              if (!end) return
                              totalMins += Math.floor((end - start) / (1000 * 60))
                            })
                            return `${Math.floor(totalMins / 60)}h`
                          })()}
                        </div>
                        <div className="col-span-2 px-1 py-2 text-center text-emerald-600">
                          {(() => {
                            let totalOt = 0
                            timeDaysFiltered.forEach(({ rec }) => {
                              if (rec) totalOt += getOvertimeMinutes(rec)
                            })
                            return totalOt > 0 ? formatMinutes(totalOt) : '--'
                          })()}
                        </div>
                        <div className="col-span-2 px-1 py-2 text-center text-gray-500">
                          {timeDaysFiltered.filter(({ day, rec }) => !rec && day.getDay() !== 0).length} abs
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Load More / All */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPunchShowCount((n) => n + 10)}
                      className="flex-1 bg-black text-white text-xs font-semibold py-2.5 rounded-2xl"
                    >
                      +10 days
                    </button>
                    <button
                      onClick={() => {
                        const createdAt = user?.createdAt ? new Date(user.createdAt) : null
                        const today = getAttendanceDay6am(new Date())
                        if (!createdAt || Number.isNaN(createdAt.getTime())) {
                          setPunchShowCount(365)
                          return
                        }
                        const start = new Date(createdAt)
                        start.setHours(0, 0, 0, 0)
                        const diffDays = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
                        setPunchShowCount(diffDays)
                      }}
                      className="px-4 bg-white/70 border border-white/50 text-gray-800 text-xs font-semibold py-2.5 rounded-2xl"
                    >
                      All
                    </button>
                  </div>

                  {/* Legend / Help */}
                  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-3 shadow-sm">
                    <p className="text-gray-700 font-semibold text-[11px] mb-2">Status Legend</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">P</span>
                        <span className="text-[10px] text-gray-600">Present (In + Out done)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">A</span>
                        <span className="text-[10px] text-gray-600">Absent (No punch)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">No Out</span>
                        <span className="text-[10px] text-gray-600">Punch-out not done</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700">Live</span>
                        <span className="text-[10px] text-gray-600">Working now</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Sun</span>
                        <span className="text-[10px] text-gray-600">Sunday (Holiday)</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <p className="text-gray-500 text-[10px] font-semibold mb-1">Late Indicators</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="flex items-center gap-1"><span className="text-[7px] font-bold px-1 rounded bg-emerald-50 text-emerald-600">✓</span><span className="text-[9px] text-gray-500">On Time</span></span>
                        <span className="flex items-center gap-1"><span className="text-[7px] font-bold px-1 rounded bg-amber-50 text-amber-600">SL</span><span className="text-[9px] text-gray-500">Slight Late</span></span>
                        <span className="flex items-center gap-1"><span className="text-[7px] font-bold px-1 rounded bg-orange-50 text-orange-600">L</span><span className="text-[9px] text-gray-500">Late</span></span>
                        <span className="flex items-center gap-1"><span className="text-[7px] font-bold px-1 rounded bg-red-50 text-red-600">VL</span><span className="text-[9px] text-gray-500">Very Late</span></span>
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              )}

              {profileTab !== 'time' && profileTab !== 'personal' && (
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm mb-4">
                  <p className="text-gray-800 font-semibold">{profileTab.charAt(0).toUpperCase() + profileTab.slice(1)}</p>
                  <p className="text-gray-400 text-sm">Coming soon</p>
                </div>
              )}

              {/* Verified Profile Details Section */}
              {profileTab === 'personal' && user?.profileStatus === 'approved' && (
                <div className="space-y-3 mb-4">
                  {/* Verified Badge Header */}
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-emerald-800">Profile Verified</p>
                        <p className="text-emerald-600 text-xs">Your profile has been verified by HR</p>
                      </div>
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="font-semibold text-gray-800">Personal Information</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Full Name</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Date of Birth</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-IN') : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Gender</p>
                        <p className="text-sm text-gray-800 font-medium capitalize">{user?.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Blood Group</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.bloodGroup || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Marital Status</p>
                        <p className="text-sm text-gray-800 font-medium capitalize">{user?.maritalStatus || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Nationality</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.nationality || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <p className="font-semibold text-gray-800">Contact Information</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Phone</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Alternate Phone</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.alternatePhone || 'N/A'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Personal Email</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.personalEmail || 'N/A'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Current Address</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.currentAddress || 'N/A'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Permanent Address</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.permanentAddress || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">City</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.city || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">State</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.state || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Pincode</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.pincode || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Employment Information */}
                  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="font-semibold text-gray-800">Employment Information</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Employee ID</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.employeeId || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Designation</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.designation || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Department</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.department || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Employment Type</p>
                        <p className="text-sm text-gray-800 font-medium capitalize">{user?.employmentType || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Date of Joining</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.dateOfJoining ? new Date(user.dateOfJoining).toLocaleDateString('en-IN') : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Work Location</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.workLocation || 'N/A'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Shift</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.shift || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Identity Documents */}
                  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                      <p className="font-semibold text-gray-800">Identity Documents</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Aadhar Number</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.aadharNumber ? `XXXX-XXXX-${user.aadharNumber.slice(-4)}` : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">PAN Number</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.panNumber ? `XXXXX${user.panNumber.slice(-5)}` : 'N/A'}</p>
                      </div>
                      {user?.passportNumber && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Passport</p>
                          <p className="text-sm text-gray-800 font-medium">{user.passportNumber}</p>
                        </div>
                      )}
                      {user?.drivingLicense && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Driving License</p>
                          <p className="text-sm text-gray-800 font-medium">{user.drivingLicense}</p>
                        </div>
                      )}
                      {user?.voterId && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Voter ID</p>
                          <p className="text-sm text-gray-800 font-medium">{user.voterId}</p>
                        </div>
                      )}
                    </div>
                    {/* Document Images */}
                    {(user?.aadharFrontUrl || user?.aadharBackUrl || user?.panCardUrl) && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Uploaded Documents</p>
                        <div className="flex flex-wrap gap-2">
                          {user?.aadharFrontUrl && (
                            <div className="relative">
                              <img 
                                src={`${API_URL}/storage/document?url=${encodeURIComponent(user.aadharFrontUrl.startsWith('http') ? user.aadharFrontUrl : `${window.location.origin.replace(':5173', ':5000')}${user.aadharFrontUrl}`)}`}
                                alt="Aadhar Front" 
                                className="w-16 h-12 object-cover rounded-lg border border-gray-200"
                              />
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-black/60 text-white px-1.5 py-0.5 rounded">Aadhar F</span>
                            </div>
                          )}
                          {user?.aadharBackUrl && (
                            <div className="relative">
                              <img 
                                src={`${API_URL}/storage/document?url=${encodeURIComponent(user.aadharBackUrl.startsWith('http') ? user.aadharBackUrl : `${window.location.origin.replace(':5173', ':5000')}${user.aadharBackUrl}`)}`}
                                alt="Aadhar Back" 
                                className="w-16 h-12 object-cover rounded-lg border border-gray-200"
                              />
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-black/60 text-white px-1.5 py-0.5 rounded">Aadhar B</span>
                            </div>
                          )}
                          {user?.panCardUrl && (
                            <div className="relative">
                              <img 
                                src={`${API_URL}/storage/document?url=${encodeURIComponent(user.panCardUrl.startsWith('http') ? user.panCardUrl : `${window.location.origin.replace(':5173', ':5000')}${user.panCardUrl}`)}`}
                                alt="PAN Card" 
                                className="w-16 h-12 object-cover rounded-lg border border-gray-200"
                              />
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-black/60 text-white px-1.5 py-0.5 rounded">PAN</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bank Details */}
                  <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <p className="font-semibold text-gray-800">Bank Details</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Bank Name</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.bankName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Account Number</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.accountNumber ? `XXXXXX${user.accountNumber.slice(-4)}` : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">IFSC Code</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.ifscCode || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">UAN Number</p>
                        <p className="text-sm text-gray-800 font-medium">{user?.uanNumber || 'N/A'}</p>
                      </div>
                      {user?.esiNumber && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">ESI Number</p>
                          <p className="text-sm text-gray-800 font-medium">{user.esiNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  {user?.emergencyContact?.name && (
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <p className="font-semibold text-gray-800">Emergency Contact</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Name</p>
                          <p className="text-sm text-gray-800 font-medium">{user?.emergencyContact?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Relationship</p>
                          <p className="text-sm text-gray-800 font-medium capitalize">{user?.emergencyContact?.relationship || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Phone</p>
                          <p className="text-sm text-gray-800 font-medium">{user?.emergencyContact?.phone || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {user?.education && user.education.length > 0 && (
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                        </svg>
                        <p className="font-semibold text-gray-800">Education</p>
                      </div>
                      <div className="space-y-2">
                        {user.education.map((edu, idx) => (
                          <div key={idx} className="bg-gray-50/50 rounded-xl p-3">
                            <p className="text-sm font-semibold text-gray-800">{edu.degree || 'N/A'}</p>
                            <p className="text-xs text-gray-600">{edu.institution || 'N/A'}</p>
                            <div className="flex gap-3 mt-1">
                              {edu.yearOfPassing && <span className="text-[10px] text-gray-500">Year: {edu.yearOfPassing}</span>}
                              {edu.percentage && <span className="text-[10px] text-gray-500">Score: {edu.percentage}%</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Work Experience */}
                  {user?.experience && user.experience.length > 0 && (
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <p className="font-semibold text-gray-800">Work Experience</p>
                      </div>
                      <div className="space-y-2">
                        {user.experience.map((exp, idx) => (
                          <div key={idx} className="bg-gray-50/50 rounded-xl p-3">
                            <p className="text-sm font-semibold text-gray-800">{exp.designation || 'N/A'}</p>
                            <p className="text-xs text-gray-600">{exp.company || 'N/A'}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {exp.fromDate && <span className="text-[10px] text-gray-500">From: {new Date(exp.fromDate).toLocaleDateString('en-IN')}</span>}
                              {exp.toDate && <span className="text-[10px] text-gray-500">To: {new Date(exp.toDate).toLocaleDateString('en-IN')}</span>}
                            </div>
                            {exp.reasonForLeaving && <p className="text-[10px] text-gray-500 mt-1">Reason: {exp.reasonForLeaving}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Locked Profile Notice & Contact HR */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-amber-800 text-sm">Profile Locked</p>
                        <p className="text-amber-700 text-xs mt-0.5">Your verified profile is locked. Contact HR to request changes.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // Navigate to social tab to DM HR
                        setActiveTab('social');
                        showNotification('Message HR to request profile unlock', 'success');
                      }}
                      className="w-full mt-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Contact HR to Unlock
                    </button>
                  </div>
                </div>
              )}

              {/* Info Cards */}
              <div className="space-y-2">
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-5"
            >
              <h2 className="text-xl font-bold mb-5 text-slate-900">Settings</h2>

              <div className="space-y-3">
                <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">Account</p>
                      <p className="text-white/50 text-sm">Profile & security</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/profile-details')}
                      className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                    >
                      <span>Profile Details</span>
                      <span className="text-white/40">›</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/profile-details', { state: { openChangePassword: true } })}
                      className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                    >
                      <span>Change Password</span>
                      <span className="text-white/40">›</span>
                    </motion.button>
                  </div>
                </div>

                <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">App</p>
                      <p className="text-white/50 text-sm">Quick actions</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab('inbox')}
                      className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                    >
                      <span>Open Inbox</span>
                      <span className="text-white/40">›</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRefresh}
                      className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                    >
                      <span>Refresh App</span>
                      <span className="text-white/40">›</span>
                    </motion.button>
                  </div>
                </div>

              </div>

              {user?.role === 'admin' && (
                <motion.button
                  onClick={() => navigate('/admin')}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold py-3.5 rounded-2xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Admin Panel
                </motion.button>
              )}

              <motion.button
                onClick={handleLogout}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-3 bg-white/5 backdrop-blur-xl border border-white/10 text-white font-semibold py-3.5 rounded-2xl hover:bg-white/10 transition-all shadow-sm"
              >
                Logout
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Payslip Modal */}
      <AnimatePresence>
        {payslipModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPayslipModalOpen(false)}
            className="absolute inset-0 bg-black/60 z-50"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-24"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-800">Payslip</h2>
                <button
                  onClick={() => setPayslipModalOpen(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {payslipLoading ? (
                <p className="text-gray-500 text-sm">Checking availability...</p>
              ) : payslipAvailability?.canDownload ? (
                <div className="space-y-3">
                  <div className="bg-gray-100 rounded-xl p-3">
                    <p className="text-gray-600 text-xs">Approved Month</p>
                    <p className="text-gray-900 font-semibold">{payslipAvailability.month}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleViewPayslip}
                      className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm font-semibold"
                    >
                      View
                    </button>
                    <button
                      onClick={handleDownloadPayslip}
                      className="flex-1 py-2.5 bg-gray-100 text-gray-800 rounded-xl text-sm font-semibold"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Payslip not approved yet.</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Panel Slide-up */}
      <AnimatePresence>
        {showNotificationPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNotificationPanel(false)}
            className="absolute inset-0 bg-black/50 z-50"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Notifications</h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowNotificationPanel(false)}
                    className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </motion.button>
                </div>
                
                <div className="space-y-3">
                  {/* OT Alert */}
                  {getOvertimeMinutes(effectiveTodayAttendance, { assumeNowIfNoPunchOut: true }) > 0 && (
                    <div className="flex items-start gap-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Overtime Recorded</p>
                        <p className="text-gray-500 text-sm">
                          You worked {Math.floor(getOvertimeMinutes(effectiveTodayAttendance, { assumeNowIfNoPunchOut: true }) / 60)}h {getOvertimeMinutes(effectiveTodayAttendance, { assumeNowIfNoPunchOut: true }) % 60}m extra today!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Duty Hours Info */}
                  <div className="flex items-start gap-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-2xl p-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Duty Hours</p>
                      <p className="text-gray-500 text-sm">Your shift: 9:00 AM - 6:30 PM (Mon–Sat). OT is the higher of: (a) minutes after 6:30 PM (only after 7:30 PM threshold) or (b) minutes beyond 9h 30m. Sunday: all OT.</p>
                    </div>
                  </div>

                  {/* Reminder */}
                  <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-2xl p-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Don't forget!</p>
                      <p className="text-gray-500 text-sm">Remember to punch out before leaving office.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Panel Slide-down from Top */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMenu(false)}
            className="absolute inset-0 bg-black/70 z-50"
          >
            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-0 left-0 right-0 bg-black rounded-b-3xl"
            >
              <div className="p-4">
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-1 mb-3" />
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-white">Menu</h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowMenu(false)}
                    className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </motion.button>
                </div>
                
                {/* Grid Menu */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setActiveTab('home'); setShowMenu(false); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    </div>
                    <span className="text-[10px] text-white/70 font-medium">Home</span>
                  </motion.button>
                  
                  
                  {user?.role === 'hr' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { navigate('/hr-dashboard'); setShowMenu(false); }}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <span className="text-[10px] text-white/70 font-medium">HR</span>
                    </motion.button>
                  )}
                  
                  {user?.role === 'manager' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { navigate('/manager-dashboard'); setShowMenu(false); }}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </div>
                      <span className="text-[10px] text-white/70 font-medium">Manager</span>
                    </motion.button>
                  )}
                  
                  {['admin', 'ceo', 'hr', 'manager', 'employee'].includes(user?.role) && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { navigate('/my-team'); setShowMenu(false); }}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <span className="text-[10px] text-white/70 font-medium">Team</span>
                    </motion.button>
                  )}
                  
                  {['admin', 'ceo'].includes(user?.role) && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { navigate('/admin'); setShowMenu(false); }}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <span className="text-[10px] text-white/70 font-medium">Admin</span>
                    </motion.button>
                  )}
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setActiveTab('profile'); setShowMenu(false); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <span className="text-[10px] text-white/70 font-medium">Profile</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setActiveTab('settings'); setShowMenu(false); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <span className="text-[10px] text-white/70 font-medium">Settings</span>
                  </motion.button>
                </div>
                
                {/* Logout Button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { handleLogout(); setShowMenu(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl py-2.5 mt-1"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  <span className="text-red-400 text-xs font-medium">Logout</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation (fixed to phone bottom) */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black backdrop-blur-xl border-t border-white/10 px-2 py-3 z-50 rounded-t-2xl">
        <div className="w-full flex justify-around">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'team') {
                  navigate('/my-team')
                } else {
                  setActiveTab(tab.id)
                }
              }}
              whileTap={{ scale: 0.9 }}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${
                activeTab === tab.id ? 'bg-white/10' : ''
              }`}
            >
              {/* Badge for inbox */}
              {tab.id === 'inbox' && unreadCount.total > 0 && (
                <span className="absolute -top-1 right-0 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount.total > 99 ? '99+' : unreadCount.total}
                </span>
              )}
              <TabIcon id={tab.id} active={activeTab === tab.id} />
              <span className={`text-[10px] font-medium ${activeTab === tab.id ? 'text-white' : 'text-white/50'}`}>{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </nav>
      </div>
    </div>
  )
}

export default Dashboard
