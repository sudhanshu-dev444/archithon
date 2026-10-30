import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatients } from '../context/PatientContext';
import AppHeader from '../components/layout/AppHeader';
import AllergyBanner from '../components/layout/AllergyBanner';
import BottomNav from '../components/layout/BottomNav';
import TriageQueueCard from '../components/patients/TriageQueueCard';
import PatientCard from '../components/patients/PatientCard';
import VitalsGrid from '../components/patients/VitalsGrid';

export default function PatientDirectoryPage() {
  const navigate = useNavigate();
  const { patients, allPatients, searchQuery, setSearchQuery } = usePatients();
  const [activeFilter, setActiveFilter] = useState('all');

  const sunita = allPatients.find(p => p.id === 'PAT-8812') || allPatients[0];

  const filterChips = [
    { id: 'all', label: `All Patients (${allPatients.length})` },
    { id: 'today', label: 'Visited Today (14)' },
    { id: 'followup', label: 'Follow-ups Due (8)' },
    { id: 'risk', label: 'High Risk (3)' },
  ];

  const triagePatients = allPatients.slice(0, 3);

  const displayedPatients = patients.filter(p => {
    if (activeFilter === 'risk') return p.triage === 'critical' || p.allergies?.length > 0;
    if (activeFilter === 'today') return p.lastVisit?.includes('Today');
    return true;
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm">
        <AppHeader
          title="Swasthya Sync"
          subtitle="Offline Records & Local RAG"
          showLock={true}
        />
        {sunita && <AllergyBanner patient={sunita} riskLevel="Active Guard" />}
      </header>

      {/* Main Scrollable Content Area */}
      <main className="flex-1 pt-32 pb-28 px-4 max-w-4xl mx-auto w-full flex flex-col gap-5">
        {/* Search Bar */}
        <div className="relative mt-2">
          <span className="material-symbols-outlined text-[22px] text-outline absolute left-3.5 top-3.5 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 248 records (Name, ABHA, Ward, Diagnosis...)"
            className="w-full h-12 pl-11 pr-12 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3 text-outline hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          ) : (
            <button className="absolute right-3 top-2.5 p-1 text-primary hover:bg-surface-container rounded-lg">
              <span className="material-symbols-outlined text-[22px]">tune</span>
            </button>
          )}
        </div>

        {/* Filter Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {filterChips.map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3.5 py-1.5 rounded-full text-label-sm font-semibold whitespace-nowrap transition-all ${
                activeFilter === chip.id
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Today's Triage Queue */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">emergency</span>
              <h2 className="text-headline-sm text-on-surface font-bold">
                Today's Triage Queue
              </h2>
            </div>
            <span className="bg-error-container text-on-error-container px-2.5 py-0.5 rounded-full text-label-sm font-bold">
              3 In Queue
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {triagePatients.map((p, idx) => (
              <TriageQueueCard
                key={p.id}
                patient={p}
                isCritical={idx === 0}
              />
            ))}
          </div>
        </section>

        {/* Featured Patient Chart (Sunita Devi) */}
        {sunita && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                ACTIVE PATIENT SUMMARY
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-bold">
                Local RAG Indexed
              </span>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={sunita.photoUrl}
                alt={sunita.name}
                className="w-14 h-14 rounded-2xl object-cover shadow-sm"
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-headline-sm text-primary font-bold">{sunita.name}</h3>
                  <span className="text-label-sm text-outline font-mono">#{sunita.id}</span>
                </div>
                <span className="text-body-sm text-on-surface-variant">
                  {sunita.age}y â€¢ {sunita.gender} â€¢ ABHA: {sunita.abha}
                </span>
                <span className="text-body-sm text-secondary font-medium mt-0.5">
                  {sunita.ward} â€¢ {sunita.condition}
                </span>
              </div>
            </div>

            {/* Vitals Snapshot */}
            <VitalsGrid vitals={sunita.vitals} />

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-container">
              <button
                onClick={() => navigate(`/patients/${sunita.id}`)}
                className="min-h-[48px] rounded-xl bg-surface-container-high text-primary font-bold text-label-md flex items-center justify-center gap-1.5 hover:bg-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">folder_open</span>
                <span>Open Patient Record</span>
              </button>

              <button
                onClick={() => navigate(`/patients/${sunita.id}/intake`)}
                className="min-h-[48px] rounded-xl bg-primary text-on-primary font-bold text-label-md flex items-center justify-center gap-1.5 hover:bg-primary-container transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">mic</span>
                <span>Start Clinical Intake</span>
              </button>
            </div>
          </section>
        )}

        {/* All Cached Patients List */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-sm text-on-surface font-bold">
              All Cached Patients ({displayedPatients.length})
            </h3>
            <span className="text-body-sm text-secondary">Offline SQLite DB</span>
          </div>

          <div className="flex flex-col gap-3">
            {displayedPatients.map(p => (
              <PatientCard key={p.id} patient={p} />
            ))}
          </div>
        </section>

        {/* Offline Vault Security Notice */}
        <div className="py-4 text-center flex flex-col items-center justify-center gap-1 text-on-surface-variant">
          <div className="flex items-center gap-1.5 text-label-sm font-semibold">
            <span className="material-symbols-outlined text-[18px] text-secondary">lock</span>
            <span>Encrypted Offline Clinical Directory â€¢ All 248 records saved locally</span>
          </div>
          <span className="text-[11px] text-outline">
            Zero cloud dependency during consultation â€¢ Auto-synchronization on network connect
          </span>
        </div>
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
