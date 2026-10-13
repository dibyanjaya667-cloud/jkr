import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import * as faceapi from 'face-api.js'

const parseMode = (value) => {
  if (value === 'in' || value === 'punch-in') return 'in'
  if (value === 'out' || value === 'punch-out') return 'out'
  return 'in'
}

function SelfieCapture() {
  const location = useLocation()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectionRef = useRef(null)
  const happyFramesRef = useRef(0)
  const neutralFramesRef = useRef(0)
  const angryFramesRef = useRef(0)
  const lastPromptRef = useRef(0)
  const capturedRef = useRef(false)
  const [error, setError] = useState('')
  const [captured, setCaptured] = useState('')
  const [ready, setReady] = useState(false)
  const [modelLoading, setModelLoading] = useState(true)
  const [webcamLoading, setWebcamLoading] = useState(true)
  const [status, setStatus] = useState('Loading face model…')
  const [happyScore, setHappyScore] = useState(null)
  const [assistantMessage, setAssistantMessage] = useState('Smile please 🙂')
  const [promptMessage, setPromptMessage] = useState('')
  const [promptTone, setPromptTone] = useState('neutral')

  const assistantTips = [
    'Smile please 🙂',
    'Look at the camera and smile.',
    'Just a small smile will do.',
    'Relax and give a friendly smile.',
    'Hold the phone steady, please.',
    'Keep your face inside the frame.',
    'A soft smile works best!',
    'Almost there—smile a little.',
    'Great lighting helps—smile now.',
  ]

  const neutralPrompts = [
    'Why so neutral? Smile please 🙂',
    'A little smile makes it perfect!',
    'Please smile for a quick capture.',
    'Let’s see a tiny smile 🙂',
    'Smile a bit—done in seconds!',
    'Neutral face? Just smile please 😊',
  ]

  const angryPrompts = [
    'Uh-oh, don’t be angry—be happy 🙂',
    'Relax please, just a friendly smile.',
    'Take a breath and smile 🙂',
    'Let’s keep it calm—smile please.',
    'Be chill and happy, smile now!',
    'No stress, just a quick smile 😊',
  ]

  const pickRandom = (items) => items[Math.floor(Math.random() * items.length)]

  const startCamera = async (forceRestart = false) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera not supported in this browser')
    }

    const hasLiveTrack = streamRef.current?.getTracks?.().some((t) => t.readyState === 'live')
    if (forceRestart || !hasLiveTrack) {
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((track) => track.stop())
        } catch {
          // ignore
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
    }

    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.load()
      try {
        await videoRef.current.play()
      } catch (err) {
        console.warn('Video play interrupted:', err)
      }
    }
  }

  const { mode, ts } = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const modeValue = parseMode(params.get('mode') || params.get('type'))
    const tsValue = params.get('ts') || Date.now().toString()
    return { mode: modeValue, ts: tsValue }
  }, [location.search])

  useEffect(() => {
    let mounted = true
    const modelsUrl = 'https://justadudewhohacks.github.io/face-api.js/models'

    const init = async () => {
      try {
        setStatus('Loading face model…')
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelsUrl),
          faceapi.nets.faceExpressionNet.loadFromUri(modelsUrl),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelsUrl),
        ])
        if (!mounted) return
        setModelLoading(false)
        setStatus('Starting camera…')

        await startCamera()
        if (!mounted) return
        setWebcamLoading(false)
        setReady(true)
        setStatus('Smile to capture selfie')
      } catch (err) {
        setError(err?.message || 'Failed to access camera')
        setStatus('Failed')
      }
    }

    init()

    return () => {
      mounted = false
      if (detectionRef.current) {
        clearInterval(detectionRef.current)
        detectionRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!ready || capturedRef.current) return
    if (!videoRef.current) return

    const video = videoRef.current
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
    const threshold = 0.7

    const tick = async () => {
      if (capturedRef.current || !videoRef.current) return
      try {
        const detection = await faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks(true)
          .withFaceExpressions()

        if (!detection?.expressions) {
          setStatus('Face not detected')
          happyFramesRef.current = 0
          neutralFramesRef.current = 0
          angryFramesRef.current = 0
          setHappyScore(null)
          return
        }

        const happy = Number(detection.expressions.happy || 0)
        const neutral = Number(detection.expressions.neutral || 0)
        const angry = Number(detection.expressions.angry || 0)
        setHappyScore(happy)

        if (happy >= threshold) {
          happyFramesRef.current += 1
          setStatus('Great! Hold still…')
        } else {
          happyFramesRef.current = 0
          setStatus('Smile to capture selfie')
        }

        if (angry >= 0.6) {
          angryFramesRef.current += 1
          neutralFramesRef.current = 0
        } else if (neutral >= 0.7 && happy < 0.4) {
          neutralFramesRef.current += 1
          angryFramesRef.current = 0
        } else {
          neutralFramesRef.current = 0
          angryFramesRef.current = 0
        }

        const now = Date.now()
        const canPrompt = now - lastPromptRef.current > 6000

        if (canPrompt && angryFramesRef.current >= 4) {
          lastPromptRef.current = now
          setPromptTone('angry')
          setPromptMessage(pickRandom(angryPrompts))
          setTimeout(() => setPromptMessage(''), 3000)
          angryFramesRef.current = 0
        } else if (canPrompt && neutralFramesRef.current >= 6) {
          lastPromptRef.current = now
          setPromptTone('neutral')
          setPromptMessage(pickRandom(neutralPrompts))
          setTimeout(() => setPromptMessage(''), 3000)
          neutralFramesRef.current = 0
        }

        if (happyFramesRef.current >= 3) {
          happyFramesRef.current = 0
          capturedRef.current = true
          handleAutoCapture()
        }
      } catch {
        // ignore frame errors
      }
    }

    detectionRef.current = setInterval(tick, 200)

    return () => {
      if (detectionRef.current) {
        clearInterval(detectionRef.current)
        detectionRef.current = null
      }
    }
  }, [ready])

  useEffect(() => {
    if (!ready || captured) return
    const interval = setInterval(() => {
      setAssistantMessage(pickRandom(assistantTips))
    }, 5000)

    return () => clearInterval(interval)
  }, [ready, captured])

  const captureToDataUrl = (video, quality = 0.6) => {
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    const maxSize = 560
    const scale = Math.min(1, maxSize / Math.max(width, height))
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(video, 0, 0, targetW, targetH)
    return canvas.toDataURL('image/jpeg', quality)
  }

  const handleAutoCapture = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    let quality = 0.6
    let dataUrl = captureToDataUrl(video, quality)
    while (dataUrl && dataUrl.length > 280000 && quality > 0.35) {
      quality -= 0.05
      dataUrl = captureToDataUrl(video, quality)
    }
    if (!dataUrl) {
      setError('Unable to capture selfie')
      return
    }
    if (dataUrl.length > 280000) {
      setError('Selfie too large. Please retake closer to the camera.')
      capturedRef.current = false
      setStatus('Smile to capture selfie')
      return
    }
    setCaptured(dataUrl)
    setStatus('Selfie captured')
  }

  const handleRetake = async () => {
    // Stop current detection
    if (detectionRef.current) {
      clearInterval(detectionRef.current)
      detectionRef.current = null
    }

    // Reset all state
    setCaptured('')
    capturedRef.current = false
    happyFramesRef.current = 0
    neutralFramesRef.current = 0
    angryFramesRef.current = 0
    lastPromptRef.current = 0
    setHappyScore(null)
    setError('')
    setPromptMessage('')
    setPromptTone('neutral')
    setReady(false)
    setStatus('Restarting camera…')
    setWebcamLoading(true)

    // Restart camera with proper async handling
    try {
      await startCamera(true)
      setWebcamLoading(false)
      setReady(true)
      setStatus('Smile to capture selfie')
    } catch (err) {
      setWebcamLoading(false)
      setError(err?.message || 'Failed to restart camera')
      setStatus('Failed')
    }
  }

  useEffect(() => {
    if (!captured) {
      startCamera().catch(() => {})
    }
  }, [captured])

  const handleContinue = () => {
    const selfieKey = `attendance_selfie_${mode}`
    if (captured) {
      sessionStorage.setItem(selfieKey, captured)
    }
    window.location.assign(`/location-share?mode=${mode}&ts=${ts}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 flex items-center justify-center">
      <div className="max-w-md w-full">
        {/* Header Card */}
        <div className="bg-white/90 backdrop-blur-lg border border-gray-200 rounded-3xl shadow-2xl overflow-hidden">
          {/* Top Banner */}
          <div className="bg-black px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  {mode === 'in' ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Punch In
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Punch Out
                    </>
                  )}
                </h1>
                <p className="text-indigo-100 text-[11px] mt-0.5">Selfie Verification</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-4">
            {/* Instructions */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-3 mb-3">
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-900 text-[12px]">How it works</h3>
                  <p className="text-gray-600 text-[11px] mt-1 leading-relaxed">
                    Keep your face in the frame and <strong className="text-indigo-700">smile naturally</strong>. The camera auto-captures on a real smile.
                  </p>
                </div>
              </div>
            </div>

            {/* Assistant */}
            <div className="mb-3 flex items-start gap-3 bg-white/90 border border-indigo-100 rounded-2xl p-3 shadow-sm">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                😊
              </div>
              <div>
                <div className="text-[11px] font-semibold text-indigo-700">Assistant</div>
                <div className="text-[12px] text-slate-700 mt-0.5">{assistantMessage}</div>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-center gap-2 mb-3">
              {(modelLoading || webcamLoading) && (
                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-[11px] font-medium">
                    {modelLoading ? 'Loading AI model...' : 'Starting camera...'}
                  </span>
                </div>
              )}
              
              {!modelLoading && !webcamLoading && !captured && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-3 py-1.5 rounded-full border border-green-300 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[11px] font-semibold">{status}</span>
                </div>
              )}

              {captured && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-300">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[11px] font-semibold">Selfie captured</span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-xl shadow-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-semibold text-sm">Error</p>
                    <p className="text-xs mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Camera/Preview Section */}
            <div className="relative">
              {!captured && (
                <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gray-900 shadow-xl">
                  <video
                    ref={videoRef}
                    className="w-full h-[300px] object-cover"
                    playsInline
                    autoPlay
                    muted
                  />

                  {promptMessage && (
                    <div className={`absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11px] font-semibold shadow-lg ${
                      promptTone === 'angry'
                        ? 'bg-rose-500 text-white'
                        : 'bg-amber-300 text-slate-900'
                    }`}>
                      {promptMessage}
                    </div>
                  )}
                  
                  {/* Face Detection Overlay */}
                  {ready && !captured && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Corners Frame */}
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
                        {/* Top-left corner */}
                        <path d="M 80 60 L 60 60 L 60 80" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8"/>
                        {/* Top-right corner */}
                        <path d="M 320 60 L 340 60 L 340 80" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8"/>
                        {/* Bottom-left corner */}
                        <path d="M 60 320 L 60 340 L 80 340" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8"/>
                        {/* Bottom-right corner */}
                        <path d="M 340 320 L 340 340 L 320 340" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8"/>
                      </svg>
                      
                      {/* Smile Meter */}
                      {happyScore != null && (
                        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/30">
                          <svg className={`w-5 h-5 ${happyScore >= 0.7 ? 'text-yellow-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
                          </svg>
                          <div className="flex flex-col">
                            <span className="text-white text-[10px] font-medium">Smile</span>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-1.5 w-20 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-200 ${
                                    happyScore >= 0.7 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-gray-500 to-gray-400'
                                  }`}
                                  style={{ width: `${Math.min(100, happyScore * 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-white text-[10px] font-bold min-w-[30px]">{(happyScore * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {captured && (
                <div className="relative overflow-hidden rounded-2xl border-2 border-green-300 bg-gray-900 shadow-xl">
                  <img src={captured} alt="Captured selfie" className="w-full h-[300px] object-cover" />
                  <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1.5 rounded-full font-semibold text-[11px] shadow-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Perfect!
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 space-y-2">
              {captured && (
                <>
                  <button
                    onClick={handleContinue}
                    className="w-full px-5 py-3 rounded-xl text-white text-sm font-bold bg-black hover:bg-gray-800 shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <span>Continue to Location</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  <button
                    onClick={handleRetake}
                    className="w-full px-5 py-2.5 rounded-xl bg-white text-black text-[12px] font-semibold hover:bg-gray-100 border border-gray-300 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retake Selfie
                  </button>
                </>
              )}

              <button
                onClick={() => window.close()}
                className="w-full px-5 py-2.5 rounded-xl bg-white text-black text-[12px] font-semibold hover:bg-gray-100 border border-black transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-3 text-center">
          <p className="text-[10px] text-gray-500">
            🔒 Your selfie is securely stored and used only for attendance verification
          </p>
        </div>
      </div>
    </div>
  )
}

export default SelfieCapture
