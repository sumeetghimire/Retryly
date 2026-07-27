import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })

export const getHealth = () => api.get('/api/health')
export const getDashboard = () => api.get('/api/dashboard')
export const getDishonours = (status = 'all', page = 1) =>
  api.get('/api/dishonours', { params: { status, page } })
export const approveRetry = (id) => api.post(`/api/dishonours/${id}/approve-retry`)
export const sendMessage = (id) => api.post(`/api/dishonours/${id}/send-message`)
export const markResolved = (id) => api.post(`/api/dishonours/${id}/mark-resolved`)
export const getPayers = () => api.get('/api/payers')
export const demoSeed = () => api.post('/api/demo/seed')
export const demoTrigger = (type) => api.post(`/api/demo/trigger/${type}`)
export const demoTimeTravel = () => api.post('/api/demo/time-travel')
export const demoReset = () => api.post('/api/demo/reset')
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const exportDishonours = () => window.open(`${BASE}/api/export/dishonours`, '_blank')
export const exportPayers = () => window.open(`${BASE}/api/export/payers`, '_blank')
