import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'

// Monochrome avatar colors for professional B&W theme
const avatarColors = [
  'from-gray-700 to-gray-900',
  'from-zinc-600 to-zinc-800',
  'from-neutral-600 to-neutral-800',
  'from-stone-600 to-stone-800',
  'from-slate-600 to-slate-800',
  'from-gray-600 to-black',
]

const emojiList = ['😀', '😁', '😊', '😍', '😎', '🤝', '👍', '👏', '🙌', '🔥', '🎉', '💯', '😇', '🤔', '🙏', '✅', '❤️', '💼', '📣', '⭐']

const getAvatarColor = (user) => {
  const str = user?._id || user?.email || user?.name || 'default'
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

const getInitials = (user) => {
  const name = user?.name || user?.email?.split('@')[0] || ''
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

const formatTime = (dt) => {
  try {
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const getMessagePreview = (msg) => {
  if (!msg) return 'No messages yet'
  if (msg.type === 'image') return 'Photo'
  if (msg.type === 'attachment') return 'File'
  if (msg.type === 'post') return 'Shared post'
  const txt = String(msg.content || '').trim()
  return txt || 'Message'
}

// Professional Skeleton Loader Components
const SkeletonPulse = ({ className }) => (
  <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded ${className}`} />
)

const ConversationSkeleton = () => (
  <div className="flex items-center gap-3 p-3">
    <SkeletonPulse className="w-12 h-12 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <SkeletonPulse className="h-4 w-3/4 rounded" />
      <SkeletonPulse className="h-3 w-1/2 rounded" />
    </div>
  </div>
)

const FriendSkeleton = () => (
  <div className="flex flex-col items-center gap-2 flex-shrink-0">
    <SkeletonPulse className="w-14 h-14 rounded-full" />
    <SkeletonPulse className="h-3 w-12 rounded" />
  </div>
)

const ChatMessageSkeleton = ({ isMine }) => (
  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
    <div className={`max-w-[70%] space-y-2 ${isMine ? 'items-end' : 'items-start'}`}>
      <SkeletonPulse className={`h-12 ${isMine ? 'w-48' : 'w-56'} rounded-2xl`} />
      <SkeletonPulse className="h-2 w-16 rounded" />
    </div>
  </div>
)

const ProfileSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <SkeletonPulse className="w-20 h-20 rounded-2xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonPulse className="h-6 w-3/4 rounded" />
        <SkeletonPulse className="h-4 w-1/2 rounded" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <SkeletonPulse className="h-20 rounded-2xl" />
      <SkeletonPulse className="h-20 rounded-2xl" />
    </div>
  </div>
)

const PostSkeleton = () => (
  <div className="rounded-2xl overflow-hidden bg-gray-100">
    <SkeletonPulse className="w-full h-32" />
    <div className="p-3 space-y-2">
      <SkeletonPulse className="h-3 w-1/4 rounded" />
      <SkeletonPulse className="h-4 w-full rounded" />
    </div>
  </div>
)

const SocialWidget = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('messages')

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] })
  const [friends, setFriends] = useState([])
  const [conversations, setConversations] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({ unreadMessages: 0, pendingRequests: 0, total: 0 })

  // Loading states for professional skeleton loaders
  const [initialLoading, setInitialLoading] = useState(true)
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)

  const [chatSearch, setChatSearch] = useState('')

  const [activeChatUser, setActiveChatUser] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedAttachment, setSelectedAttachment] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileData, setProfileData] = useState(null)
  const [mutualFriends, setMutualFriends] = useState([])

  const [showSharePostModal, setShowSharePostModal] = useState(false)
  const [recentPosts, setRecentPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  const [previewImage, setPreviewImage] = useState(null)
  const [toast, setToast] = useState(null)
  const [msgAction, setMsgAction] = useState(null) // { msgId, isMine }

  const typingTimeoutRef = useRef(null)
  const imageInputRef = useRef(null)
  const attachmentInputRef = useRef(null)
  const chatMessagesEndRef = useRef(null)

  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
  const toAssetUrl = (maybeRelativeUrl) => {
    if (!maybeRelativeUrl) return ''
    if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl
    const normalized = String(maybeRelativeUrl).startsWith('/') ? String(maybeRelativeUrl) : `/${maybeRelativeUrl}`
    return `${API_ORIGIN}${normalized}`
  }

  const getToken = () => localStorage.getItem('token')

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 2600)
  }

  // API Functions
  const fetchFriendRequests = async () => {
    const token = getToken()
    if (!token) return
    try {
      const res = await axios.get(`${API_URL}/social/friend-requests`, { headers: { Authorization: `Bearer ${token}` } })
      setFriendRequests(res.data)
    } catch { /* ignore */ }
  }

  const fetchFriends = async (showLoader = false) => {
    const token = getToken()
    if (!token) return
    if (showLoader) setFriendsLoading(true)
    try {
      const res = await axios.get(`${API_URL}/social/friends`, { headers: { Authorization: `Bearer ${token}` } })
      setFriends(res.data)
    } catch { /* ignore */ }
    finally { setFriendsLoading(false) }
  }

  const fetchConversations = async (showLoader = false) => {
    const token = getToken()
    if (!token) return
    if (showLoader) setConversationsLoading(true)
    try {
      const res = await axios.get(`${API_URL}/social/conversations`, { headers: { Authorization: `Bearer ${token}` } })
      setConversations(res.data)
    } catch { /* ignore */ }
    finally { setConversationsLoading(false) }
  }

  // Live social updates via SSE notifications
  useEffect(() => {
    const token = getToken()
    if (!token || typeof window === 'undefined' || typeof EventSource === 'undefined') return

    let es
    let retryTimeout
    let retryMs = 2000
    let closed = false

    const onNotify = (e) => {
      if (!e?.data) return
      let data
      try { data = JSON.parse(e.data) } catch { return }
      if (!data?.type) return

      if (data.type === 'message_received') {
        fetchConversations()
      }
      if (data.type === 'connection_request' || data.type === 'connection_accepted') {
        fetchFriendRequests()
        fetchFriends()
      }
    }

    const connect = () => {
      if (closed) return
      if (es) {
        es.removeEventListener('notification', onNotify)
        es.close()
      }
      es = new EventSource(`${API_URL}/notifications/stream?token=${encodeURIComponent(token)}`)
      es.addEventListener('notification', onNotify)
      es.addEventListener('connected', () => {
        retryMs = 2000
      })
      es.onerror = () => {
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
        es.removeEventListener('notification', onNotify)
        es.close()
      }
    }
  }, [])

  const fetchUnreadCounts = async () => {
    const token = getToken()
    if (!token) return
    try {
      const res = await axios.get(`${API_URL}/social/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
      setUnreadCounts(res.data)
    } catch { /* ignore */ }
  }

  const searchColleagues = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const token = getToken()
      if (!token) return
      const res = await axios.get(`${API_URL}/social/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSearchResults(res.data)
    } finally {
      setSearchLoading(false)
    }
  }

  const fetchProfile = async (userId) => {
    const token = getToken()
    if (!token) return
    setProfileLoading(true)
    try {
      const [profileRes, mutualRes] = await Promise.all([
        axios.get(`${API_URL}/social/profile/${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/social/mutual-friends/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      setProfileData(profileRes.data)
      setMutualFriends(mutualRes.data?.friends || [])
      setShowProfileModal(true)
    } catch {
      showToast('Failed to load profile', 'error')
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchRecentPosts = async () => {
    const token = getToken()
    if (!token) return
    setLoadingPosts(true)
    try {
      const res = await axios.get(`${API_URL}/wall?page=1&limit=10`, { headers: { Authorization: `Bearer ${token}` } })
      setRecentPosts(res.data?.posts || [])
    } catch {
      showToast('Failed to load posts', 'error')
    } finally {
      setLoadingPosts(false)
    }
  }

  const sendTypingStatus = async (typing) => {
    const token = getToken()
    if (!token || !activeChatUser) return
    try {
      await axios.post(`${API_URL}/social/typing`, { toUserId: activeChatUser._id, isTyping: typing }, { headers: { Authorization: `Bearer ${token}` } })
    } catch { /* ignore */ }
  }

  const fetchTypingStatus = async (otherUserId) => {
    const token = getToken()
    if (!token || !otherUserId) return
    try {
      const res = await axios.get(`${API_URL}/social/typing/${otherUserId}`, { headers: { Authorization: `Bearer ${token}` } })
      setIsTyping(!!res.data?.isTyping)
    } catch { /* ignore */ }
  }

  const sendFriendRequest = async (toUserId) => {
    const token = getToken()
    if (!token) return
    try {
      await axios.post(`${API_URL}/social/friend-request`, { toUserId }, { headers: { Authorization: `Bearer ${token}` } })
      showToast('Request sent!', 'success')
      searchColleagues(search)
      fetchFriendRequests()
      fetchUnreadCounts()
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to send request'
      showToast(errorMsg, 'error')
    }
  }

  const handleFriendRequest = async (requestId, action) => {
    const token = getToken()
    if (!token) return
    try {
      await axios.put(`${API_URL}/social/friend-request/${requestId}`, { action }, { headers: { Authorization: `Bearer ${token}` } })
      fetchFriendRequests()
      fetchFriends()
      fetchUnreadCounts()
      showToast(action === 'accept' ? 'Request accepted!' : 'Request declined', 'success')
    } catch { /* ignore */ }
  }

  const fetchMessages = async (userId) => {
    const token = getToken()
    if (!token) return
    setMessagesLoading(true)
    try {
      const res = await axios.get(`${API_URL}/social/messages/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      setChatMessages(res.data)
      fetchConversations()
      fetchUnreadCounts()
    } catch { /* ignore */ }
    finally { setMessagesLoading(false) }
  }

  const removeSelectedFile = () => {
    setSelectedImage(null)
    setSelectedAttachment(null)
    setImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      showToast('Max 8MB allowed', 'error')
      return
    }
    setSelectedAttachment(null)
    setSelectedImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleAttachmentSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      showToast('Max 8MB allowed', 'error')
      return
    }
    setSelectedImage(null)
    setImagePreview(null)
    setSelectedAttachment(file)
  }

  const handleEmojiSelect = (emoji) => {
    setChatInput((v) => `${v}${emoji}`)
    setShowEmojiPicker(false)
  }

  const sendMessage = async (override = {}) => {
    if (!activeChatUser) return
    const token = getToken()
    if (!token) return

    const file = override.file || selectedImage || selectedAttachment
    const postId = override.postId
    const content = (override.content ?? chatInput).trim()

    if (!content && !file && !postId) return

    try {
      const fd = new FormData()
      fd.append('toUserId', activeChatUser._id)
      fd.append('content', content)
      if (postId) fd.append('postId', postId)
      if (file) fd.append('file', file)

      const res = await axios.post(`${API_URL}/social/messages`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      })

      setChatMessages((prev) => [...prev, res.data])
      setChatInput('')
      removeSelectedFile()
      setShowEmojiPicker(false)
      fetchConversations()
      fetchUnreadCounts()
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send'
      showToast(msg, 'error')
    }
  }

  const openChat = (friendUser) => {
    setActiveTab('messages')
    setActiveChatUser(friendUser)
    setShowEmojiPicker(false)
    removeSelectedFile()
    fetchMessages(friendUser._id)
  }

  const closeChat = () => {
    sendTypingStatus(false)
    setActiveChatUser(null)
    setChatMessages([])
    setChatInput('')
    setIsTyping(false)
    setShowEmojiPicker(false)
    setMsgAction(null)
    removeSelectedFile()
  }

  const deleteForMe = async (msgId) => {
    try {
      await axios.patch(`${API_URL}/social/messages/${msgId}/delete-for-me`, {}, { headers: { Authorization: `Bearer ${getToken()}` } })
      setChatMessages(prev => prev.filter(m => m._id !== msgId))
      showToast('Deleted for you', 'success')
    } catch { showToast('Failed to delete', 'error') }
    setMsgAction(null)
  }

  const deleteForEveryone = async (msgId) => {
    try {
      await axios.patch(`${API_URL}/social/messages/${msgId}/delete-for-everyone`, {}, { headers: { Authorization: `Bearer ${getToken()}` } })
      setChatMessages(prev => prev.map(m => m._id === msgId ? { ...m, deletedForEveryone: true, content: '', type: 'text', attachment: null, postId: null } : m))
      showToast('Deleted for everyone', 'success')
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error')
    }
    setMsgAction(null)
  }

  const handleChatInputChange = (e) => {
    const val = e.target.value
    setChatInput(val)
    if (!activeChatUser) return
    sendTypingStatus(true)
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => sendTypingStatus(false), 1400)
  }

  // Computed values
  const totalUnread = useMemo(() => {
    return (unreadCounts.unreadMessages || 0) + (unreadCounts.pendingRequests || 0)
  }, [unreadCounts.unreadMessages, unreadCounts.pendingRequests])

  const lastMineIndex = useMemo(() => {
    return chatMessages.reduce((acc, msg, idx) => {
      const mine = msg.from === currentUser?._id || msg.from?._id === currentUser?._id
      return mine ? idx : acc
    }, -1)
  }, [chatMessages, currentUser?._id])

  const filteredConversations = useMemo(() => {
    const q = chatSearch.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const friend = c?.friend
      const name = (friend?.name || friend?.email || '').toLowerCase()
      return name.includes(q)
    })
  }, [conversations, chatSearch])

  const friendsForStories = useMemo(() => {
    const q = chatSearch.trim().toLowerCase()
    const list = q
      ? friends.filter((f) => ((f?.name || f?.email || '').toLowerCase().includes(q)))
      : friends
    return list.slice(0, 10)
  }, [friends, chatSearch])

  // Effects
  useEffect(() => {
    if (!isOpen) return
    const loadInitialData = async () => {
      setInitialLoading(true)
      setConversationsLoading(true)
      setFriendsLoading(true)
      try {
        await Promise.all([
          fetchFriendRequests(),
          fetchFriends(),
          fetchConversations(),
          fetchUnreadCounts()
        ])
      } finally {
        setInitialLoading(false)
        setConversationsLoading(false)
        setFriendsLoading(false)
      }
    }
    loadInitialData()
  }, [isOpen])

  useEffect(() => {
    const timer = window.setTimeout(() => searchColleagues(search), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const interval = window.setInterval(() => fetchUnreadCounts(), 10000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!activeChatUser) return
    const interval = window.setInterval(() => fetchTypingStatus(activeChatUser._id), 1200)
    return () => window.clearInterval(interval)
  }, [activeChatUser?._id])

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length, activeChatUser?._id])

  // Event listeners for opening social panel from outside
  useEffect(() => {
    const handleOpenSocial = () => {
      setIsOpen(true)
      setActiveTab('messages')
    }
    
    const handleOpenFind = () => {
      setIsOpen(true)
      setActiveTab('find')
      setSearch('')
      setSearchResults([])
    }
    
    window.addEventListener('open-social-panel', handleOpenSocial)
    window.addEventListener('open-social-find', handleOpenFind)
    
    return () => {
      window.removeEventListener('open-social-panel', handleOpenSocial)
      window.removeEventListener('open-social-find', handleOpenFind)
    }
  }, [])

  return (
    <>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${
              toast.type === 'success' ? 'bg-black text-white' :
              toast.type === 'error' ? 'bg-red-600 text-white' :
              'bg-gray-800 text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button - Draggable Icon with Badge */}
      <motion.button
        drag
        dragConstraints={{ left: -300, right: 0, top: -500, bottom: 0 }}
        dragElastic={0.1}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
        whileDrag={{ scale: 1.1, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-3 sm:bottom-8 sm:right-8 w-14 h-14 bg-black rounded-full shadow-2xl shadow-black/40 flex items-center justify-center z-[9999] active:scale-95 cursor-grab active:cursor-grabbing touch-none"
      >
        <svg className="w-6 h-6 text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        
        {/* Unread Message Count Badge */}
        {totalUnread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white pointer-events-none"
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </motion.span>
        )}
      </motion.button>

      {/* Full Screen Drawer - Mobile Optimized */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70]"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={() => { closeChat(); setIsOpen(false) }} />

            {/* Main Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-0 bg-white flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - Black Theme */}
              <div className="flex-shrink-0 bg-black text-white px-3 py-3 safe-area-top">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-base font-bold">Social Hub</h1>
                      <p className="text-[10px] text-white/50">Connect with colleagues</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { closeChat(); setIsOpen(false) }}
                    className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Tabs - Only show when not in chat */}
                {!activeChatUser && (
                  <div className="mt-3 flex gap-1.5">
                    <button
                      onClick={() => setActiveTab('messages')}
                      className={`relative flex-1 h-9 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                        activeTab === 'messages'
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Chats
                      {unreadCounts.unreadMessages > 0 && (
                        <span className={`ml-1 min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          activeTab === 'messages' ? 'bg-black text-white' : 'bg-red-500 text-white'
                        }`}>
                          {unreadCounts.unreadMessages > 9 ? '9+' : unreadCounts.unreadMessages}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('find')}
                      className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                        activeTab === 'find'
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Find
                    </button>
                    <button
                      onClick={() => setActiveTab('connections')}
                      className={`relative flex-1 h-9 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                        activeTab === 'connections'
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      People
                      {unreadCounts.pendingRequests > 0 && (
                        <span className={`ml-1 min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          activeTab === 'connections' ? 'bg-black text-white' : 'bg-red-500 text-white'
                        }`}>
                          {unreadCounts.pendingRequests > 9 ? '9+' : unreadCounts.pendingRequests}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Content Area */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  {!activeChatUser ? (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full overflow-y-auto scrollbar-hide"
                    >
                      {/* Messages Tab */}
                      {activeTab === 'messages' && (
                        <div className="px-4 py-4">
                          {/* Search Bar */}
                          <div className="relative mb-4">
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              value={chatSearch}
                              onChange={(e) => setChatSearch(e.target.value)}
                              placeholder="Search conversations..."
                              className="w-full h-12 pl-12 pr-4 rounded-xl bg-gray-100 text-black placeholder-gray-400 outline-none focus:ring-2 focus:ring-black/20 transition-all"
                            />
                          </div>

                          {/* Quick Access - Friends Row with Skeleton */}
                          {friendsLoading ? (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Access</p>
                              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                                {[1, 2, 3, 4, 5].map((i) => <FriendSkeleton key={i} />)}
                              </div>
                            </div>
                          ) : friendsForStories.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Access</p>
                              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                                {friendsForStories.map((friend) => (
                                  <button
                                    key={friend._id}
                                    onClick={() => openChat(friend)}
                                    className="flex flex-col items-center gap-2 flex-shrink-0"
                                  >
                                    <div className="relative">
                                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getAvatarColor(friend)} flex items-center justify-center overflow-hidden ring-2 ${friend.isOnline ? 'ring-black' : 'ring-gray-200'}`}>
                                        {friend.profilePicUrl ? (
                                          <img src={toAssetUrl(friend.profilePicUrl)} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-white font-bold text-sm">{getInitials(friend)}</span>
                                        )}
                                      </div>
                                      {friend.isOnline && (
                                        <span className="absolute bottom-0 right-0 w-4 h-4 bg-black rounded-full border-2 border-white" />
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-600 truncate w-14 text-center">
                                      {(friend.name || '').split(' ')[0]}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Conversations List with Skeleton */}
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Chats</p>
                          {conversationsLoading ? (
                            <div className="space-y-1">
                              {[1, 2, 3, 4, 5].map((i) => <ConversationSkeleton key={i} />)}
                            </div>
                          ) : conversations.length === 0 ? (
                            <div className="text-center py-12">
                              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              </div>
                              <p className="text-gray-500 text-sm">No conversations yet</p>
                              <p className="text-gray-400 text-xs mt-1">Start chatting with your colleagues</p>
                              <button
                                onClick={() => setActiveTab('connections')}
                                className="mt-4 px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl active:scale-95 transition-transform"
                              >
                                Find People
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {filteredConversations.map((conv) => (
                                <button
                                  key={conv.friend._id}
                                  onClick={() => openChat(conv.friend)}
                                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                                >
                                  <div className="relative flex-shrink-0">
                                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(conv.friend)} flex items-center justify-center overflow-hidden`}>
                                      {conv.friend?.profilePicUrl ? (
                                        <img src={toAssetUrl(conv.friend.profilePicUrl)} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-white font-bold text-sm">{getInitials(conv.friend)}</span>
                                      )}
                                    </div>
                                    {conv.friend?.isOnline && (
                                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-black rounded-full border-2 border-white" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-gray-900 truncate">
                                        {conv.friend?.name || conv.friend?.email?.split('@')[0]}
                                      </span>
                                      {conv.lastMessage?.createdAt && (
                                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                          {formatTime(conv.lastMessage.createdAt)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                      <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                        {getMessagePreview(conv.lastMessage)}
                                      </span>
                                      {conv.unreadCount > 0 && (
                                        <span className="min-w-[20px] h-5 px-1.5 bg-black text-white text-[11px] font-bold rounded-full flex items-center justify-center ml-2 flex-shrink-0">
                                          {conv.unreadCount}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Find Colleague Tab */}
                      {activeTab === 'find' && (
                        <div className="px-4 py-4">
                          {/* Search Bar */}
                          <div className="relative mb-4">
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              placeholder="Search by name, email or employee ID..."
                              className="w-full h-12 pl-12 pr-4 rounded-xl bg-gray-100 text-black placeholder-gray-400 outline-none focus:ring-2 focus:ring-black/20 transition-all"
                              autoFocus
                            />
                            {search && (
                              <button
                                onClick={() => { setSearch(''); setSearchResults([]) }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center"
                              >
                                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Search Results */}
                          {searchLoading ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Searching...</p>
                              <div className="space-y-2">
                                {[1, 2, 3, 4].map((i) => <ConversationSkeleton key={i} />)}
                              </div>
                            </div>
                          ) : searchResults.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Found {searchResults.length} colleague{searchResults.length > 1 ? 's' : ''}
                              </p>
                              <div className="space-y-2">
                                {searchResults.map((person) => (
                                  <div key={person._id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <button
                                      onClick={() => fetchProfile(person._id)}
                                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarColor(person)} flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm`}
                                    >
                                      {person.profilePicUrl ? (
                                        <img src={toAssetUrl(person.profilePicUrl)} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-white font-bold text-base">{getInitials(person)}</span>
                                      )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-gray-900 truncate">{person.name || person.email?.split('@')[0]}</p>
                                        {person.isVerifiedEmployee && (
                                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                                          </svg>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 truncate">
                                        {[person.designation, person.department].filter(Boolean).join(' • ') || person.employeeId || person.email}
                                      </p>
                                    </div>
                                    {person.isFriend ? (
                                      <button
                                        onClick={() => { setActiveChatUser(person); fetchMessages(person._id) }}
                                        className="h-9 px-4 bg-emerald-500 text-white text-xs font-semibold rounded-xl flex-shrink-0 active:scale-95 transition-transform flex items-center gap-1.5"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        Chat
                                      </button>
                                    ) : person.requestSent ? (
                                      <span className="h-9 px-4 bg-gray-200 text-gray-500 text-xs font-semibold rounded-xl flex items-center">
                                        Requested
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => sendFriendRequest(person._id)}
                                        className="h-9 px-4 bg-black text-white text-xs font-semibold rounded-xl flex-shrink-0 active:scale-95 transition-transform flex items-center gap-1.5"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                        Connect
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : search.length >= 2 ? (
                            <div className="text-center py-12">
                              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <p className="text-gray-500 font-medium">No colleagues found</p>
                              <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <p className="text-gray-700 font-semibold">Find Colleagues</p>
                              <p className="text-gray-400 text-sm mt-1 max-w-[200px] mx-auto">
                                Search for colleagues by their name, email or employee ID to connect
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Connections Tab */}
                      {activeTab === 'connections' && (
                        <div className="px-4 py-4">
                          {/* Friend Requests */}
                          {friendRequests.incoming.length > 0 && (
                            <div className="mb-6">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Requests</p>
                                <span className="px-2 py-0.5 bg-black text-white text-xs font-bold rounded-full">
                                  {friendRequests.incoming.length}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {friendRequests.incoming.map((req) => (
                                  <div key={req._id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
                                    <button
                                      onClick={() => fetchProfile(req.from?._id)}
                                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(req.from)} flex items-center justify-center overflow-hidden flex-shrink-0`}
                                    >
                                      {req.from?.profilePicUrl ? (
                                        <img src={toAssetUrl(req.from.profilePicUrl)} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-white font-bold text-sm">{getInitials(req.from)}</span>
                                      )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-gray-900 truncate">{req.from?.name || req.from?.email?.split('@')[0]}</p>
                                      <p className="text-xs text-gray-500 truncate">{req.from?.designation || req.from?.department}</p>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                      <button
                                        onClick={() => handleFriendRequest(req._id, 'accept')}
                                        className="w-9 h-9 bg-black text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleFriendRequest(req._id, 'reject')}
                                        className="w-9 h-9 bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Friends List */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">My Connections</p>
                              <span className="text-xs text-gray-400">{friends.length}</span>
                            </div>
                            {friends.length === 0 ? (
                              <div className="text-center py-10">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </div>
                                <p className="text-gray-500 text-sm">No connections yet</p>
                                <p className="text-gray-400 text-xs mt-1">Search for colleagues to connect</p>
                                <button
                                  onClick={() => setActiveTab('find')}
                                  className="mt-4 px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl"
                                >
                                  Find Colleagues
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {friends.map((friend) => (
                                  <div key={friend._id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                                    <button
                                      onClick={() => fetchProfile(friend._id)}
                                      className="relative flex-shrink-0"
                                    >
                                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(friend)} flex items-center justify-center overflow-hidden`}>
                                        {friend.profilePicUrl ? (
                                          <img src={toAssetUrl(friend.profilePicUrl)} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-white font-bold text-sm">{getInitials(friend)}</span>
                                        )}
                                      </div>
                                      {friend.isOnline && (
                                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-black rounded-full border-2 border-white" />
                                      )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-gray-900 truncate">{friend.name || friend.email?.split('@')[0]}</p>
                                      <p className="text-xs text-gray-500 truncate">{friend.designation || friend.department}</p>
                                    </div>
                                    <button
                                      onClick={() => openChat(friend)}
                                      className="h-9 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors flex-shrink-0"
                                    >
                                      Message
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    /* Chat View */
                    <motion.div
                      key="chat"
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="h-full flex flex-col bg-gray-50"
                    >
                      {/* Chat Header */}
                      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={closeChat}
                            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100 transition-colors flex-shrink-0"
                          >
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => fetchProfile(activeChatUser._id)}
                            className="relative flex-shrink-0"
                          >
                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(activeChatUser)} flex items-center justify-center overflow-hidden`}>
                              {activeChatUser.profilePicUrl ? (
                                <img src={toAssetUrl(activeChatUser.profilePicUrl)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white font-bold text-xs">{getInitials(activeChatUser)}</span>
                              )}
                            </div>
                            {activeChatUser.isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">
                              {activeChatUser.name || activeChatUser.email?.split('@')[0]}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {isTyping ? (
                                <span className="text-black animate-pulse">Typing...</span>
                              ) : activeChatUser.isOnline ? (
                                <span className="text-emerald-500">Online</span>
                              ) : (
                                activeChatUser.designation || 'Offline'
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => { setShowSharePostModal(true); fetchRecentPosts() }}
                            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100 transition-colors flex-shrink-0"
                          >
                            <svg className="w-[18px] h-[18px] text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Messages Area with Skeleton */}
                      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-hide">
                        {messagesLoading ? (
                          <div className="space-y-3">
                            <ChatMessageSkeleton isMine={false} />
                            <ChatMessageSkeleton isMine={true} />
                            <ChatMessageSkeleton isMine={false} />
                            <ChatMessageSkeleton isMine={true} />
                            <ChatMessageSkeleton isMine={false} />
                          </div>
                        ) : chatMessages.length === 0 ? (
                          <div className="h-full flex items-center justify-center">
                            <p className="text-gray-400 text-sm">Start a conversation</p>
                          </div>
                        ) : (
                          chatMessages.map((msg, idx) => {
                            const isMine = msg.from === currentUser?._id || msg.from?._id === currentUser?._id
                            const attachmentUrl = msg.attachment?.url ? toAssetUrl(msg.attachment.url) : ''
                            const post = msg.postId && typeof msg.postId === 'object' ? msg.postId : null
                            const isDeleted = msg.deletedForEveryone
                            return (
                              <div key={msg._id || idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  onClick={() => !isDeleted && setMsgAction(msgAction?.msgId === msg._id ? null : { msgId: msg._id, isMine })}
                                  className={`max-w-[75%] rounded-2xl px-3 py-2 relative select-none ${
                                    isDeleted
                                      ? 'border border-dashed border-gray-300 bg-transparent'
                                      : isMine
                                        ? 'bg-black text-white rounded-br-sm'
                                        : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                                  }`}
                                >
                                  {isDeleted ? (
                                    <p className="text-xs text-gray-400 italic flex items-center gap-1">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                      This message was deleted
                                    </p>
                                  ) : (
                                    <>
                                  {msg.type === 'image' && attachmentUrl && (
                                    <button onClick={(e) => { e.stopPropagation(); setPreviewImage(attachmentUrl) }} className="block mb-1.5">
                                      <img src={attachmentUrl} alt="" className="w-40 h-40 sm:w-48 sm:h-48 object-cover rounded-xl" />
                                    </button>
                                  )}
                                  {msg.type === 'attachment' && attachmentUrl && (
                                    <a
                                      href={attachmentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className={`block rounded-xl p-2.5 mb-2 ${isMine ? 'bg-white/10' : 'bg-gray-100'}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMine ? 'bg-white/20' : 'bg-gray-200'}`}>
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 002.828 2.828L18 9.828a4 4 0 10-5.656-5.656L5.757 10.757a6 6 0 108.486 8.486L20 13" />
                                          </svg>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold truncate">{msg.attachment?.fileName || 'File'}</p>
                                          <p className={`text-xs ${isMine ? 'text-white/70' : 'text-gray-500'}`}>Tap to download</p>
                                        </div>
                                      </div>
                                    </a>
                                  )}
                                  {msg.type === 'post' && post && (
                                    <div className={`rounded-xl overflow-hidden mb-2 ${isMine ? 'bg-white/10' : 'bg-gray-100'}`}>
                                      {post.image && (
                                        <img src={toAssetUrl(post.image)} alt="" className="w-full h-24 object-cover" />
                                      )}
                                      <div className="p-2">
                                        <p className="text-xs font-bold">Shared a post</p>
                                        <p className={`text-xs mt-1 line-clamp-2 ${isMine ? 'text-white/80' : 'text-gray-500'}`}>
                                          {post.content || 'View post'}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {(msg.type === 'text' || msg.content) && (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                  )}
                                    </>
                                  )}
                                  <div className={`mt-1 flex items-center justify-between gap-2 text-[10px] ${isDeleted ? 'text-gray-300' : isMine ? 'text-white/50' : 'text-gray-400'}`}>
                                    <span>{formatTime(msg.createdAt)}</span>
                                    {!isDeleted && isMine && idx === lastMineIndex && (
                                      <span className="flex items-center gap-1">
                                        {msg.read 
                                          ? <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 13l4 4" /></svg> Seen</>
                                          : <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Sent</>
                                        }
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                        <div ref={chatMessagesEndRef} />
                      </div>

                      {/* Message Action Sheet */}
                      <AnimatePresence>
                        {msgAction && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20 flex items-end"
                            onClick={() => setMsgAction(null)}
                          >
                            <div className="absolute inset-0 bg-black/30" />
                            <motion.div
                              initial={{ y: '100%' }}
                              animate={{ y: 0 }}
                              exit={{ y: '100%' }}
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              className="relative w-full bg-white rounded-t-2xl p-4 pb-6"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
                              <div className="space-y-1">
                                <button
                                  onClick={() => deleteForMe(msgAction.msgId)}
                                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                                >
                                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4.5 h-4.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">Delete for me</p>
                                    <p className="text-[11px] text-gray-400">Remove from your chat only</p>
                                  </div>
                                </button>
                                {msgAction.isMine && (
                                  <button
                                    onClick={() => deleteForEveryone(msgAction.msgId)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors text-left"
                                  >
                                    <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-4.5 h-4.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-red-600">Delete for everyone</p>
                                      <p className="text-[11px] text-gray-400">Remove for both (within 1 hour)</p>
                                    </div>
                                  </button>
                                )}
                                <button
                                  onClick={() => setMsgAction(null)}
                                  className="w-full py-3 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors mt-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Message Input Area */}
                      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-2 safe-area-bottom">
                        {/* File Preview */}
                        {(selectedImage || selectedAttachment) && (
                          <div className="bg-gray-100 rounded-xl p-2.5 mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {selectedImage && imagePreview ? (
                                <img src={imagePreview} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">
                                  {selectedImage?.name || selectedAttachment?.name}
                                </p>
                                <p className="text-[10px] text-gray-500">Ready to send</p>
                              </div>
                            </div>
                            <button onClick={removeSelectedFile} className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {/* Emoji Picker */}
                        {showEmojiPicker && (
                          <div className="bg-gray-100 rounded-xl p-1.5 mb-2 grid grid-cols-10 gap-0.5">
                            {emojiList.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleEmojiSelect(emoji)}
                                className="w-7 h-7 rounded-lg hover:bg-gray-200 flex items-center justify-center text-base active:scale-90 transition-transform"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Input Row - responsive layout */}
                        <div className="flex items-end gap-1.5">
                          {/* Plus button to toggle action buttons */}
                          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                          <input ref={attachmentInputRef} type="file" className="hidden" onChange={handleAttachmentSelect} />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => setShowEmojiPicker((v) => !v)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                                showEmojiPicker ? 'bg-black text-white' : 'text-gray-500 active:bg-gray-100'
                              }`}
                            >
                              <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => attachmentInputRef.current?.click()}
                              className="w-9 h-9 rounded-full text-gray-500 flex items-center justify-center active:bg-gray-100 transition-colors"
                            >
                              <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 002.828 2.828L18 9.828a4 4 0 10-5.656-5.656L5.757 10.757a6 6 0 108.486 8.486L20 13" />
                              </svg>
                            </button>
                          </div>

                          {/* Input field */}
                          <div className="flex-1 min-w-0 relative">
                            <input
                              value={chatInput}
                              onChange={handleChatInputChange}
                              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                              placeholder="Message..."
                              className="w-full h-10 pl-3 pr-10 rounded-full bg-gray-100 text-sm text-black placeholder-gray-400 outline-none focus:ring-2 focus:ring-black/10 transition-all"
                            />
                            <button
                              onClick={() => imageInputRef.current?.click()}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-gray-400 flex items-center justify-center active:bg-gray-200 transition-colors"
                            >
                              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>

                          {/* Send button */}
                          <button
                            onClick={() => sendMessage()}
                            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                          >
                            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal - Bottom Sheet Style */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80]"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowProfileModal(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3" />
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Profile</h2>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[70vh] scrollbar-hide">
                {profileLoading ? (
                  <ProfileSkeleton />
                ) : !profileData ? (
                  <p className="text-gray-500 text-center py-10">No profile data</p>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getAvatarColor(profileData)} flex items-center justify-center overflow-hidden flex-shrink-0`}>
                        {profileData.profilePicUrl ? (
                          <img src={toAssetUrl(profileData.profilePicUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-2xl">{getInitials(profileData)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-bold text-gray-900 truncate">{profileData.name || profileData.email?.split('@')[0]}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {[profileData.designation, profileData.department].filter(Boolean).join(' • ') || profileData.employeeId}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-gray-100 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{profileData.email}</p>
                      </div>
                      <div className="bg-gray-100 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 mb-1">Employee ID</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{profileData.employeeId || '-'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Mutual Friends ({mutualFriends.length})
                      </p>
                      {mutualFriends.length === 0 ? (
                        <p className="text-sm text-gray-400">No mutual friends</p>
                      ) : (
                        <div className="space-y-2">
                          {mutualFriends.map((f) => (
                            <div key={f._id} className="flex items-center gap-3 p-3 bg-gray-100 rounded-2xl">
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarColor(f)} flex items-center justify-center overflow-hidden`}>
                                {f.profilePicUrl ? (
                                  <img src={toAssetUrl(f.profilePicUrl)} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-white font-bold text-xs">{getInitials(f)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{f.name || f.email?.split('@')[0]}</p>
                                <p className="text-xs text-gray-500 truncate">{f.designation || f.department}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Post Modal - Bottom Sheet Style */}
      <AnimatePresence>
        {showSharePostModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85]"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowSharePostModal(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[70vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3" />
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Share a Post</h2>
                <button
                  onClick={() => setShowSharePostModal(false)}
                  className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[55vh] scrollbar-hide">
                {loadingPosts ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <PostSkeleton key={i} />)}
                  </div>
                ) : recentPosts.length === 0 ? (
                  <p className="text-gray-500 text-center py-10">No posts to share</p>
                ) : (
                  <div className="space-y-3">
                    {recentPosts.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => {
                          sendMessage({ postId: p._id, content: '' })
                          setShowSharePostModal(false)
                        }}
                        className="w-full text-left bg-gray-100 hover:bg-gray-200 rounded-2xl overflow-hidden transition-colors active:scale-98"
                      >
                        {p.image && (
                          <img src={toAssetUrl(p.image)} alt="" className="w-full h-32 object-cover" />
                        )}
                        <div className="p-3">
                          <p className="text-xs text-gray-500 mb-1">Tap to share</p>
                          <p className="text-sm text-gray-900 line-clamp-2">{p.content || 'Post'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Image Preview */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black"
            onClick={() => setPreviewImage(null)}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="w-full h-full flex items-center justify-center p-4">
              <img src={previewImage} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default SocialWidget
