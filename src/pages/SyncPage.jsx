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
  const { conflictCount, dispatch } = useSync();

  const patient = allPatients.find(p => p.id === 'PAT-8812') || allPatients[0];

  const [selectedResolution, setSelectedResolution] = useState('combine'); // 'clinic' | 'hospital' | 'combine'
  const [isResolving, setIsResolving] = useState(false);
  const [resolved, setResolved] = useState(false);

  const handleConfirmDecision = () => {
    setIsResolving(true);
    setTimeout(() => {
      setIsResolving(false);
      setResolved(true);
      dispatch({ type: 'RESOLVE_CONFLICT' });
    }, 900);
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
        {patient && (
          <AllergyBanner patient={patient} riskLevel="Blocked in Sync" />
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-28 px-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Sync Summary Banner */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[20px] ${
              conflictCount > 0 ? 'bg-error-container text-error' : 'bg-secondary-container text-secondary'
            }`}>
              <span className="material-symbols-outlined">
                {conflictCount > 0 ? 'sync_problem' : 'cloud_done'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-headline-sm text-on-surface font-bold">
                {conflictCount > 0 ? '1 Clinical Record Needs Doctor Decision' : 'All Local Records Synchronized'}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                Offline Outbox â€¢ 3 pending items ready to send upon network handshake
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-surface-container text-primary font-bold text-label-sm">
            Ganiyari Hub
          </span>
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
                  #{patient.id} â€¢ ABHA: {patient.abha}
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
                    Prescription Discrepancy â€” Visit #ENC-9921
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

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option A: This Clinic */}
              <div
                onClick={() => setSelectedResolution('clinic')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                  selectedResolution === 'clinic'
                    ? 'border-primary bg-primary/5'
                    : 'border-surface-container bg-surface-container-low hover:border-outline'
                }`}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-label-md font-bold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">devices</span>
                      This Outpost Clinic (Local Node)
                    </span>
                    <input
                      type="radio"
                      name="resolution"
                      checked={selectedResolution === 'clinic'}
                      onChange={() => setSelectedResolution('clinic')}
                      className="accent-primary"
                    />
                  </div>
                  <span className="text-[11px] text-outline">Recorded by: Dr. Sarah Jenkins (09:40 AM)</span>

                  <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-surface-container flex flex-col gap-1 text-[13px] mt-1">
                    <div className="font-semibold text-on-surface">1. Paracetamol 650 mg QDS (4x/day)</div>
                    <div className="font-semibold text-on-surface">2. Azithromycin 500 mg OD (Safe)</div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-semibold text-secondary">
                  <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                  <span>Both medicines available in local dispensary</span>
                </div>
              </div>

              {/* Option B: Hospital Center */}
              <div
                onClick={() => setSelectedResolution('hospital')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                  selectedResolution === 'hospital'
                    ? 'border-primary bg-primary/5'
                    : 'border-surface-container bg-surface-container-low hover:border-outline'
                }`}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-label-md font-bold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">domain</span>
                      District Hospital (Central Cloud)
                    </span>
                    <input
                      type="radio"
                      name="resolution"
                      checked={selectedResolution === 'hospital'}
                      onChange={() => setSelectedResolution('hospital')}
                      className="accent-primary"
                    />
                  </div>
                  <span className="text-[11px] text-outline">Recorded by: Central Triage Staff (08:50 AM)</span>

                  <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-surface-container flex flex-col gap-1 text-[13px] mt-1">
                    <div className="font-semibold text-on-surface">1. Paracetamol 650 mg TID (3x/day)</div>
                    <div className="font-semibold text-on-surface">2. Cetirizine 10 mg HS (Allergic rhinitis)</div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-semibold text-outline">
                  <span className="material-symbols-outlined text-[14px]">cloud_sync</span>
                  <span>Received via satellite sync batch</span>
                </div>
              </div>
            </div>

            {/* Option C: Combine Both (Recommended by design) */}
            <div
              onClick={() => setSelectedResolution('combine')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                selectedResolution === 'combine'
                  ? 'border-primary bg-secondary-container/20 ring-2 ring-primary/20'
                  : 'border-surface-container bg-surface-container-low hover:border-outline'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">join_inner</span>
                  <span className="text-label-lg font-bold text-primary">
                    Combine Both Medicines (Non-Conflicting Regimen)
                  </span>
                </div>
                <input
                  type="radio"
                  name="resolution"
                  checked={selectedResolution === 'combine'}
                  onChange={() => setSelectedResolution('combine')}
                  className="accent-primary"
                />
              </div>
              <p className="text-body-sm text-on-surface-variant leading-snug">
                Merges Paracetamol 650mg QDS + Azithromycin 500mg (from Local) with Cetirizine 10mg (from Hospital). Deterministic rule engine verified zero drug-drug interaction and no penicillin allergy cross-reactivity.
              </p>
            </div>

            {/* Clinician Authorization & Confirmation */}
            <div className="pt-2 border-t border-surface-container flex flex-col gap-3">
              <div className="flex items-center justify-between text-body-sm text-on-surface-variant">
                <span>Clinician in charge:</span>
                <span className="font-bold text-primary">Dr. Evelyn Reed (Reg #MCI-4902)</span>
              </div>

              <button
                onClick={handleConfirmDecision}
                disabled={isResolving}
                className="w-full min-h-[52px] rounded-xl bg-primary text-on-primary font-bold text-label-lg flex items-center justify-center gap-2 hover:bg-primary-container shadow-md active:scale-[0.99] transition-all disabled:opacity-75"
              >
                {isResolving ? (
                  <>
                    <span className="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>
                    <span>Applying Merge & Signing Resolution...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[22px]">done_all</span>
                    <span>Save & Confirm Sync Decision</span>
                  </>
                )}
              </button>
            </div>
          </section>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-secondary flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <h3 className="text-headline-sm text-primary font-bold">
              Conflict Resolved Successfully!
            </h3>
            <p className="text-body-md text-on-surface-variant max-w-md">
              Merged record has been saved into the encrypted local database and staged in the outbound sync queue. It will automatically transmit to the central hospital server upon link establishment.
            </p>
            <button
              onClick={() => navigate('/patients')}
              className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors shadow-sm"
            >
              Return to Patient Directory
            </button>
          </div>
        )}

        {/* Section: Records Waiting to Sync (Outbox) */}
        <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">cloud_sync</span>
              <h3 className="text-headline-sm text-on-surface font-bold">
                Outbound Sync Queue (Outbox)
              </h3>
            </div>
            <span className="text-[12px] text-on-surface-variant font-semibold bg-surface-container px-2.5 py-1 rounded-full">
              3 items queued
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Item 1 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">note_alt</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-md font-bold text-on-surface">Visit & Triage Notes</span>
                  <span className="text-body-sm text-on-surface-variant">Saved safely on this device</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
                Saved on device
              </span>
            </div>

            {/* Item 2 */}
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

            {/* Item 3 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-md font-bold text-on-surface">Vital Signs Check</span>
                  <span className="text-body-sm text-on-surface-variant">Pulse Ox 98% â€¢ BP 128/82 mmHg</span>
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
