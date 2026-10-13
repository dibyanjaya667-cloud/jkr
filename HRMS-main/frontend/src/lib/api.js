const envUrl = (import.meta.env.VITE_API_URL || '').trim()
const defaultUrl = 'http://localhost:5000/api'

export const API_URL = envUrl || defaultUrl