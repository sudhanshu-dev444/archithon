import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatients } from '../context/PatientContext';
import { useToast } from '../context/ToastContext';
import { getUnifiedClinicalRecords } from '../services/recordsStorage';
import AppHeader from '../components/layout/AppHeader';
import AllergyBanner from '../components/layout/AllergyBanner';
import BottomNav from '../components/layout/BottomNav';
import VitalsGrid from '../components/patients/VitalsGrid';
import AudioRecordingsList from '../components/patients/AudioRecordingsList';
import VoiceRecorder from '../components/intake/VoiceRecorder';
import CameraCapture from '../components/ui/CameraCapture';
import encountersData from '../data/encounters.json';

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPatientById, updatePatientRecord } = usePatients();
  const { showToast } = useToast();

  const [activeFilter, setActiveFilter] = useState('all');
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [refreshAudioTrigger, setRefreshAudioTrigger] = useState(0);

  const rawPatient = getPatientById(id);
  const patient = rawPatient || {
    id: id || 'PAT-8812',
    name: 'Sunita Devi',
    age: 34,
    gender: 'Female',
    sex: 'Female',
    abha: '91-4421-9982-1102',
    ward: 'Ward 4, Ganiyari',
    village: 'Ganiyari Outpost Hub',
    phone: '+91 98271 44021',
    address: 'Ward 4, Near Primary Health Sub-Center, Ganiyari',
    emergency_contact_name: 'Rajesh Verma (Brother)',
    emergency_contact_phone: '+91 98271 99341',
    condition: 'Acute Febrile Illness • Suspected Malaria / Dengue',
    vitals: {
      bp: '128/82',
      bpDelta: '+4',
      pulse: '88 bpm',
      temp: '101.4°F',
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

  // Edit Patient Form State
  const [editForm, setEditForm] = useState({
    name: patient.name || '',
    phone: patient.phone || '',
    age: patient.age || '',
    date_of_birth: patient.date_of_birth || '',
    gender: patient.gender || patient.sex || 'Female',
    ward: patient.ward || '',
    address: patient.address || '',
    emergency_contact_name: patient.emergency_contact_name || '',
    emergency_contact_phone: patient.emergency_contact_phone || '',
    condition: patient.condition || '',
    triage: patient.triage || 'routine',
  });
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditModal = () => {
    setEditForm({
      name: patient.name || '',
      phone: patient.phone || '',
      age: patient.age || '',
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || patient.sex || 'Female',
      ward: patient.ward || '',
      address: patient.address || '',
      emergency_contact_name: patient.emergency_contact_name || '',
      emergency_contact_phone: patient.emergency_contact_phone || '',
      condition: patient.condition || '',
      triage: patient.triage || 'routine',
    });
    setEditErrors({});
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!editForm.name.trim()) errors.name = 'Name is required';
    if (editForm.phone) {
      const clean = editForm.phone.replace(/[\s\-()]/g, '');
      if (!/^\+?\d{10,14}$/.test(clean)) errors.phone = 'Valid 10-14 digit phone required';
    }
    if (editForm.emergency_contact_phone) {
      const clean = editForm.emergency_contact_phone.replace(/[\s\-()]/g, '');
      if (!/^\+?\d{10,14}$/.test(clean)) errors.emergency_phone = 'Valid phone required';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setSavingEdit(true);
    try {
      await updatePatientRecord(patient.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        age: parseInt(editForm.age) || patient.age,
        date_of_birth: editForm.date_of_birth || null,
        gender: editForm.gender,
        sex: editForm.gender,
        ward: editForm.ward.trim(),
        address: editForm.address.trim(),
        emergency_contact_name: editForm.emergency_contact_name.trim(),
        emergency_contact_phone: editForm.emergency_contact_phone.trim(),
        condition: editForm.condition.trim(),
        triage: editForm.triage,
      });

      setShowEditModal(false);
      showToast('Patient details updated successfully', 'success');
    } catch (err) {
      showToast(`Update failed: ${err.message}`, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const [liveRecords, setLiveRecords] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadPatientRecords() {
      const records = await getUnifiedClinicalRecords(patient.id);
      if (active) setLiveRecords(records);
    }
    loadPatientRecords();

    const handleUpdate = () => {
      loadPatientRecords();
    };

    window.addEventListener('swasthya_records_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      active = false;
      window.removeEventListener('swasthya_records_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [patient.id, refreshAudioTrigger]);

  const rawEncounters = encountersData[patient.id] || encountersData['PAT-8812'] || [];

  // Merge static base encounters with live dynamic encounters and prescriptions
  const allTimelineItems = useMemo(() => {
    const convertedLive = [];

    liveRecords.forEach((r) => {
      if (r.record_type === 'notes') {
        convertedLive.push({
          id: r.id,
          type: 'notes',
          timestamp: r.timestamp || Date.now(),
          date: r.timestamp
            ? new Date(r.timestamp).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Today',
          facility: 'Ganiyari Outpost Hub',
          clinician: r.doctor_name || 'Dr. Priya Sharma',
          notes: r.history || r.complaint || r.title,
          medications: r.medications || [],
          statusLabel: 'Signed & Approved Record',
        });
      } else if (r.record_type === 'prescription') {
        convertedLive.push({
          id: r.id,
          type: 'meds',
          timestamp: r.timestamp || Date.now(),
          date: r.timestamp
            ? new Date(r.timestamp).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Today',
          facility: 'Ganiyari Outpost Hub',
          clinician: r.doctor_name || 'Dr. Priya Sharma',
          notes: `Prescription: ${r.drug_name}`,
          drug_name: r.drug_name,
          medications: [
            {
              name: r.drug_name,
              dosage: r.dosage || 'Standard Dose',
              duration: r.duration || '3-5 days',
              frequency: r.frequency || 'TDS',
              route: r.route || 'Oral',
            },
          ],
          statusLabel: 'Active Prescription',
        });
      } else if (r.record_type === 'audio') {
        convertedLive.push({
          id: r.id,
          type: 'audio',
          timestamp: r.timestamp || Date.now(),
          date: r.timestamp
            ? new Date(r.timestamp).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Today',
          facility: 'Ganiyari Outpost Hub',
          clinician: r.doctor_name || 'Clinical Staff',
          notes: r.title,
          medications: [],
          statusLabel: 'Saved Audio Dictation',
        });
      }
    });

    const combined = [...convertedLive, ...rawEncounters];

    // Deduplicate by ID
    const seen = new Set();
    return combined.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [rawEncounters, liveRecords]);

  // Compute counts for filter chips
  const medCount = allTimelineItems.filter(
    (e) => e.type === 'meds' || (e.medications && e.medications.length > 0) || e.drug_name
  ).length;
  const notesCount = allTimelineItems.filter(
    (e) => e.type !== 'audio' && e.type !== 'labs' && e.type !== 'meds'
  ).length;
  const audioCount = allTimelineItems.filter((e) => e.type === 'audio').length;
  const labCount = allTimelineItems.filter((e) => e.type === 'labs' || e.type === 'lab').length;

  const filterChips = [
    { id: 'all', label: `All Records (${allTimelineItems.length})` },
    { id: 'meds', label: `Medications & Rx (${medCount})` },
    { id: 'notes', label: `Doctor Notes (${notesCount})` },
    { id: 'audio', label: `Audio Dictations (${audioCount})` },
    { id: 'labs', label: `Lab Reports (${labCount})` },
  ];

  const filteredTimeline = useMemo(() => {
    if (activeFilter === 'all') return allTimelineItems;
    if (activeFilter === 'meds')
      return allTimelineItems.filter(
        (e) => e.type === 'meds' || (e.medications && e.medications.length > 0) || e.drug_name
      );
    if (activeFilter === 'notes')
      return allTimelineItems.filter(
        (e) => e.type !== 'audio' && e.type !== 'labs' && e.type !== 'meds'
      );
    if (activeFilter === 'audio') return allTimelineItems.filter((e) => e.type === 'audio');
    if (activeFilter === 'labs') return allTimelineItems.filter((e) => e.type === 'labs' || e.type === 'lab');
    return allTimelineItems;
  }, [activeFilter, allTimelineItems]);

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm">
        <AppHeader
          title="Patient Medical Record"
          subtitle={`#${patient.id} • Local RAG Active`}
          showBack={true}
          showLock={true}
        />
        {patient.allergies?.length > 0 && (
          <AllergyBanner patient={patient} riskLevel="Lethal Risk" />
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-32 pb-32 px-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Patient Identity Profile Card */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="relative group">
                {patient.photoUrl || patient.photo_url ? (
                  <img
                    src={patient.photoUrl || patient.photo_url}
                    alt={patient.name}
                    className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-primary/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-surface-container-high text-primary font-bold text-headline-sm flex items-center justify-center border border-surface-container">
                    {patient.initials || patient.name.slice(0, 2)}
                  </div>
                )}
                {/* Camera Overlay Icon to Update Photo */}
                <button
                  onClick={() => setShowCamera(true)}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md hover:bg-primary-container transition-transform active:scale-95"
                  title="Update Patient Photo via Camera"
                >
                  <span className="material-symbols-outlined text-[13px]">photo_camera</span>
                </button>
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-headline-md text-primary font-bold">{patient.name}</h2>
                  <span className="text-[11px] font-mono bg-surface-container px-2 py-0.5 rounded text-outline font-semibold">
                    {patient.id}
                  </span>
                </div>
                <span className="text-body-sm text-on-surface-variant">
                  {patient.age} yrs • {patient.gender || patient.sex} • ABHA: {patient.abha}
                </span>
                <span className="text-body-sm text-secondary font-medium">
                  {patient.ward || 'Ward 4'} • {patient.village || 'Ganiyari'}
                </span>
                {patient.phone && (
                  <span className="text-[12px] text-on-surface-variant font-mono">
                    📞 {patient.phone}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={openEditModal}
                className="h-10 px-3 rounded-xl bg-surface-container-high text-primary font-bold text-label-sm flex items-center gap-1 hover:bg-surface-variant transition-colors"
                title="Edit Patient Details"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span className="hidden sm:inline">Edit Details</span>
              </button>
              {patient.phone && (
                <a
                  href={`tel:${patient.phone}`}
                  className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary hover:bg-surface-variant transition-colors"
                  title={`Call ${patient.phone}`}
                >
                  <span className="material-symbols-outlined text-[20px]">call</span>
                </a>
              )}
            </div>
          </div>

          {/* Extended Patient Details Accordion/Summary */}
          {(patient.address || patient.emergency_contact_name) && (
            <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container text-body-sm text-on-surface-variant flex flex-col gap-1">
              {patient.address && (
                <div className="flex items-start gap-1.5 text-[12px]">
                  <span className="material-symbols-outlined text-[16px] text-secondary shrink-0 mt-0.5">home</span>
                  <span><strong>Address:</strong> {patient.address}</span>
                </div>
              )}
              {patient.emergency_contact_name && (
                <div className="flex items-center gap-1.5 text-[12px]">
                  <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">contact_phone</span>
                  <span><strong>Emergency:</strong> {patient.emergency_contact_name} ({patient.emergency_contact_phone || 'No phone'})</span>
                </div>
              )}
            </div>
          )}

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
                  {patient.allergies[0].name} — {patient.allergies[0].severity}
                </p>
                <p className="text-[12px] text-on-error-container/90 mt-0.5">
                  Cross-reactive beta-lactams: {patient.allergies[0].crossReactivity?.join(', ')}. Administration is strictly contraindicated.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Action Bar: New Consultation & New Recording Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate(`/patients/${patient.id}/intake`)}
            className="w-full min-h-[52px] rounded-xl bg-primary text-on-primary font-bold text-label-lg flex items-center justify-center gap-2 hover:bg-primary-container shadow-md active:scale-[0.99] transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">add_notes</span>
            <span>Start New Consultation Intake</span>
          </button>

          <button
            onClick={() => setShowRecordingModal(true)}
            className="w-full min-h-[52px] rounded-xl bg-secondary text-on-secondary font-bold text-label-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all hover:opacity-95"
          >
            <span className="material-symbols-outlined text-[22px]">mic</span>
            <span>New Ambient Recording</span>
          </button>
        </div>

        {/* Action Grid: Order Lab, RAG Search */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate(`/patients/${patient.id}/intake`)}
            className="min-h-[46px] rounded-xl bg-surface-container-lowest border border-surface-container text-primary font-bold text-label-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">biotech</span>
            <span>Order Lab Test</span>
          </button>

          <button
            onClick={() => navigate(`/patients/${patient.id}/review`)}
            className="min-h-[46px] rounded-xl bg-surface-container-lowest border border-surface-container text-primary font-bold text-label-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">psychology</span>
            <span>RAG Clinical Insights</span>
          </button>
        </div>

        {/* Section: Saved Audio Ambient Dictations */}
        <section className="flex flex-col gap-2.5 bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">graphic_eq</span>
              <h3 className="text-headline-sm text-on-surface font-bold">
                Saved Ambient Audio Recordings
              </h3>
            </div>
            <button
              onClick={() => setShowRecordingModal(true)}
              className="text-[12px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>New Recording</span>
            </button>
          </div>

          <AudioRecordingsList
            patientId={patient.id}
            refreshTrigger={refreshAudioTrigger}
          />
        </section>

        {/* Consultation & Encounter History Timeline */}
        <section className="flex flex-col gap-3 mt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-sm text-on-surface font-bold">
              Consultation &amp; Encounter Timeline
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

          {/* Encounter / Prescription / Audio Cards Feed */}
          <div className="flex flex-col gap-3">
            {filteredTimeline.length === 0 ? (
              <div className="p-8 bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col items-center justify-center text-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-outline">search_off</span>
                <span className="text-label-lg font-bold text-on-surface">
                  No {activeFilter === 'all' ? 'clinical' : activeFilter} records found
                </span>
                <p className="text-body-sm text-outline max-w-sm">
                  There are no records matching the selected filter for this patient.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className="mt-1 px-4 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-label-sm"
                >
                  Show All Records
                </button>
              </div>
            ) : (
              filteredTimeline.map((enc) => (
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
                      <span className="text-[13px] text-on-surface-variant font-medium">• {enc.facility}</span>
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
                      {enc.type === 'meds' ? 'PRESCRIPTION RECORD' : 'CLINICAL DIAGNOSIS & ASSESSMENT'}
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
                            <span>
                              {i + 1}. {m.name}
                            </span>
                            <span className="font-tabular text-secondary text-right">
                              {m.dosage} ({m.duration || '3-5 days'})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Floating Action Button (FAB) for New Ambient Recording */}
      <button
        onClick={() => setShowRecordingModal(true)}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-primary text-on-primary shadow-2xl flex items-center justify-center hover:bg-primary-container active:scale-95 transition-all group"
        title="Start New Audio Recording for this patient"
      >
        <span className="material-symbols-outlined text-[26px]">mic</span>
      </button>

      {/* Modal: New Audio Recording Sheet */}
      {showRecordingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-4 shadow-2xl border border-surface-container flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-container pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">mic</span>
                <div>
                  <h3 className="text-headline-sm font-bold text-primary">New Ambient Dictation</h3>
                  <span className="text-[12px] text-outline">Patient: {patient.name} (#{patient.id})</span>
                </div>
              </div>
              <button
                onClick={() => setShowRecordingModal(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <VoiceRecorder
              patientId={patient.id}
              encounterId={`ENC-${Date.now()}`}
              onSaved={(rec) => {
                setShowRecordingModal(false);
                setRefreshAudioTrigger(t => t + 1);
              }}
              onDiscard={() => setShowRecordingModal(false)}
            />
          </div>
        </div>
      )}

      {/* Modal: Edit Patient Details */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-surface-container flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-container pb-3 sticky top-0 bg-surface-container-lowest z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">edit</span>
                <h3 className="text-headline-sm font-bold text-primary">Edit Patient Details</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3.5">
              <div>
                <label className="text-label-sm font-bold text-on-surface block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {editErrors.name && <p className="text-error text-[11px] mt-1">{editErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-label-sm font-bold text-on-surface block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {editErrors.phone && <p className="text-error text-[11px] mt-1">{editErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-label-sm font-bold text-on-surface block mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-label-sm font-bold text-on-surface block mb-1">Age (Years)</label>
                  <input
                    type="number"
                    value={editForm.age}
                    onChange={(e) => setEditForm(f => ({ ...f, age: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-label-sm font-bold text-on-surface block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.date_of_birth}
                    onChange={(e) => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-label-sm font-bold text-on-surface block mb-1">Ward / Location</label>
                  <input
                    type="text"
                    value={editForm.ward}
                    onChange={(e) => setEditForm(f => ({ ...f, ward: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-label-sm font-bold text-on-surface block mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-2.5">
                <span className="text-label-sm font-bold text-secondary uppercase tracking-wider">
                  Emergency Contact Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface block mb-0.5">Contact Name</label>
                    <input
                      type="text"
                      value={editForm.emergency_contact_name}
                      onChange={(e) => setEditForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface block mb-0.5">Contact Phone</label>
                    <input
                      type="tel"
                      value={editForm.emergency_contact_phone}
                      onChange={(e) => setEditForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-label-sm font-bold text-on-surface block mb-1">Chief Presentation / Condition</label>
                <input
                  type="text"
                  value={editForm.condition}
                  onChange={(e) => setEditForm(f => ({ ...f, condition: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-surface-container sticky bottom-0 bg-surface-container-lowest">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-bold text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container shadow-md active:scale-95 transition-transform flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {savingEdit ? 'sync' : 'save'}
                  </span>
                  <span>{savingEdit ? 'Saving Changes...' : 'Save Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Capture Modal for Updating Patient Photo */}
      {showCamera && (
        <CameraCapture
          title={`Update Photo: ${patient.name}`}
          mode="photo"
          initialFacingMode="environment"
          onCapture={async (dataUrl) => {
            try {
              await updatePatientRecord(patient.id, { photo_url: dataUrl });
              showToast('Patient photograph updated', 'success');
            } catch (err) {
              showToast(`Failed to save photo: ${err.message}`, 'error');
            }
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
