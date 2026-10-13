const defaultUrl = 'https://jkr-nwl0.onrender.com/api'
const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
const retiredUrl = 'https://hrms-backend-t8zu.onrender.com/api'

export const API_URL = !envUrl || envUrl === retiredUrl ? defaultUrl : envUrl