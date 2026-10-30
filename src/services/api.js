// src/services/api.js
// Universal client service for Swasthya Sync Frontend <-> Backend communication.
// Supports both direct Vite proxy (/api) and fallback to http://localhost:4000.

const API_BASE = '/api';
const TOKEN_KEY = 'swasthya_auth_token';
const DEVICE_KEY = 'swasthya_device_id';
const LOCK_KEY = 'swasthya_session_locked';

export function getStoredToken() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(LOCK_KEY) === 'true') {
    return null;
  }
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(LOCK_KEY);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearSessionLock() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LOCK_KEY);
  }
}

export function setSessionLock() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCK_KEY, 'true');
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getDeviceId() {
  let devId = localStorage.getItem(DEVICE_KEY);
  if (!devId) {
    devId = 'DEVICE-GANIYARI-ALPHA';
    localStorage.setItem(DEVICE_KEY, devId);
  }
  return devId;
}

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err = new Error(errBody.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = errBody;
      throw err;
    }
    return await res.json();
  } catch (err) {
    // If proxy failed, attempt direct port 4000
    if (url.startsWith('/api')) {
      const directUrl = `http://localhost:4000${endpoint}`;
      try {
        const directRes = await fetch(directUrl, { ...options, headers });
        if (directRes.ok) return await directRes.json();
      } catch (e) {
        // network offline
      }
    }
    throw err;
  }
}

export const api = {
  request,

  // Health
  checkHealth: () => request('/health'),

  // Auth
  login: async ({ email, passphrase, device_id }) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, passphrase, device_id: device_id || getDeviceId() }),
    });
    if (data.token) setStoredToken(data.token);
    return data;
  },

  loginPin: async ({ doctor_id, pin, device_id }) => {
    const data = await request('/auth/login/pin', {
      method: 'POST',
      body: JSON.stringify({ doctor_id, pin, device_id: device_id || getDeviceId() }),
    });
    if (data.token) setStoredToken(data.token);
    return data;
  },

  emergencyBypass: async (device_id) => {
    const data = await request('/auth/emergency', {
      method: 'POST',
      body: JSON.stringify({ device_id: device_id || getDeviceId() }),
    });
    if (data.token) setStoredToken(data.token);
    return data;
  },

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  getMe: () => request('/auth/me'),

  // Patients
  getPatients: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/patients${qs ? `?${qs}` : ''}`);
  },

  getPatient: (id) => request(`/patients/${id}`),

  createPatient: (patientData) =>
    request('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    }),

  updatePatient: (id, updates) =>
    request(`/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Encounters & Clinical Intake
  getEncounters: (patientId) => request(`/patients/${patientId}/encounters`),

  createEncounter: (patientId, encounterData) =>
    request(`/patients/${patientId}/encounters`, {
      method: 'POST',
      body: JSON.stringify(encounterData),
    }),

  updateEncounter: (patientId, encounterId, updates) =>
    request(`/patients/${patientId}/encounters/${encounterId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  createPrescription: (patientId, encounterId, prescriptionData) =>
    request(`/patients/${patientId}/encounters/${encounterId}/prescriptions`, {
      method: 'POST',
      body: JSON.stringify(prescriptionData),
    }),

  // Audio Recordings
  saveAudioMetadata: (patientId, metadata) =>
    request(`/patients/${patientId}/audio`, {
      method: 'POST',
      body: JSON.stringify(metadata),
    }),

  getAudioRecordings: (patientId) => request(`/patients/${patientId}/audio`),

  // Clinical Records (for Reports Tab)
  getClinicalRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/clinical-records${qs ? `?${qs}` : ''}`);
  },

  checkAllergy: (patientId, drugNames) =>
    request(`/allergy-check`, {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, drug_names: drugNames }),
    }),

  // Sync Engine & Outbox Operations
  getSyncStatus: () => request('/sync/status'),

  pushOperations: (operations) =>
    request('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    }),

  pullOperations: (since = 0, limit = 50) =>
    request(`/sync/pull?since=${since}&limit=${limit}`),

  verifyPatient: (patientId) =>
    request(`/sync/verify?patient_id=${patientId}`),

  // Conflicts
  getConflicts: (patientId) => {
    const qs = patientId ? `?patient_id=${patientId}` : '';
    return request(`/sync/conflicts${qs}`);
  },

  getConflict: (conflictId) => request(`/sync/conflicts/${conflictId}`),

  resolveConflict: (conflictId, { strategy, merged_value, resolve_reason }) =>
    request(`/sync/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ strategy, merged_value, resolve_reason }),
    }),

  // Audit Logs
  getAuditLog: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/sync/audit${qs ? `?${qs}` : ''}`);
  },
};

