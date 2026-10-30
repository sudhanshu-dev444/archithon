import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const initialState = {
  status: 'synced', // 'offline' | 'syncing' | 'synced' | 'conflict' | 'error'
  pendingCount: 0,
  conflictCount: 0,
  lastSyncTime: new Date(),
  lastServerSeq: 0,
  isOnline: true,
  outbox: [],
};

function syncReducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };
    case 'UPDATE_SYNC_STATS':
      return {
        ...state,
        pendingCount: action.payload.pending_count ?? state.pendingCount,
        conflictCount: action.payload.open_conflicts ?? state.conflictCount,
        lastServerSeq: action.payload.last_server_seq ?? state.lastServerSeq,
        status: (action.payload.open_conflicts > 0) ? 'conflict' : (state.status === 'offline' ? 'offline' : 'synced'),
      };
    case 'RESOLVE_CONFLICT':
      const newConflictCount = Math.max(0, state.conflictCount - 1);
      return {
        ...state,
        conflictCount: newConflictCount,
        status: newConflictCount > 0 ? 'conflict' : 'synced',
      };
    case 'QUEUE_OUTBOX':
      return {
        ...state,
        outbox: [...state.outbox, action.payload],
        pendingCount: state.pendingCount + 1,
      };
    case 'CLEAR_OUTBOX':
      return {
        ...state,
        outbox: [],
        pendingCount: 0,
        lastSyncTime: new Date(),
      };
    case 'SYNC_COMPLETE':
      return {
        ...state,
        status: state.conflictCount > 0 ? 'conflict' : 'synced',
        pendingCount: 0,
        lastSyncTime: new Date(),
      };
    default:
      return state;
  }
}

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [state, dispatch] = useReducer(syncReducer, initialState);

  // Real-time server polling probe (health + status)
  const pollServerStatus = useCallback(async () => {
    try {
      await api.checkHealth();
      dispatch({ type: 'SET_ONLINE', payload: true });

      const syncStatus = await api.getSyncStatus().catch(() => null);
      if (syncStatus) {
        dispatch({ type: 'UPDATE_SYNC_STATS', payload: syncStatus });
      }
    } catch {
      dispatch({ type: 'SET_ONLINE', payload: false });
      dispatch({ type: 'SET_STATUS', payload: 'offline' });
    }
  }, []);

  useEffect(() => {
    pollServerStatus();
    const interval = setInterval(pollServerStatus, 5000); // Poll every 5s for real-time status
    return () => clearInterval(interval);
  }, [pollServerStatus]);

  // Real-time manual trigger "Sync Now"
  const triggerSyncNow = async () => {
    dispatch({ type: 'SET_STATUS', payload: 'syncing' });
    try {
      // 1. If any outbox operations are pending, push them
      if (state.outbox.length > 0) {
        await api.pushOperations(state.outbox);
        dispatch({ type: 'CLEAR_OUTBOX' });
      }
      // 2. Pull server changes
      await api.pullOperations(state.lastServerSeq || 0);
      // 3. Refresh status
      await pollServerStatus();
      dispatch({ type: 'SYNC_COMPLETE' });
    } catch (err) {
      console.warn('Real-time sync paused (offline):', err.message);
      dispatch({ type: 'SET_STATUS', payload: 'offline' });
    }
  };

  // Real-time Conflict Resolution
  const resolveConflict = async (conflictId, { strategy, merged_value, resolve_reason }) => {
    try {
      await api.resolveConflict(conflictId, { strategy, merged_value, resolve_reason });
      dispatch({ type: 'RESOLVE_CONFLICT' });
      await pollServerStatus();
      return true;
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
      // Fallback local resolution if offline
      dispatch({ type: 'RESOLVE_CONFLICT' });
      return false;
    }
  };

  return (
    <SyncContext.Provider value={{
      ...state,
      dispatch,
      triggerSyncNow,
      resolveConflict,
      refreshStatus: pollServerStatus,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
