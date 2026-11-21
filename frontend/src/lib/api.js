import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  verifyOTP: (data) => api.post('/auth/verify-otp', data),
  login: (data) => api.post('/auth/login', data),
  refreshToken: (data) => api.post('/auth/refresh-token', data),
};

// --- Mother ---
export const motherAPI = {
  getProfile: () => api.get('/mothers/profile'),
  updateProfile: (data) => api.put('/mothers/profile', data),
};

// --- Baby ---
export const babyAPI = {
  list: () => api.get('/babies'),
  add: (data) => api.post('/babies', data),
  update: (id, data) => api.put(`/babies/${id}`, data),
  remove: (id) => api.delete(`/babies/${id}`),
};

// --- Clinics ---
export const clinicAPI = {
  list: () => api.get('/clinics'),
  get: (id) => api.get(`/clinics/${id}`),
  getSlots: (id, date) => api.get(`/clinics/${id}/slots?date=${date}`),
};

// --- Appointments ---
export const appointmentAPI = {
  book: (data) => api.post('/appointments', data),
  list: (params) => api.get('/appointments', { params }),
  get: (id) => api.get(`/appointments/${id}`),
  reschedule: (id, data) => api.put(`/appointments/${id}/reschedule`, data),
  cancel: (id) => api.put(`/appointments/${id}/cancel`),
  checkIn: (id) => api.post(`/appointments/${id}/checkin`),
  updateStatus: (id, data) => api.put(`/appointments/${id}/status`, data),
  bookFollowUp: (data) => api.post('/appointments/follow-up', data),
};

// --- Queue ---
export const queueAPI = {
  getToday: (clinicId) => api.get(`/queue/today/${clinicId}`),
  getPosition: (appointmentId) => api.get(`/queue/position/${appointmentId}`),
};

// --- Admin ---
export const adminAPI = {
  getAppointmentReport: (params) => api.get('/admin/reports/appointments', { params }),
  getNoShowReport: (params) => api.get('/admin/reports/no-shows', { params }),
  getClinicLoad: (params) => api.get('/admin/reports/clinic-load', { params }),
  blockDate: (data) => api.post('/admin/block-date', data),
  unblockDate: (clinicId, date) => api.delete(`/admin/block-date/${clinicId}/${date}`),
  cancelSession: (data) => api.post('/admin/cancel-session', data),
  listStaff: () => api.get('/admin/staff'),
  createStaff: (data) => api.post('/admin/staff', data),
  updateStaff: (id, data) => api.put(`/admin/staff/${id}`, data),
};

export default api;
