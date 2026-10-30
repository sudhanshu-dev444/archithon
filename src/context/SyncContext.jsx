import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  status: 'offline', // 'offline' | 'syncing' | 'synced' | 'conflict' | 'error'
  pendingCount: 3,
  conflictCount: 1,
  lastSyncTime: null,
};

function syncReducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS': return { ...state, status: action.payload };
    case 'RESOLVE_CONFLICT': return { ...state, conflictCount: Math.max(0, state.conflictCount - 1) };
    case 'SYNC_COMPLETE': return { ...state, status: 'synced', pendingCount: 0, lastSyncTime: new Date() };
    default: return state;
  }
}

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [state, dispatch] = useReducer(syncReducer, initialState);
  return (
    <SyncContext.Provider value={{ ...state, dispatch }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
