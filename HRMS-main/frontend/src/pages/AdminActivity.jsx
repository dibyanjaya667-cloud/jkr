import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const Icons = {
  back: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
}

function AdminActivity() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black flex justify-center">
      <div className="relative w-full max-w-md h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col overflow-hidden md:my-4 md:h-[calc(100vh-2rem)] md:rounded-[28px] md:border md:border-white/10 md:shadow-2xl">
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between rounded-b-2xl">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/admin')}
              className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white"
            >
              {Icons.back}
            </motion.button>
            <div>
              <p className="text-white font-semibold text-sm">Admin Activity</p>
              <p className="text-white/50 text-xs">Audit trail</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="bg-black rounded-2xl p-4 border border-white/10 shadow-lg shadow-black/20">
            <p className="text-white text-sm font-semibold">No activity data yet</p>
            <p className="text-white/60 text-xs mt-2">
              This screen is ready. Connect it with backend audit logs when available.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminActivity
