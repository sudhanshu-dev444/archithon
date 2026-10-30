import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  isAuthenticated: false,
  doctor: null,
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
      return { ...state, isAuthenticated: true, doctor: action.payload, sessionMode: 'full' };
    case 'LOGIN_PIN':
      return { ...state, isAuthenticated: true, sessionMode: 'pin' };
    case 'EMERGENCY_BYPASS':
      return { ...state, isAuthenticated: true, sessionMode: 'emergency', doctor: { name: 'Emergency', role: 'Bypass' } };
    case 'LOGOUT':
      return { ...initialState };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  return (
    <AuthContext.Provider value={{ ...state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
