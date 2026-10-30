// src/components/patients/AudioRecordingsList.jsx
// Displays saved audio recordings for a patient with playback controls and metadata.

import React, { useState, useEffect } from 'react';
import { getAudioRecordingsByPatient, deleteAudioRecording } from '../../services/audioStorage';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function AudioRecordingsList({ patientId, refreshTrigger }) {
  const { showToast } = useToast();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  const loadRecordings = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      // 1. Fetch local recordings with full audio blobs from IndexedDB
      const localRecords = await getAudioRecordingsByPatient(patientId);

      // 2. Also try fetching backend records for any synced metadata
      let backendRecords = [];
      try {
        const res = await api.getAudioRecordings(patientId);
        backendRecords = res?.recordings || [];
      } catch {
        // Backend optional offline
      }

      // Merge and create object URLs for local blobs
      const merged = localRecords.map((rec) => {
        const blobUrl = rec.blob ? URL.createObjectURL(rec.blob) : null;
        return {
          ...rec,
          audioUrl: blobUrl,
        };
      });

      // Add backend-only metadata records if not present locally
      backendRecords.forEach((b) => {
        if (!merged.some((m) => m.id === b.recording_id)) {
          merged.push({
            id: b.recording_id,
            patient_id: b.patient_id,
            duration: b.duration_seconds,
            language: b.language,
            recorded_by: b.recorded_by,
            recorded_by_role: b.recorded_by_role,
            created_at: b.created_at,
            audioUrl: null, // metadata only from server
          });
        }
      });

      // Sort newest first
      merged.sort((a, b) => b.created_at - a.created_at);
      setRecordings(merged);
    } catch (err) {
      console.error('Error loading audio recordings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings();
    return () => {
      // Cleanup object URLs
      recordings.forEach((r) => {
        if (r.audioUrl) URL.revokeObjectURL(r.audioUrl);
      });
    };
  }, [patientId, refreshTrigger]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this clinical audio recording?')) return;
    try {
      await deleteAudioRecording(id);
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      showToast('Audio recording deleted', 'success');
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const formatDuration = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (ts) => {
    if (!ts) return 'Unknown date';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-4 bg-surface-container-low rounded-xl flex items-center justify-center gap-2 text-on-surface-variant text-label-sm">
        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
        <span>Loading saved audio recordings...</span>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="p-4 bg-surface-container-low rounded-xl flex flex-col items-center justify-center text-center gap-1.5 border border-surface-container">
        <span className="material-symbols-outlined text-[28px] text-outline">graphic_eq</span>
        <p className="text-label-md font-semibold text-on-surface">No Saved Audio Recordings</p>
        <p className="text-body-sm text-outline max-w-xs">
          Start a new recording from the button above to capture and persist clinical ambient dictations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {recordings.map((rec) => (
        <div
          key={rec.id}
          className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-surface-container flex flex-col gap-2.5 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-label-md font-bold text-on-surface">Ambient Dictation</span>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-surface-container text-secondary">
                    {rec.language?.toUpperCase() || 'HI'}
                  </span>
                  <span className="text-[11px] font-bold text-primary">
                    {formatDuration(rec.duration)}
                  </span>
                </div>
                <span className="text-[12px] text-outline">{formatDate(rec.created_at)}</span>
              </div>
            </div>

            <button
              onClick={() => handleDelete(rec.id)}
              className="p-1 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
              title="Delete recording"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>

          {/* Audio Player Controls */}
          {rec.audioUrl ? (
            <div className="bg-surface-container-low rounded-lg p-2 flex items-center gap-2">
              <audio
                controls
                src={rec.audioUrl}
                onPlay={() => setPlayingId(rec.id)}
                className="w-full h-8 rounded outline-none"
              />
            </div>
          ) : (
            <div className="bg-surface-container-low p-2 rounded-lg text-[12px] text-outline flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">cloud_done</span>
              <span>Recording metadata synced to district EHR (Local audio cache archived)</span>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-surface-container">
            <span className="flex items-center gap-1 font-mono">
              <span className="material-symbols-outlined text-[14px]">person</span>
              Recorded by: {rec.recorded_by} ({rec.recorded_by_role || 'Doctor'})
            </span>
            <span className="font-mono text-outline">#{rec.id.slice(0, 16)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

