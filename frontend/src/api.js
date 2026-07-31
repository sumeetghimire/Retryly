import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
})

// Global error interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
)

// Auth
export const authRegister = (data) => api.post('/api/auth/register', data)
export const authLogin = (data) => api.post('/api/auth/login', data)
export const authLogout = () => api.post('/api/auth/logout')
export const authMe = () => api.get('/api/auth/me')

// Onboarding
export const connectPinch = (pinch_api_key) => api.post('/api/onboarding/connect-pinch', { pinch_api_key })
export const connectApiKey = (pinch_api_key, pinch_app_id, mode) => api.post('/api/onboarding/connect-api-key', { pinch_api_key, pinch_app_id, mode })
export const createMerchant = (data) => api.post('/api/onboarding/create-merchant', data)
export const getMerchantStatus = () => api.get('/api/onboarding/merchant-status')
export const savePreferences = (data) => api.post('/api/onboarding/preferences', data)
export const getWebhookUrl = () => api.get('/api/onboarding/webhook-url')

// Core
export const getHealth = () => api.get('/api/health')
export const getDashboard = () => api.get('/api/dashboard')
export const getDishonours = (status = 'all', page = 1) =>
  api.get('/api/dishonours', { params: { status, page } })
export const approveRetry = (id) => api.post(`/api/dishonours/${id}/approve-retry`)
export const sendMessage = (id) => api.post(`/api/dishonours/${id}/send-message`)
export const markResolved = (id) => api.post(`/api/dishonours/${id}/mark-resolved`)
export const writeOff = (id) => api.post(`/api/dishonours/${id}/write-off`)
export const acceptPlan = (id, plan_option) => api.post(`/api/dishonours/${id}/accept-plan`, { plan_option })
export const resendLink = (id) => api.post(`/api/dishonours/${id}/resend-link`)
export const getAuditLog = (id) => api.get(`/api/dishonours/${id}/audit-log`)
export const updateNote = (id, note) => api.patch(`/api/dishonours/${id}/note`, { note })
export const bulkAction = (action, ids) => api.post('/api/dishonours/bulk', { action, ids })
export const getPayers = () => api.get('/api/payers')
export const getRiskReport = () => api.get('/api/risk-report')
export const getSurchargeAdvisor = () => api.get('/api/surcharge-advisor')

// Settings
export const getSettings = () => api.get('/api/settings')
export const updateProfile = (data) => api.patch('/api/settings/profile', data)
export const updateRecovery = (data) => api.patch('/api/settings/recovery', data)
export const reconnectPinch = (pinch_api_key, pinch_app_id, mode) => api.post('/api/settings/connect-pinch', { pinch_api_key, pinch_app_id, mode })
export const disconnectPinch = () => api.delete('/api/settings/disconnect-pinch')
export const deleteAccount = () => api.delete('/api/settings/account')

// Cash Flow Forecast
export const getCashFlowForecast = (force = false) =>
  api.get('/api/cashflow/forecast', force ? { params: { force: true } } : {})
export const getCashFlowSummary = () => api.get('/api/cashflow/summary')
export const sendCashFlowReminder = (payerId) => api.post(`/api/cashflow/send-reminder/${payerId}`)

// Reminders
export const sendPreDebitReminders = () => api.post('/api/reminders/send-pre-debit')

// Demo
export const demoSeed = () => api.post('/api/demo/seed')
export const demoTrigger = (type) => api.post(`/api/demo/trigger/${type}`)
export const demoTimeTravel = () => api.post('/api/demo/time-travel')
export const demoReset = () => api.post('/api/demo/reset')

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const exportDishonours = () => window.open(`${BASE}/api/export/dishonours`, '_blank')
export const exportPayers = () => window.open(`${BASE}/api/export/payers`, '_blank')
