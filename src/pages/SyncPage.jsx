import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatients } from '../context/PatientContext';
import { useSync } from '../context/SyncContext';
import AppHeader from '../components/layout/AppHeader';
import AllergyBanner from '../components/layout/AllergyBanner';
import BottomNav from '../components/layout/BottomNav';

export default function SyncPage() {
  const navigate = useNavigate();
  const { allPatients } = usePatients();
  const { status, conflictCount, pendingCount, triggerSyncNow, resolveConflict } = useSync();

  const patient = allPatients.find(p => p.id === 'PAT-8812') || allPatients[0];

  const [selectedResolution, setSelectedResolution] = useState('combine'); // 'clinic' | 'hospital' | 'combine'
  const [isResolving, setIsResolving] = useState(false);
  const [resolved, setResolved] = useState(conflictCount === 0);
  const [syncingNow, setSyncingNow] = useState(false);

  const handleManualSync = async () => {
    setSyncingNow(true);
    await triggerSyncNow();
    setSyncingNow(false);
  };

  const handleConfirmDecision = async () => {
    setIsResolving(true);
    let mergedVal = '';
    if (selectedResolution === 'clinic') {
      mergedVal = JSON.stringify({
        prescriptions: ['Paracetamol 650mg QDS', 'Azithromycin 500mg once daily x 3 days'],
        reason: 'Suspected bacterial bronchitis (Outpost clinic decision)',
      });
    } else if (selectedResolution === 'hospital') {
      mergedVal = JSON.stringify({
        prescriptions: ['Paracetamol 650mg TID', 'Cetirizine 10mg nightly'],
        reason: 'Allergic rhinorrhea & fever (Hospital center decision)',
      });
    } else {
      mergedVal = JSON.stringify({
        prescriptions: [
          'Paracetamol 650mg QDS',
          'Azithromycin 500mg once daily x 3 days',
          'Cetirizine 10mg nightly',
        ],
        reason: 'Combined non-conflicting regimen with safe macrolide alternative',
      });
    }

    await resolveConflict('CONF-001', {
      strategy: selectedResolution === 'clinic' ? 'keep_a' : selectedResolution === 'hospital' ? 'keep_b' : 'merge',
      merged_value: mergedVal,
      resolve_reason: `Doctor resolved discrepancy choosing ${selectedResolution.toUpperCase()}`,
    });

    setIsResolving(false);
    setResolved(true);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm">
        <AppHeader
          title="Record Sync & Review"
          subtitle="Differential Sync Conflict Inspector"
          showBack={true}
          showLock={true}
        />
        {patient && !resolved && (
          <AllergyBanner patient={patient} riskLevel="Blocked in Sync" />
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-28 px-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Sync Summary Banner */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[20px] ${
              conflictCount > 0 && !resolved ? 'bg-error-container text-error' : 'bg-secondary-container text-secondary'
            }`}>
              <span className="material-symbols-outlined">
                {conflictCount > 0 && !resolved ? 'sync_problem' : 'cloud_done'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-headline-sm text-on-surface font-bold">
                {conflictCount > 0 && !resolved
                  ? `${conflictCount} Clinical Record Needs Doctor Decision`
                  : 'All Local Records Synchronized'}
              </span>
              <span className="text-body-sm text-on-surface-variant font-mono">
                Offline Outbox • {pendingCount} pending ops • Status: {status.toUpperCase()}
              </span>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={syncingNow}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-label-sm flex items-center gap-2 active:scale-95 transition-transform hover:bg-primary-container disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${syncingNow ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{syncingNow ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>

        {/* Patient Context Card */}
        {patient && (
          <div className="bg-surface-container-low rounded-xl p-3.5 flex items-center justify-between border border-surface-container">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high text-primary font-bold flex items-center justify-center">
                {patient.name.slice(0, 2)}
              </div>
              <div className="flex flex-col">
                <span className="text-label-lg font-bold text-on-surface">
                  {patient.name} ({patient.age}y, {patient.gender})
                </span>
                <span className="text-[12px] text-on-surface-variant font-mono">
                  #{patient.id} • ABHA: {patient.abha}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/patients/${patient.id}`)}
              className="text-label-sm text-primary font-bold hover:underline"
            >
              View Full History
            </button>
          </div>
        )}

        {/* Conflict Resolution Card (If not resolved) */}
        {!resolved ? (
          <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border-2 border-error/50 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-error-container text-error flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">merge_type</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-sm font-bold text-error uppercase tracking-wider">
                    TWO-WAY SYNC COLLISION (PARTITION MERGE)
                  </span>
                  <h3 className="text-headline-sm text-on-surface font-bold">
                    Prescription Discrepancy — Visit #ENC-9921
                  </h3>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-outline">
                v2.1 vs v2.4
              </span>
            </div>

            <p className="text-body-sm text-on-surface leading-snug">
              While this outpost was operating offline, the patient's record was independently updated at both the <strong>Local Outpost Clinic</strong> and the <strong>District Hospital Center</strong>. Select the clinically appropriate regimen to finalize the merge.
            </p>

            {/* Side-by-Side Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Version A: This Clinic */}
              <div
                onClick={() => setSelectedResolution('clinic')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedResolution === 'clinic'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-surface-container bg-surface-container-low hover:border-outline'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-label-sm font-bold text-primary uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">domain</span>
                      This Clinic Station (Today 09:30)
                    </span>
                    <span className="text-[11px] font-mono bg-surface-container px-2 py-0.5 rounded text-outline">
                      v2.1 Mine
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="p-2 rounded bg-surface-container-lowest border border-surface-container text-body-sm">
                      <span className="font-bold text-on-surface block">Paracetamol 650mg QDS</span>
                      <span className="text-[12px] text-on-surface-variant">1 tablet 4 times daily (3 days)</span>
                    </div>
                    <div className="p-2 rounded bg-surface-container-lowest border border-surface-container text-body-sm">
                      <span className="font-bold text-on-surface block">Azithromycin 500mg</span>
                      <span className="text-[12px] text-on-surface-variant">1 tablet once daily x 3 days</span>
                    </div>
                  </div>

                  <div className="mt-2 text-[12px] text-on-surface-variant italic">
                    Reason: "Suspected bacterial bronchitis secondary to viral prodrome"
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-label-sm font-bold text-primary">
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedResolution === 'clinic' ? 'radio_button_checked' : 'radio_button_unchecked'}
                  </span>
                  <span>Select Clinic Version</span>
                </div>
              </div>

              {/* Version B: District Hospital */}
              <div
                onClick={() => setSelectedResolution('hospital')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedResolution === 'hospital'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-surface-container bg-surface-container-low hover:border-outline'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-label-sm font-bold text-secondary uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">local_hospital</span>
                      Hospital Center (Today 08:45)
                    </span>
                    <span className="text-[11px] font-mono bg-surface-container px-2 py-0.5 rounded text-outline">
                      v2.4 Server
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="p-2 rounded bg-surface-container-lowest border border-surface-container text-body-sm">
                      <span className="font-bold text-on-surface block">Paracetamol 650mg TID</span>
                      <span className="text-[12px] text-on-surface-variant">1 tablet 3 times daily (3 days)</span>
                    </div>
                    <div className="p-2 rounded bg-surface-container-lowest border border-surface-container text-body-sm">
                      <span className="font-bold text-on-surface block">Cetirizine 10mg</span>
                      <span className="text-[12px] text-on-surface-variant">1 tablet at bedtime (5 days)</span>
                    </div>
                  </div>

                  <div className="mt-2 text-[12px] text-on-surface-variant italic">
                    Reason: "Allergic rhinorrhea and symptomatic fever management"
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-label-sm font-bold text-secondary">
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedResolution === 'hospital' ? 'radio_button_checked' : 'radio_button_unchecked'}
                  </span>
                  <span>Select Hospital Version</span>
                </div>
              </div>
            </div>

            {/* Combined Option */}
            <div
              onClick={() => setSelectedResolution('combine')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                selectedResolution === 'combine'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-surface-container bg-surface-container-low hover:border-outline'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-label-md font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">call_merge</span>
                  Combine Both Regimens (3-Way Merge)
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                  Harmonized
                </span>
              </div>
              <p className="text-[12px] text-on-surface-variant mb-2">
                Maintains QDS Paracetamol dosing + Azithromycin 500mg from clinic, while adopting Cetirizine 10mg from hospital.
              </p>
              <div className="flex items-center gap-1.5 text-label-sm font-bold text-primary">
                <span className="material-symbols-outlined text-[18px]">
                  {selectedResolution === 'combine' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
                <span>Select Combined Resolution</span>
              </div>
            </div>

            {/* Confirm Decision Button */}
            <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">
              <button
                onClick={handleConfirmDecision}
                disabled={isResolving}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-label-lg flex items-center justify-center gap-2 active:scale-98 transition-transform shadow-md hover:bg-primary-container disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isResolving ? 'sync' : 'check_circle'}
                </span>
                <span>{isResolving ? 'Committing Real-Time Merge...' : 'Confirm Doctor Decision & Sync'}</span>
              </button>
              <span className="text-[11px] text-center text-outline">
                Confirmed as Dr. Priya Sharma (MCI-CG-44821) • Appends immutable hash-chained audit record.
              </span>
            </div>
          </section>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-secondary/30 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-secondary-container text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px]">task_alt</span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-headline-md font-bold text-primary">Partition Conflict Resolved</h3>
              <p className="text-body-sm text-on-surface-variant max-w-md">
                Discrepancy for visit #ENC-9921 has been reconciled in real-time. Server sequence updated and broadcast to central PostgreSQL repository.
              </p>
            </div>
            <button
              onClick={() => navigate('/patients')}
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors shadow-sm"
            >
              Back to Patient Queue
            </button>
          </div>
        )}

        {/* Offline Outbox Queue */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">outbox</span>
              <h3 className="text-label-lg font-bold text-primary">Records Waiting in Local Outbox</h3>
            </div>
            <span className="text-[12px] text-on-surface-variant font-semibold bg-surface-container px-2.5 py-1 rounded-full">
              {pendingCount} items queued
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">note_alt</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-md font-bold text-on-surface">Visit & Triage Notes</span>
                  <span className="text-body-sm text-on-surface-variant">Saved safely in local SQLite</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
                Saved on device
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">biotech</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-md font-bold text-on-surface">Rapid Malaria Test Result</span>
                  <span className="text-body-sm text-on-surface-variant">Result: Positive P. falciparum</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
                Ready to send
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-md font-bold text-on-surface">Vital Signs Check</span>
                  <span className="text-body-sm text-on-surface-variant">Pulse Ox 98% • BP 128/82 mmHg</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
                Saved on device
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
