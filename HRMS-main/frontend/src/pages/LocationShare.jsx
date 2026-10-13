import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import { API_URL } from '../lib/api'
import { isStorageConfigured, uploadDataUrlToStorage } from '../lib/storage'

const parseMode = (value) => {
  if (value === 'in' || value === 'punch-in') return 'in'
  if (value === 'out' || value === 'punch-out') return 'out'
  return 'in'
}

function LocationShare() {
  const location = useLocation()
  const [step, setStep] = useState('Getting GPS permission…')
  const [error, setError] = useState('')
  const [coords, setCoords] = useState(null)
  const [serverResult, setServerResult] = useState(null)
  const [bestAccuracy, setBestAccuracy] = useState(null)
  const [ready, setReady] = useState(false)
  const [working, setWorking] = useState(false)
  const startedRef = useRef(false)
  const watchIdRef = useRef(null)
  const liveIntervalRef = useRef(null)

  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return parseMode(params.get('mode') || params.get('type'))
  }, [location.search])

  const ts = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('ts') || Date.now().toString()
  }, [location.search])


  const mapEmbedUrl = useMemo(() => {
    if (!coords?.lat || !coords?.lng) return null
    return `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`
  }, [coords])


  const getBestLocationFix = async () => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported in this browser')
    }

    // FAST mobile-first approach: Get location quickly, don't wait too long
    const best = await new Promise((resolve, reject) => {
      let bestFix = null
      let resolved = false
      const startedAt = Date.now()
      const maxMs = 5000  // Only wait 5 seconds max (was 20 seconds)
      const targetAcc = 100 // Accept 100m accuracy (was 30m) - faster on mobile

      const cleanup = () => {
        if (watchIdRef.current != null) {
          try {
            navigator.geolocation.clearWatch(watchIdRef.current)
          } catch {
            // ignore
          }
          watchIdRef.current = null
        }
      }

      const done = (val, isError) => {
        if (resolved) return
        resolved = true
        cleanup()
        if (isError) reject(val)
        else resolve(val)
      }

      // First: Try to get instant cached location (very fast)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const instant = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            address: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
          }
          
          // If accuracy is good enough, use it immediately!
          if (instant.accuracy && instant.accuracy <= targetAcc) {
            setCoords(instant)
            setBestAccuracy(instant.accuracy)
            done(instant)
            return
          }
          
          // Otherwise save as bestFix and continue watching
          bestFix = instant
          setCoords(instant)
          setBestAccuracy(instant.accuracy)
        },
        () => {}, // ignore error, watchPosition will handle it
        { enableHighAccuracy: false, timeout: 2000, maximumAge: 30000 } // Allow 30 sec cached
      )

      // Second: Watch for better accuracy (but with shorter timeout)
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (resolved) return
          
          const candidate = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
            address: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
          }

          const candAcc = typeof candidate.accuracy === 'number' ? candidate.accuracy : Number.POSITIVE_INFINITY
          const bestAcc = bestFix && typeof bestFix.accuracy === 'number' ? bestFix.accuracy : Number.POSITIVE_INFINITY

          if (!bestFix || candAcc < bestAcc) {
            bestFix = candidate
            setBestAccuracy(Number.isFinite(candAcc) ? candAcc : null)
            setCoords(candidate)
          }

          // Update status
          if (Number.isFinite(candAcc)) {
            setStep(`📍 GPS: ±${Math.round(candAcc)}m`)
          }

          // If good enough accuracy, stop immediately
          if (Number.isFinite(candAcc) && candAcc <= targetAcc) {
            done(bestFix)
            return
          }

          // After 3 seconds, accept whatever we have if it's reasonable
          if (Date.now() - startedAt >= 3000 && bestFix) {
            done(bestFix)
            return
          }
        },
        (err) => {
          // If we have any fix, use it
          if (bestFix) {
            done(bestFix)
          } else {
            done(err, true)
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      )

      // Safety timeout - much shorter now
      setTimeout(() => {
        if (!resolved) {
          if (bestFix) done(bestFix)
          else done(new Error('Unable to get location. Turn on GPS.'), true)
        }
      }, maxMs)
    })

    return best
  }

  const runPunchRef = useRef(null)

  const runPunch = useCallback(async () => {
    if (working) return
    setWorking(true)
    try {
      setError('')
      const selfieKey = `attendance_selfie_${mode}`
      let selfie = sessionStorage.getItem(selfieKey)
      if (!selfie) {
        const msg = `Selfie required before Punch ${mode === 'in' ? 'In' : 'Out'}`
        setStep(msg)
        setError(msg)
        return
      }
      let usedLocalSelfieFallback = false
      if (selfie?.startsWith('data:image/') && isStorageConfigured()) {
        setStep('Uploading selfie…')
        const folder = mode === 'in' ? 'attendance/punch-in' : 'attendance/punch-out'
        try {
          selfie = await uploadDataUrlToStorage(selfie, folder)
        } catch (uploadError) {
          // The attendance API accepts the compressed capture directly when cloud storage is unavailable.
          console.warn('[Attendance] Selfie upload failed; using local selfie fallback.', uploadError)
          usedLocalSelfieFallback = true
        }
      }
      setStep('Getting your GPS location…')

      const loc = await getBestLocationFix()
      setStep(`Sending ${mode === 'in' ? 'Punch In' : 'Punch Out'} to server…`)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Not logged in (token missing)')
      }

      const endpoint = mode === 'in' ? 'punch-in' : 'punch-out'
      const body = selfie ? { ...loc, selfie } : loc
      const res = await axios.post(`${API_URL}/attendance/${endpoint}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      sessionStorage.removeItem(selfieKey)

      const payload = {
        kind: 'attendance:update',
        mode,
        attendance: res.data?.attendance,
        location: res.data?.location || loc,
        message: res.data?.message,
      }

      setServerResult(payload)
      setStep(
        usedLocalSelfieFallback
          ? 'Punched successfully. Cloud selfie upload was unavailable, so the selfie was saved with this attendance record.'
          : 'Done! You can close this page.'
      )

      if (mode === 'in') {
        try {
          if (liveIntervalRef.current) clearInterval(liveIntervalRef.current)
          liveIntervalRef.current = setInterval(async () => {
            try {
              const live = await getBestLocationFix()
              setCoords(live)
              await axios.post(`${API_URL}/attendance/location`, live, {
                headers: { Authorization: `Bearer ${token}` },
              })
            } catch {
              // ignore
            }
          }, 15000)
        } catch {
          // ignore
        }
      }

      try {
        if (window.opener && window.opener !== window) {
          window.opener.postMessage(payload, window.location.origin)
        }
      } catch {
        // ignore
      }
    } catch (e) {
      const msg = e?.message || 'Failed to share location'
      setError(msg)
      setStep('Failed')
      try {
        if (window.opener && window.opener !== window) {
          window.opener.postMessage(
            { kind: 'attendance:error', mode, message: msg },
            window.location.origin
          )
        }
      } catch {
        // ignore
      }
    } finally {
      setWorking(false)
    }
  }, [mode, working])

  // Store runPunch in ref to avoid re-running useEffect
  useEffect(() => {
    runPunchRef.current = runPunch
  }, [runPunch])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    // Don't auto-run - wait for user to click button
    setReady(true)
    setStep(mode === 'in' ? 'Click button to Punch In' : 'Click button to Punch Out')
  }, [mode])

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current)
        } catch {
          // ignore
        }
      }
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-black px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-white">
                  {mode === 'in' ? 'Punch In' : 'Punch Out'}
                </h1>
                <p className="text-white/60 text-[11px]">Location verification</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            <p className="text-gray-600 text-[12px] mb-3">{step}</p>

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {coords && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  <span className="bg-black/5 px-2.5 py-1 rounded-full text-[11px] text-gray-700">
                    Lat: {coords.lat.toFixed(6)}
                  </span>
                  <span className="bg-black/5 px-2.5 py-1 rounded-full text-[11px] text-gray-700">
                    Lng: {coords.lng.toFixed(6)}
                  </span>
                  {typeof coords.accuracy === 'number' && (
                    <span className="bg-black/5 px-2.5 py-1 rounded-full text-[11px] text-gray-700">
                      ±{Math.round(coords.accuracy)}m
                    </span>
                  )}
                </div>
              </div>
            )}

            {mapEmbedUrl && (
              <div className="mb-3 overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-100">
                <iframe
                  title="Google Maps"
                  src={mapEmbedUrl}
                  width="100%"
                  height="240"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}

            <div className="mt-4 space-y-2">
              {error?.toLowerCase().includes('selfie') && (
                <button
                  onClick={() => window.location.assign(`/selfie-capture?mode=${mode}&ts=${ts}`)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Open Selfie Capture
                </button>
              )}

              {ready && !working && !serverResult?.attendance && !error && (
                <button
                  onClick={() => {
                    if (working || serverResult?.attendance) return
                    runPunch()
                  }}
                  disabled={working}
                  className="w-full px-4 py-2.5 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {mode === 'in' ? '📍 Confirm Punch In' : '📍 Confirm Punch Out'}
                </button>
              )}

              {working && (
                <div className="flex flex-col items-center justify-center py-6 w-full">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                  </div>
                  <p className="text-gray-700 font-medium text-sm mt-4">Getting location...</p>
                  <p className="text-gray-500 text-xs mt-1">Please wait</p>
                </div>
              )}

              {serverResult?.attendance && (
                <>
                  <div className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl w-full">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-700 font-semibold text-sm">Saved successfully!</span>
                  </div>
                  <button
                    onClick={() => window.close()}
                    className="w-full px-4 py-2.5 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors"
                  >
                    Close
                  </button>
                </>
              )}

              {error && !working && !serverResult?.attendance && (
                <button
                  onClick={() => {
                    if (working || serverResult?.attendance) return
                    setError('')
                    runPunch()
                  }}
                  disabled={working}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  Retry {mode === 'in' ? 'Punch In' : 'Punch Out'}
                </button>
              )}

              {!serverResult?.attendance && (
                <button
                  onClick={() => window.close()}
                  className={`${error ? 'flex-1' : 'w-full'} px-4 py-2.5 rounded-xl bg-white text-black border border-black text-sm font-semibold hover:bg-gray-100 transition-colors`}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3 text-center">
          💡 Turn on device GPS for accurate location
        </p>
      </div>
    </div>
  )
}

export default LocationShare
