import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatients } from '../context/PatientContext';
import AppHeader from '../components/layout/AppHeader';
import BottomNav from '../components/layout/BottomNav';
import TriageQueueCard from '../components/patients/TriageQueueCard';
import PatientCard from '../components/patients/PatientCard';

export default function PatientDirectoryPage() {
  const navigate = useNavigate();
  const { patients, allPatients, searchQuery, setSearchQuery, addPatient, loading } = usePatients();
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTriageQueue, setShowTriageQueue] = useState(true);

  // New Patient Form State
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState('Female');
  const [newWard, setNewWard] = useState('Ward 4, Ganiyari');
  const [newCondition, setNewCondition] = useState('Acute Febrile Illness');
  const [newTriage, setNewTriage] = useState('urgent');
  const [savingPatient, setSavingPatient] = useState(false);

  // Dynamic filter counts computed from actual data
  const criticalCount = allPatients.filter(p => p.triage === 'critical').length;
  const urgentCount = allPatients.filter(p => p.triage === 'urgent').length;
  const routineCount = allPatients.filter(p => p.triage === 'routine' || (!p.triage && p.triage !== 'critical' && p.triage !== 'urgent')).length;
  const riskCount = allPatients.filter(p => p.triage === 'critical' || (p.allergies && p.allergies.length > 0)).length;
  const todayCount = allPatients.filter(p => (p.lastVisit && p.lastVisit.toLowerCase().includes('today')) || p.lastVisit === 'Just now').length;
  const followupCount = allPatients.filter(p => {
    const cond = (p.condition || '').toLowerCase();
    const sum = (p.summary || '').toLowerCase();
    return cond.includes('follow-up') || cond.includes('review') || sum.includes('follow-up') || sum.includes('review');
  }).length;

  const filterChips = [
    { id: 'all', label: `All (${allPatients.length})`, count: allPatients.length },
    { id: 'critical', label: `Critical (${criticalCount})`, count: criticalCount, color: 'text-error' },
    { id: 'urgent', label: `Urgent (${urgentCount})`, count: urgentCount, color: 'text-[#881a0f]' },
    { id: 'routine', label: `Routine (${routineCount})`, count: routineCount },
    { id: 'risk', label: `High Risk / Allergy (${riskCount})`, count: riskCount },
    { id: 'today', label: `Visited Today (${todayCount})`, count: todayCount },
    { id: 'followup', label: `Follow-ups (${followupCount})`, count: followupCount },
  ];

  // Active filter logic
  const displayedPatients = patients.filter(p => {
    if (activeFilter === 'critical') return p.triage === 'critical';
    if (activeFilter === 'urgent') return p.triage === 'urgent';
    if (activeFilter === 'routine') return p.triage === 'routine' || (!p.triage && p.triage !== 'critical' && p.triage !== 'urgent');
    if (activeFilter === 'risk') return p.triage === 'critical' || (p.allergies && p.allergies.length > 0);
    if (activeFilter === 'today') return (p.lastVisit && p.lastVisit.toLowerCase().includes('today')) || p.lastVisit === 'Just now';
    if (activeFilter === 'followup') {
      const cond = (p.condition || '').toLowerCase();
      const sum = (p.summary || '').toLowerCase();
      return cond.includes('follow-up') || cond.includes('review') || sum.includes('follow-up') || sum.includes('review');
    }
    return true;
  });

  // Top critical / urgent patients for priority triage queue
  const highPriorityPatients = allPatients.filter(p => p.triage === 'critical' || p.triage === 'urgent').slice(0, 3);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSavingPatient(true);
    const newId = `PAT-${Math.floor(1000 + Math.random() * 9000)}`;
    const created = await addPatient({
      id: newId,
      name: newName.trim(),
      age: parseInt(newAge) || 30,
      gender: newGender,
      sex: newGender,
      ward: newWard,
      village: 'Ganiyari Outpost Hub',
      abha: `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      condition: newCondition,
      triage: newTriage,
      allergies: [],
      lastVisit: 'Just now',
      summary: `${newAge || 30}${newGender[0]} presenting with ${newCondition}. Registered at Ganiyari Outpost.`,
    });

    setSavingPatient(false);
    setShowAddModal(false);
    setNewName('');
    setNewAge('');

    if (created && created.id) {
      navigate(`/patients/${created.id}/intake`);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Clean Fixed Header (No cluttered allergy banner on directory) */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm">
        <AppHeader
          title="Patient Directory"
          subtitle="Offline Records & Local Triage"
          showLock={true}
          rightContent={
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-label-sm flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>New Patient</span>
            </button>
          }
        />
      </header>

      {/* Main Content Area (Clean spacing pt-24) */}
      <main className="flex-1 pt-24 pb-28 px-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Search Bar */}
        <div className="relative mt-1">
          <span className="material-symbols-outlined text-[22px] text-outline absolute left-3.5 top-3.5 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient name, ABHA ID, ward, or diagnosis..."
            className="w-full h-12 pl-11 pr-10 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface"
              aria-label="Clear Search"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Real-Time Working Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
          {filterChips.map(chip => {
            const isSelected = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                className={`px-3.5 py-1.5 rounded-full text-label-sm font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-sm ring-2 ring-primary/20'
                    : 'bg-surface-container-lowest text-on-surface border border-surface-container hover:bg-surface-container'
                }`}
              >
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Priority Triage Queue (Compact, togglable, only shown on 'all' or 'critical' filter) */}
        {(activeFilter === 'all' || activeFilter === 'critical') && !searchQuery && highPriorityPatients.length > 0 && (
          <section className="bg-surface-container-low rounded-2xl p-3 border border-surface-container flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowTriageQueue(!showTriageQueue)}
                className="flex items-center gap-2 text-left"
              >
                <span className="material-symbols-outlined text-error text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                  emergency
                </span>
                <span className="text-label-md font-bold text-on-surface">
                  High Priority Triage Queue ({highPriorityPatients.length})
                </span>
                <span className="material-symbols-outlined text-[18px] text-outline transition-transform duration-200" style={{ transform: showTriageQueue ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  expand_more
                </span>
              </button>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-error-container text-error">
                Immediate Action
              </span>
            </div>

            {showTriageQueue && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-150">
                {highPriorityPatients.map(p => (
                  <TriageQueueCard key={p.id} patient={p} isCritical={p.triage === 'critical'} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Patient Directory List Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-headline-sm font-bold text-primary">
              {activeFilter === 'all' ? 'All Patients' : filterChips.find(c => c.id === activeFilter)?.label.split(' (')[0]}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-mono text-label-sm font-bold">
              {displayedPatients.length}
            </span>
          </div>

          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="text-label-sm text-primary font-bold hover:underline flex items-center gap-1"
            >
              <span>Clear Filter</span>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Patient Cards Feed */}
        {displayedPatients.length > 0 ? (
          <div className="flex flex-col gap-3">
            {displayedPatients.map(p => (
              <PatientCard key={p.id} patient={p} />
            ))}
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl p-8 border border-surface-container flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-low text-outline flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px]">person_search</span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-headline-sm font-bold text-on-surface">No matching patients found</h3>
              <p className="text-body-sm text-on-surface-variant max-w-sm">
                No records match filter "{filterChips.find(c => c.id === activeFilter)?.label}" {searchQuery && `or search "${searchQuery}"`}.
              </p>
            </div>
            <button
              onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors shadow-sm"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Minimal Footer Status */}
        <div className="pt-2 text-center text-[12px] text-outline font-mono flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span>SQLite Local EHR • {allPatients.length} Total Patients Cached</span>
        </div>
      </main>

      {/* Modal: New Patient Registration */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-5 shadow-2xl border border-surface-container flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">person_add</span>
                <h3 className="text-headline-sm font-bold text-primary">Register New Patient</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="flex flex-col gap-3">
              <div>
                <label className="text-label-sm font-bold text-on-surface block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-label-sm font-bold text-on-surface block mb-1">Age (Years)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 42"
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-label-sm font-bold text-on-surface block mb-1">Gender</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-label-sm font-bold text-on-surface block mb-1">Ward / Location</label>
                <input
                  type="text"
                  value={newWard}
                  onChange={(e) => setNewWard(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-label-sm font-bold text-on-surface block mb-1">Chief Presentation / Condition</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute High Fever, Body Aches"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-label-sm font-bold text-on-surface block mb-1">Triage Urgency Level</label>
                <select
                  value={newTriage}
                  onChange={(e) => setNewTriage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                >
                  <option value="critical">Critical (Immediate Attention)</option>
                  <option value="urgent">Urgent (Priority Evaluation)</option>
                  <option value="routine">Routine (Standard Queue)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-bold text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPatient}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container shadow-md active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {savingPatient ? 'sync' : 'check'}
                  </span>
                  <span>{savingPatient ? 'Saving...' : 'Register & Start'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
