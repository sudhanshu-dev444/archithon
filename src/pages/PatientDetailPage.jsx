import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatients } from '../context/PatientContext';
import AppHeader from '../components/layout/AppHeader';
import AllergyBanner from '../components/layout/AllergyBanner';
import BottomNav from '../components/layout/BottomNav';
import VitalsGrid from '../components/patients/VitalsGrid';
import encountersData from '../data/encounters.json';

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPatientById } = usePatients();
  const [activeFilter, setActiveFilter] = useState('all');

  const patient = getPatientById(id) || {
    id: id || 'PAT-8812',
    name: 'Sunita Devi',
    age: 34,
    gender: 'Female',
    abha: '91-4421-9982-1102',
    ward: 'Ward 4, Ganiyari',
    village: 'Ganiyari Outpost Hub',
    phone: '+91 98271 44021',
    condition: 'Acute Febrile Illness â€¢ Suspected Malaria / Dengue',
    vitals: {
      bp: '128/82',
      bpDelta: '+4',
      pulse: '88 bpm',
      temp: '101.4Â°F',
      tempTrend: 'high',
      spo2: '98%',
      fbs: '112 mg/dL',
    },
    allergies: [
      {
        id: 'alg-1',
        name: 'Penicillin / Amoxicillin',
        severity: 'Severe Anaphylaxis Risk',
        reaction: 'Bronchospasm, Facial Edema, Anaphylaxis',
        crossReactivity: ['Amoxicillin', 'Ampicillin', 'Augmentin'],
      },
    ],
  };

  const encounters = encountersData[patient.id] || encountersData['PAT-8812'] || [];

  const filterChips = [
    { id: 'all', label: `All Records (${encounters.length})` },
    { id: 'notes', label: 'Doctor Notes (2)' },
    { id: 'meds', label: 'Medications (2)' },
    { id: 'labs', label: 'Lab Reports (1)' },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm">
        <AppHeader
          title="Patient Medical Record"
          subtitle={`#${patient.id} â€¢ Local RAG Active`}
          showBack={true}
          showLock={true}
        />
        {patient.allergies?.length > 0 && (
          <AllergyBanner patient={patient} riskLevel="Lethal Risk" />
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-32 pb-28 px-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Patient Identity Profile Card */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              {patient.photoUrl ? (
                <img
                  src={patient.photoUrl}
                  alt={patient.name}
                  className="w-14 h-14 rounded-2xl object-cover shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-surface-container-high text-primary font-bold text-headline-sm flex items-center justify-center">
                  {patient.initials || patient.name.slice(0, 2)}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-headline-md text-primary font-bold">{patient.name}</h2>
                  <span className="text-[11px] font-mono bg-surface-container px-2 py-0.5 rounded text-outline font-semibold">
                    {patient.id}
                  </span>
                </div>
                <span className="text-body-sm text-on-surface-variant">
                  {patient.age} yrs â€¢ {patient.gender} â€¢ ABHA: {patient.abha}
                </span>
                <span className="text-body-sm text-secondary font-medium">
                  {patient.ward} â€¢ {patient.village}
                </span>
              </div>
            </div>

            <a
              href={`tel:${patient.phone}`}
              className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center text-primary hover:bg-surface-variant transition-colors"
              title={`Call ${patient.phone}`}
            >
              <span className="material-symbols-outlined text-[20px]">call</span>
            </a>
          </div>

          {/* Vitals Summary Grid */}
          <div className="pt-2 border-t border-surface-container flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                LATEST RECORDED VITALS (TODAY, 09:40 AM)
              </span>
              <span className="text-label-sm text-outline">Ganiyari Clinic Node</span>
            </div>
            <VitalsGrid vitals={patient.vitals} />
          </div>

          {/* Allergy Critical Callout Card */}
          {patient.allergies?.length > 0 && (
            <div className="bg-error-container rounded-xl p-3.5 flex items-start gap-3 border border-error">
              <span className="material-symbols-outlined text-error text-[24px] shrink-0 mt-0.5">
                warning
              </span>
              <div className="flex flex-col">
                <span className="text-label-sm font-bold uppercase text-error tracking-wider">
                  CONFIRMED SEVERE DRUG ALLERGY
                </span>
                <p className="text-body-sm text-on-error-container font-semibold mt-0.5">
                  {patient.allergies[0].name} â€” {patient.allergies[0].severity}
                </p>
                <p className="text-[12px] text-on-error-container/90 mt-0.5">
                  Cross-reactive beta-lactams: {patient.allergies[0].crossReactivity?.join(', ')}. Administration is strictly contraindicated.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Primary CTA: Start New Clinical Intake */}
        <button
          onClick={() => navigate(`/patients/${patient.id}/intake`)}
          className="w-full min-h-[52px] rounded-xl bg-primary text-on-primary font-bold text-label-lg flex items-center justify-center gap-2 hover:bg-primary-container shadow-md active:scale-[0.99] transition-all"
        >
          <span className="material-symbols-outlined text-[22px]">add_notes</span>
          <span>Start New Consultation / Clinical Intake</span>
        </button>

        {/* Action Grid: Order Lab, RAG Search, Share, Referral */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate(`/patients/${patient.id}/intake`)}
            className="min-h-[48px] rounded-xl bg-surface-container-lowest border border-surface-container text-primary font-bold text-label-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">biotech</span>
            <span>Order Lab Test</span>
          </button>

          <button
            onClick={() => navigate(`/patients/${patient.id}/review`)}
            className="min-h-[48px] rounded-xl bg-surface-container-lowest border border-surface-container text-primary font-bold text-label-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">psychology</span>
            <span>RAG Clinical Insights</span>
          </button>
        </div>

        {/* Consultation & Encounter History Timeline */}
        <section className="flex flex-col gap-3 mt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-sm text-on-surface font-bold">
              Consultation & Encounter Timeline
            </h3>
            <span className="text-label-sm text-secondary font-semibold">Local SQLite DB</span>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {filterChips.map(chip => (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                className={`px-3 py-1 rounded-full text-label-sm font-semibold whitespace-nowrap transition-all ${
                  activeFilter === chip.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Encounter Cards */}
          <div className="flex flex-col gap-3">
            {encounters.map(enc => (
              <div
                key={enc.id}
                className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm border flex flex-col gap-2.5 ${
                  enc.status === 'conflict'
                    ? 'border-error/40 bg-error-container/10'
                    : enc.status === 'adverse'
                    ? 'border-error-container'
                    : 'border-surface-container'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-tabular font-bold text-primary text-[15px]">{enc.date}</span>
                    <span className="text-[13px] text-on-surface-variant font-medium">â€¢ {enc.facility}</span>
                  </div>

                  {enc.status === 'conflict' ? (
                    <button
                      onClick={() => navigate('/sync')}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container text-label-sm font-bold animate-pulse"
                    >
                      <span className="material-symbols-outlined text-[14px]">sync_problem</span>
                      <span>Sync Conflict (Needs Decision)</span>
                    </button>
                  ) : enc.status === 'adverse' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container text-label-sm font-bold">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      <span>Adverse Drug Event</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-label-sm font-semibold">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>{enc.statusLabel || 'Synced to District EHR'}</span>
                    </span>
                  )}
                </div>

                <p className="text-label-md text-on-surface-variant">
                  Attending Clinician: <span className="font-bold text-on-surface">{enc.clinician}</span>
                </p>

                <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold uppercase text-secondary">
                    CLINICAL DIAGNOSIS & ASSESSMENT
                  </span>
                  <p className="text-body-md text-on-surface leading-relaxed">{enc.notes}</p>
                </div>

                {enc.medications?.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase text-secondary">
                      PRESCRIBED MEDICATIONS
                    </span>
                    <div className="bg-surface-container-low rounded-xl p-2.5 flex flex-col gap-1.5 text-[13px]">
                      {enc.medications.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-on-surface font-semibold">
                          <span>{i + 1}. {m.name}</span>
                          <span className="font-tabular text-secondary text-right">
                            {m.dosage} ({m.duration})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
