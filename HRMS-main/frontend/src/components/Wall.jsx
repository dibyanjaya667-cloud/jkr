import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_URL } from '../lib/api'

// Professional Skeleton Components
const SkeletonPulse = ({ className }) => (
  <div className={`relative overflow-hidden bg-gray-200/80 ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
  </div>
)

const PostSkeleton = () => (
  <div className="bg-white/80 border border-white/60 rounded-xl shadow-sm overflow-hidden">
    {/* Header Skeleton */}
    <div className="p-3 pb-2">
      <div className="flex items-center gap-2">
        <SkeletonPulse className="w-8 h-8 rounded-full" />
        <div className="flex-1">
          <SkeletonPulse className="h-3 w-24 rounded-md mb-1" />
          <SkeletonPulse className="h-2 w-16 rounded-md" />
        </div>
      </div>
      {/* Content Skeleton */}
      <div className="mt-3 space-y-2">
        <SkeletonPulse className="h-3 w-full rounded-md" />
        <SkeletonPulse className="h-3 w-4/5 rounded-md" />
        <SkeletonPulse className="h-3 w-2/3 rounded-md" />
      </div>
    </div>
    {/* Image Skeleton - randomly show */}
    <SkeletonPulse className="w-full h-44" />
    {/* Actions Skeleton */}
    <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-4">
      <div className="flex items-center gap-1">
        <SkeletonPulse className="w-5 h-5 rounded-full" />
        <SkeletonPulse className="h-3 w-6 rounded-md" />
      </div>
      <div className="flex items-center gap-1">
        <SkeletonPulse className="w-5 h-5 rounded-full" />
        <SkeletonPulse className="h-3 w-6 rounded-md" />
      </div>
    </div>
  </div>
)

const PostSkeletonNoImage = () => (
  <div className="bg-white/80 border border-white/60 rounded-xl shadow-sm overflow-hidden">
    {/* Header Skeleton */}
    <div className="p-3 pb-2">
      <div className="flex items-center gap-2">
        <SkeletonPulse className="w-8 h-8 rounded-full" />
        <div className="flex-1">
          <SkeletonPulse className="h-3 w-28 rounded-md mb-1" />
          <SkeletonPulse className="h-2 w-14 rounded-md" />
        </div>
      </div>
      {/* Content Skeleton */}
      <div className="mt-3 space-y-2">
        <SkeletonPulse className="h-3 w-full rounded-md" />
        <SkeletonPulse className="h-3 w-3/4 rounded-md" />
      </div>
    </div>
    {/* Actions Skeleton */}
    <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-4">
      <div className="flex items-center gap-1">
        <SkeletonPulse className="w-5 h-5 rounded-full" />
        <SkeletonPulse className="h-3 w-6 rounded-md" />
      </div>
      <div className="flex items-center gap-1">
        <SkeletonPulse className="w-5 h-5 rounded-full" />
        <SkeletonPulse className="h-3 w-6 rounded-md" />
      </div>
    </div>
  </div>
)

const TabsSkeleton = () => (
  <div className="flex gap-2 mb-3">
    <SkeletonPulse className="flex-1 h-10 rounded-xl" />
    <SkeletonPulse className="flex-1 h-10 rounded-xl" />
  </div>
)

const CreatePostSkeleton = () => (
  <div className="bg-white/80 border border-white/60 rounded-xl p-3 shadow-sm mb-3">
    <div className="flex gap-2">
      <SkeletonPulse className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1">
        <SkeletonPulse className="w-full h-16 rounded-lg mb-2" />
        <div className="flex items-center justify-between">
          <SkeletonPulse className="w-8 h-8 rounded-lg" />
          <SkeletonPulse className="w-16 h-7 rounded-lg" />
        </div>
      </div>
    </div>
  </div>
)

const WallSkeleton = () => (
  <div className="pb-4">
    <TabsSkeleton />
    <CreatePostSkeleton />
    <div className="space-y-3">
      <PostSkeleton />
      <PostSkeletonNoImage />
      <PostSkeleton />
    </div>
  </div>
)

const avatarColors = [
  'from-orange-400 to-orange-600', 'from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600', 'from-pink-400 to-pink-600', 'from-cyan-400 to-cyan-600',
]

const getAvatarColor = (user) => {
  const str = user?._id || user?.email || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

const getInitials = (user) => {
  const name = user?.name || user?.email?.split('@')[0] || ''
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const Wall = ({ currentUser }) => {
  const [tab, setTab] = useState('all') // 'all' or 'my'
  const [posts, setPosts] = useState([])
  const [myPosts, setMyPosts] = useState([])
  const [pendingPosts, setPendingPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pendingLoading, setPendingLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [content, setContent] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [posting, setPosting] = useState(false)
  const [openComments, setOpenComments] = useState({})
  const [commentText, setCommentText] = useState({})
  const [editing, setEditing] = useState(null)
  const [editText, setEditText] = useState('')
  const [menu, setMenu] = useState(null)
  const [toast, setToast] = useState(null)

  const loadMoreRef = useRef(null)
  const fileRef = useRef(null)
  const token = () => localStorage.getItem('token')
  const isModerator = ['admin', 'hr', 'ceo'].includes(currentUser?.role)
  const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')
  const toUrl = (url) => url && !/^https?:\/\//i.test(url) ? `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}` : url || ''

  const notify = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500) }

  const fetchPosts = async (pg = 1, append = false) => {
    if (!token()) return
    try {
      pg === 1 ? setLoading(true) : setLoadingMore(true)
      const res = await axios.get(`${API_URL}/wall?page=${pg}&limit=10`, { headers: { Authorization: `Bearer ${token()}` } })
      if (append) setPosts(p => [...p, ...res.data.posts])
      else setPosts(res.data.posts)
      setHasMore(res.data.hasMore)
      setPage(pg)
    } catch { notify('Failed to load', 'error') }
    finally { setLoading(false); setLoadingMore(false) }
  }

  const fetchMyPosts = async () => {
    if (!token()) return
    try {
      const res = await axios.get(`${API_URL}/wall/me/mine`, { headers: { Authorization: `Bearer ${token()}` } })
      setMyPosts(res.data.posts || [])
    } catch { /* ignore */ }
  }

  const fetchPendingPosts = async () => {
    if (!token() || !isModerator) return
    try {
      setPendingLoading(true)
      const res = await axios.get(`${API_URL}/wall/pending/list`, { headers: { Authorization: `Bearer ${token()}` } })
      setPendingPosts(res.data.posts || [])
    } catch { /* ignore */ }
    finally { setPendingLoading(false) }
  }

  useEffect(() => {
    if (loading || loadingMore || !hasMore) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) fetchPosts(page + 1, true) }, { threshold: 0.1 })
    if (loadMoreRef.current) obs.observe(loadMoreRef.current)
    return () => obs.disconnect()
  }, [loading, loadingMore, hasMore, page])

  useEffect(() => {
    fetchPosts(1)
    fetchMyPosts()
    fetchPendingPosts()
  }, [])

  const pickImage = (e) => {
    const f = e.target.files?.[0]
    if (f && f.size <= 5 * 1024 * 1024) { setImage(f); setImagePreview(URL.createObjectURL(f)) }
    else if (f) notify('Max 5MB', 'error')
  }
  const clearImage = () => { setImage(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = '' }

  const createPost = async () => {
    if (!content.trim() && !image) return
    setPosting(true)
    try {
      const fd = new FormData()
      fd.append('content', content.trim())
      if (image) fd.append('image', image)
      const res = await axios.post(`${API_URL}/wall`, fd, { headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'multipart/form-data' } })
      if (res.data.status === 'approved') {
        setPosts(p => [res.data, ...p])
        notify('Posted!', 'success')
      } else {
        setMyPosts(p => [res.data, ...p])
        notify('Sent for HR approval', 'info')
        fetchPendingPosts()
      }
      setContent(''); clearImage()
    } catch { notify('Failed', 'error') }
    finally { setPosting(false) }
  }

  const approvePost = async (id) => {
    try {
      const res = await axios.patch(`${API_URL}/wall/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token()}` } })
      setPendingPosts(p => p.filter(x => x._id !== id))
      setPosts(p => [res.data, ...p])
      notify('Approved', 'success')
    } catch { notify('Error', 'error') }
  }

  const rejectPost = async (id) => {
    const reason = prompt('Rejection reason (optional)') || ''
    try {
      const res = await axios.patch(`${API_URL}/wall/${id}/reject`, { reason }, { headers: { Authorization: `Bearer ${token()}` } })
      setPendingPosts(p => p.filter(x => x._id !== id))
      setMyPosts(p => p.map(x => x._id === id ? res.data : x))
      notify('Rejected', 'success')
    } catch { notify('Error', 'error') }
  }

  const likePost = async (id) => {
    try {
      const res = await axios.post(`${API_URL}/wall/${id}/like`, {}, { headers: { Authorization: `Bearer ${token()}` } })
      setPosts(p => p.map(x => x._id === id ? res.data : x))
    } catch { notify('Error', 'error') }
  }

  const addComment = async (id) => {
    const txt = commentText[id]?.trim()
    if (!txt) return
    try {
      const res = await axios.post(`${API_URL}/wall/${id}/comment`, { content: txt }, { headers: { Authorization: `Bearer ${token()}` } })
      setPosts(p => p.map(x => x._id === id ? res.data : x))
      setCommentText(c => ({ ...c, [id]: '' }))
    } catch { notify('Error', 'error') }
  }

  const deleteComment = async (postId, commentId) => {
    try {
      const res = await axios.delete(`${API_URL}/wall/${postId}/comment/${commentId}`, { headers: { Authorization: `Bearer ${token()}` } })
      setPosts(p => p.map(x => x._id === postId ? res.data : x))
    } catch { notify('Error', 'error') }
  }

  const saveEdit = async (id) => {
    if (!editText.trim()) return
    try {
      const res = await axios.put(`${API_URL}/wall/${id}`, { content: editText.trim() }, { headers: { Authorization: `Bearer ${token()}` } })
      setPosts(p => p.map(x => x._id === id ? res.data : x))
      setEditing(null); notify('Updated!', 'success')
    } catch { notify('Error', 'error') }
  }

  const deletePost = async (id) => {
    if (!confirm('Delete this post?')) return
    try {
      await axios.delete(`${API_URL}/wall/${id}`, { headers: { Authorization: `Bearer ${token()}` } })
      setPosts(p => p.filter(x => x._id !== id)); notify('Deleted', 'success')
    } catch { notify('Error', 'error') }
    setMenu(null)
  }

  const isLiked = (post) => post.likes?.some(id => id === currentUser?._id || id._id === currentUser?._id)
  const isOwner = (post) => post.author?._id === currentUser?._id

  const displayPosts = tab === 'my' ? myPosts : tab === 'pending' ? pendingPosts : posts

  if (loading) return <WallSkeleton />

  return (
    <div className="pb-4">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab('all')} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === 'all' ? 'bg-black text-white' : 'bg-white/80 text-gray-600 border border-gray-200'}`}>
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          All Posts
        </button>
        <button onClick={() => setTab('my')} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === 'my' ? 'bg-black text-white' : 'bg-white/80 text-gray-600 border border-gray-200'}`}>
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          My Posts ({myPosts.length})
        </button>
        {isModerator && (
          <button onClick={() => setTab('pending')} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === 'pending' ? 'bg-black text-white' : 'bg-white/80 text-gray-600 border border-gray-200'}`}>
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Pending ({pendingPosts.length})
          </button>
        )}
      </div>

      {/* Create Post - Only on All tab */}
      {tab === 'all' && (
        <div className="bg-white/80 border border-white/60 rounded-xl p-3 shadow-sm mb-3">
          <div className="flex gap-2">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(currentUser)} flex items-center justify-center shrink-0`}>
              {currentUser?.profilePicUrl ? <img src={toUrl(currentUser.profilePicUrl)} className="w-full h-full rounded-full object-cover" /> : <span className="text-white text-xs font-bold">{getInitials(currentUser)}</span>}
            </div>
            <div className="flex-1">
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What's on your mind?" className="w-full bg-gray-100 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400 text-sm resize-none outline-none focus:ring-2 focus:ring-violet-400" rows={2}/>
              {imagePreview && (
                <div className="relative mt-2">
                  <img src={imagePreview} className="w-full max-h-40 object-cover rounded-lg"/>
                  <button onClick={clearImage} className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} className="hidden"/>
                <button onClick={() => fileRef.current?.click()} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </button>
                <button onClick={createPost} disabled={posting || (!content.trim() && !image)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${posting || (!content.trim() && !image) ? 'bg-gray-200 text-gray-400' : 'bg-black text-white'}`}>
                  {posting ? '...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-3">
        {tab === 'pending' && pendingLoading && (
          <div className="space-y-3">
            <PostSkeletonNoImage />
            <PostSkeletonNoImage />
          </div>
        )}
        {displayPosts.map((post) => (
          <motion.div key={post._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 border border-white/60 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-3 pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(post.author)} flex items-center justify-center shrink-0`}>
                    {post.author?.profilePicUrl ? <img src={toUrl(post.author.profilePicUrl)} className="w-full h-full rounded-full object-cover"/> : <span className="text-white text-xs font-bold">{getInitials(post.author)}</span>}
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium text-xs">{post.author?.name || post.author?.email?.split('@')[0]}</p>
                    <p className="text-gray-400 text-[10px]">{timeAgo(post.createdAt)}{post.updatedAt !== post.createdAt && ' • Edited'}</p>
                  </div>
                </div>
                {post.status && post.status !== 'approved' && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                    post.status === 'pending'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {post.status === 'pending' ? 'Pending HR' : 'Rejected'}
                  </span>
                )}
                {(isOwner(post) || isModerator) && (
                  <div className="relative">
                    <button onClick={() => setMenu(menu === post._id ? null : post._id)} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </button>
                    <AnimatePresence>
                      {menu === post._id && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-full mt-1 w-28 bg-white rounded-lg shadow-lg border z-10 overflow-hidden">
                          {isOwner(post) && (
                            <button onClick={() => { setEditing(post._id); setEditText(post.content); setMenu(null) }} className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit
                            </button>
                          )}
                          <button onClick={() => deletePost(post._id)} className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {!isOwner(post) && isModerator && (
                  <div className="relative">
                    <button onClick={() => setMenu(menu === post._id ? null : post._id)} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </button>
                    <AnimatePresence>
                      {menu === post._id && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border z-10 overflow-hidden">
                          <button onClick={() => deletePost(post._id)} className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Remove Post
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              {/* Content */}
              {editing === post._id ? (
                <div className="mt-2">
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full bg-gray-100 rounded-lg px-3 py-2 text-gray-800 text-sm resize-none outline-none" rows={2}/>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => saveEdit(post._id)} className="px-3 py-1 bg-black text-white text-[10px] font-semibold rounded-md">Save</button>
                    <button onClick={() => setEditing(null)} className="px-3 py-1 bg-gray-200 text-gray-600 text-[10px] font-semibold rounded-md">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-800 text-sm mt-2 whitespace-pre-wrap">{post.content}</p>
              )}
            </div>
            {/* Image */}
            {post.image && <img src={toUrl(post.image)} className="w-full max-h-72 object-cover"/>}
            {post.status === 'approved' && (
              <>
                {/* Actions */}
                <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-4">
                  <button onClick={() => likePost(post._id)} className="flex items-center gap-1">
                    <svg className={`w-5 h-5 ${isLiked(post) ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} fill={isLiked(post) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                    <span className={`text-xs font-medium ${isLiked(post) ? 'text-red-500' : 'text-gray-400'}`}>{post.likes?.length || 0}</span>
                  </button>
                  <button onClick={() => setOpenComments(c => ({ ...c, [post._id]: !c[post._id] }))} className="flex items-center gap-1">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    <span className="text-xs font-medium text-gray-400">{post.comments?.length || 0}</span>
                  </button>
                </div>
                {/* Comments */}
                <AnimatePresence>
                  {openComments[post._id] && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-gray-100 overflow-hidden">
                      <div className="p-3 space-y-2">
                        <div className="flex gap-2">
                          <input value={commentText[post._id] || ''} onChange={(e) => setCommentText(c => ({ ...c, [post._id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addComment(post._id)} placeholder="Write a comment..." className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-xs text-gray-800 outline-none"/>
                          <button onClick={() => addComment(post._id)} disabled={!commentText[post._id]?.trim()} className="w-7 h-7 bg-black text-white rounded-full flex items-center justify-center disabled:bg-gray-300">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                          </button>
                        </div>
                        {post.comments?.length > 0 && (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {post.comments.map((c) => (
                              <div key={c._id} className="flex gap-2 group">
                                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(c.user)} flex items-center justify-center shrink-0`}>
                                  <span className="text-white text-[10px] font-bold">{getInitials(c.user)}</span>
                                </div>
                                <div className="flex-1">
                                  <div className="bg-gray-100 rounded-xl px-2.5 py-1.5">
                                    <p className="text-gray-900 text-[10px] font-semibold">{c.user?.name || c.user?.email?.split('@')[0]}</p>
                                    <p className="text-gray-700 text-xs">{c.content}</p>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 px-1">
                                    <span className="text-gray-400 text-[10px]">{timeAgo(c.createdAt)}</span>
                                    {(c.user?._id === currentUser?._id || isOwner(post)) && (
                                      <button onClick={() => deleteComment(post._id, c._id)} className="text-gray-400 text-[10px] hover:text-red-500 opacity-0 group-hover:opacity-100">Delete</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {tab === 'pending' && isModerator && post.status === 'pending' && (
              <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
                <button onClick={() => approvePost(post._id)} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg">Approve</button>
                <button onClick={() => rejectPost(post._id)} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg">Reject</button>
              </div>
            )}
          </motion.div>
        ))}

        {/* Load More */}
        {hasMore && tab === 'all' && (
          <div ref={loadMoreRef} className="py-3">
            {loadingMore && (
              <div className="space-y-3">
                <PostSkeletonNoImage />
              </div>
            )}
          </div>
        )}

        {/* Empty */}
        {displayPosts.length === 0 && !pendingLoading && (
          <div className="bg-white/80 border border-white/60 rounded-xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-2 bg-violet-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <p className="text-gray-700 font-medium text-sm">
              {tab === 'pending' ? 'No pending posts' : 'No posts yet'}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              {tab === 'my' ? 'Create your first post!' : tab === 'pending' ? 'All caught up.' : 'Be the first to share!'}
            </p>
          </div>
        )}

        {!hasMore && displayPosts.length > 0 && tab === 'all' && <p className="text-center text-gray-400 text-xs py-3">You've seen all posts</p>}
      </div>

      {menu && <div className="fixed inset-0" onClick={() => setMenu(null)}/>}
    </div>
  )
}

export default Wall
