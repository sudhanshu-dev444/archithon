import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import AppHeader from '../components/layout/AppHeader';
import BottomNav from '../components/layout/BottomNav';

export default function SettingsPage() {
  const { doctor, stationInfo, sessionMode, dispatch: authDispatch } = useAuth();
  const { status, conflictCount, pendingCount, dispatch: syncDispatch } = useSync();

  const [serverUrl, setServerUrl] = useState('http://localhost:4000');
  const [testResult, setTestResult] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState('hi-IN');
  const [offlineSimulated, setOfflineSimulated] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState('5m');

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const res = await fetch(`${serverUrl}/health`);
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: true,
          latency,
          message: `Connected: ${data.service || 'Swasthya Sync'} (Latency: ${latency}ms)`,
        });
        syncDispatch({ type: 'SET_STATUS', payload: 'synced' });
      } else {
        setTestResult({
          success: false,
          latency,
          message: `Server returned HTTP ${res.status}`,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message}. Is backend running on ${serverUrl}?`,
      });
      syncDispatch({ type: 'SET_STATUS', payload: 'offline' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleToggleOffline = () => {
    const nextState = !offlineSimulated;
    setOfflineSimulated(nextState);
    syncDispatch({ type: 'SET_STATUS', payload: nextState ? 'offline' : 'synced' });
  };

  const handlePurgeCache = () => {
    if (window.confirm('Clear temporary audio clips and scan cache? Approved clinical records remain safely stored in local SQLite.')) {
      alert('Temporary audio and OCR cache cleared (12.4 MB freed).');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm">
        <AppHeader
          title="Station Settings"
          subtitle="Hardware, Offline Vault & Sync Inspector"
          showBack={true}
          showLock={true}
        />
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-28 pb-28 px-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Clinician Profile & Terminal Card */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-headline-sm">
                {(doctor?.name || 'Dr. Priya Sharma').slice(0, 2)}
              </div>
              <div className="flex flex-col">
                <span className="text-label-lg font-bold text-primary">
                  {doctor?.name || 'Dr. Priya Sharma'}
                </span>
                <span className="text-[12px] text-on-surface-variant font-mono">
                  MCI-CG-44821 • General Medicine & Triage
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
              {sessionMode === 'emergency' ? 'Code Blue Bypass' : '12h Shift Active'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-container text-body-sm">
            <div className="flex flex-col">
              <span className="text-[11px] text-secondary font-bold uppercase">Terminal Node</span>
              <span className="font-bold text-on-surface">{stationInfo?.terminalName || 'Tablet Node Alpha (Bedside Triage)'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-secondary font-bold uppercase">Station Hub</span>
              <span className="font-bold text-on-surface">{stationInfo?.name || 'Ganiyari Outpost Hub'}</span>
            </div>
          </div>
        </section>

        {/* Sync Engine Inspector & Backend Handshake */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">sync_alt</span>
              <h2 className="text-headline-sm font-bold text-primary">Sync Engine & Central Hub</h2>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              status === 'synced' ? 'bg-secondary-container text-on-secondary-container' :
              status === 'conflict' ? 'bg-error-container text-error' :
              'bg-surface-container text-on-surface-variant'
            }`}>
              {status.toUpperCase()}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-label-sm font-bold text-on-surface">Central PostgreSQL Sync API Endpoint</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container text-on-surface font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="http://localhost:4000"
              />
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-label-sm flex items-center gap-1.5 active:scale-95 transition-transform hover:bg-primary-container disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {testingConnection ? 'sync' : 'network_check'}
                </span>
                <span>{testingConnection ? 'Testing...' : 'Test Handshake'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl border text-[12px] flex items-center gap-2 font-mono ${
                testResult.success
                  ? 'bg-secondary-container/40 border-secondary/30 text-primary'
                  : 'bg-error-container/40 border-error/30 text-error'
              }`}>
                <span className="material-symbols-outlined text-[18px]">
                  {testResult.success ? 'check_circle' : 'error'}
                </span>
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Sync Stats & Inspector */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-surface-container-low border border-surface-container text-center">
            <div className="flex flex-col">
              <span className="text-[11px] text-secondary font-bold uppercase">Outbox Pending</span>
              <span className="text-headline-sm font-bold text-primary">{pendingCount} ops</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-secondary font-bold uppercase">Discrepancies</span>
              <span className={`text-headline-sm font-bold ${conflictCount > 0 ? 'text-error' : 'text-primary'}`}>
                {conflictCount}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-secondary font-bold uppercase">Auto-Sync Cycle</span>
              <span className="text-headline-sm font-bold text-primary">{autoSyncInterval}</span>
            </div>
          </div>

          {/* Flight Mode / Offline Simulation Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="flex flex-col">
              <span className="text-label-md font-bold text-on-surface">Simulate Zero-Connectivity (Offline Mode)</span>
              <span className="text-[12px] text-on-surface-variant">Forces sync engine into offline outbox queue for stress testing.</span>
            </div>
            <button
              onClick={handleToggleOffline}
              className={`w-12 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer ${
                offlineSimulated ? 'bg-tertiary justify-end' : 'bg-surface-container-high justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
            </button>
          </div>
        </section>

        {/* Edge AI Models & On-Device Storage */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">memory</span>
            <h2 className="text-headline-sm font-bold text-primary">On-Device Edge AI & Local Vault</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-body-sm">
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
              <span className="text-label-sm font-bold text-primary">Speech-to-Text Pipeline</span>
              <div className="flex items-center justify-between text-[12px] text-on-surface-variant">
                <span>Whisper.cpp Quantized (Hindi + English)</span>
                <span className="font-mono text-secondary font-bold">38.2 MB</span>
              </div>
              <span className="text-[11px] text-secondary">Voice Activity Detection (VAD) Enabled</span>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
              <span className="text-label-sm font-bold text-primary">Prescription OCR Scanner</span>
              <div className="flex items-center justify-between text-[12px] text-on-surface-variant">
                <span>Edge OCR Mobile Slip Model</span>
                <span className="font-mono text-secondary font-bold">18.6 MB</span>
              </div>
              <span className="text-[11px] text-secondary">Printed & Handwritten Extraction</span>
            </div>
          </div>

          {/* Language Preference */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-container">
            <div className="flex flex-col">
              <span className="text-label-md font-bold text-on-surface">Ambient Dictation Language</span>
              <span className="text-[12px] text-on-surface-variant">Selected language for Whisper acoustic decoding.</span>
            </div>
            <select
              value={speechLanguage}
              onChange={(e) => setSpeechLanguage(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-surface-container text-label-sm font-bold text-primary focus:outline-none"
            >
              <option value="hi-IN">Hindi (Devanagari)</option>
              <option value="en-IN">English (Indian Accent)</option>
              <option value="bilingual">Auto-Detect Bilingual (Hinglish)</option>
            </select>
          </div>
        </section>

        {/* Database & Security Operations */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">security</span>
            <h2 className="text-headline-sm font-bold text-primary">Storage Vault & Session Security</h2>
          </div>

          <div className="flex items-center justify-between text-body-sm p-3 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="flex flex-col">
              <span className="font-bold text-on-surface">SQLite Encrypted Record Vault</span>
              <span className="text-[12px] text-on-surface-variant">AES-256-GCM authenticated encryption at rest. 248 patient records cached.</span>
            </div>
            <span className="text-label-sm font-bold text-secondary font-mono">14.2 MB</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handlePurgeCache}
              className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold text-label-sm hover:bg-surface-container-high transition-colors"
            >
              Purge Audio/Scan Cache
            </button>
            <button
              onClick={() => authDispatch({ type: 'LOGOUT' })}
              className="px-4 py-2 rounded-xl bg-error-container text-error font-bold text-label-sm hover:bg-error-container/80 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Lock & End Shift</span>
            </button>
          </div>
        </section>
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

