const envUrl = (import.meta.env.VITE_API_URL || '').trim()
const defaultUrl = 'https://jkr-nwl0.onrender.com/api'

export const API_URL = envUrl || defaultUrl