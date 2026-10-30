import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { api, getStoredToken, setStoredToken, setSessionLock, clearSessionLock } from '../services/api';

const initialState = {
  isAuthenticated: false,
  doctor: {
    doctor_id: 'DOC-001',
    name: 'Dr. Priya Sharma',
    role: 'doctor',
    role_verified: 1,
    specialty: 'General Internal Medicine',
    license: 'MCI-CG-44821',
  },
  sessionMode: null, // 'full' | 'pin' | 'emergency'
  stationInfo: {
    id: 'Station 04',
    name: 'Ganiyari Outpost Hub',
    cachedPatients: 248,
    terminalName: 'Tablet Node Alpha (Bedside Triage)',
  },
};

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        isAuthenticated: true,
        doctor: action.payload,
        sessionMode: 'full',
      };
    case 'LOGIN_PIN':
      return {
        ...state,
        isAuthenticated: true,
        sessionMode: 'pin',
        doctor: action.payload || state.doctor,
      };
    case 'EMERGENCY_BYPASS':
      return {
        ...state,
        isAuthenticated: true,
        sessionMode: 'emergency',
        doctor: {
          doctor_id: 'EMERGENCY-BYPASS',
          name: 'Emergency Clinician',
          role: 'doctor',
          role_verified: 1,
        },
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isAuthenticated: false,
        doctor: null,
      };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore authenticated session from backend or token on mount
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api.getMe()
        .then((res) => {
          if (res?.doctor) {
            dispatch({
              type: 'LOGIN',
              payload: {
                doctor_id: res.doctor.doctor_id,
                name: res.doctor.name,
                email: res.doctor.email,
                role: res.doctor.role,
                role_verified: res.doctor.role_verified,
                specialty: res.doctor.specialty,
                license: res.doctor.council_number,
              },
            });
          }
        })
        .catch(() => {
          // Token still valid offline; keep initial demo doctor
          dispatch({
            type: 'LOGIN',
            payload: initialState.doctor,
          });
        });
    }
  }, []);

  const logout = useCallback(() => {
    setSessionLock();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const role = state.doctor?.role?.toLowerCase() || 'doctor';
  const roleVerified = state.doctor?.role_verified ?? 1;

  const isDoctor = role === 'doctor' || role === 'clinician';
  const isStaff = role === 'staff' || role === 'nurse' || role === 'admin';
  const canPrescribe = isDoctor && roleVerified === 1;
  const canApproveRecords = isDoctor && roleVerified === 1;
  const canIntake = true; // both staff and doctors can record intake and register patients

  return (
    <AuthContext.Provider
      value={{
        ...state,
        dispatch,
        logout,
        role,
        roleVerified,
        isDoctor,
        isStaff,
        canPrescribe,
        canApproveRecords,
        canIntake,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
