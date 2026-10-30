import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePatients } from '../context/PatientContext';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import AppHeader from '../components/layout/AppHeader';
import AllergyBanner from '../components/layout/AllergyBanner';
import BottomNav from '../components/layout/BottomNav';
import DrugConflictCard from '../components/review/DrugConflictCard';
import ReviewSection from '../components/review/ReviewSection';
import MedicineAutocomplete from '../components/prescription/MedicineAutocomplete';
import AIAssistant from '../components/prescription/AIAssistant';
import { persistEncounterWithPrescriptions } from '../services/recordsStorage';

export default function ClinicalReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getPatientById, updatePatientRecord } = usePatients();
  const { doctor } = useAuth();
  const { showToast } = useToast();
  const { triggerSyncNow, dispatch: syncDispatch } = useSync();

  const patient = getPatientById(id) || {
    id: id || 'PAT-8812',
    name: 'Sunita Devi',
    age: 34,
    gender: 'Female',
    abha: '91-4421-9982-1102',
    ward: 'Ward 4, Ganiyari',
    vitals: {
      bp: '128/82',
      hr: 88,
      temp: '101.4°F',
      tempTrend: 'high',
      spo2: '98%',
    },
    allergies: [
      {
        id: 'alg-1',
        name: 'Penicillin / Amoxicillin',
        severity: 'Severe Anaphylaxis Risk',
      },
    ],
  };

  const initialObservations =
    location.state?.notes ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem(`swasthya_draft_observations_${patient.id}`)
      : null) ||
    'Patient presents with a 3-day history of acute high-grade fever with rigors, flushed skin, sweating, and severe retro-orbital headache. Denies persistent cough, hemoptysis, or shortness of breath. Hydration status is moderate.';

  const [observations, setObservations] = useState(initialObservations);
  const [isEditingObservations, setIsEditingObservations] = useState(false);

  const isDoctorUser = doctor?.role?.toLowerCase().includes('doctor') || doctor?.role?.toLowerCase().includes('clinician') || !doctor?.role;

  const [doctorVerified, setDoctorVerified] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Medication list state
  const [medications, setMedications] = useState([
    {
      id: 'med-1',
      name: 'Paracetamol Tablets 650 mg',
      dosage: '1 tablet 4 times daily (every 6 hours) after meals (3 days)',
      accepted: true,
    },
    {
      id: 'med-2',
      name: 'Oral Rehydration Salts (ORS)',
      dosage: '1 sachet dissolved in 1 liter clean water, sip ad libitum for hydration',
      accepted: true,
    },
  ]);

  // New Rx Manual Entry State
  const [newMedQuery, setNewMedQuery] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [showAddMedForm, setShowAddMedForm] = useState(false);

  const handleAdoptAzithromycin = () => {
    setMedications((prev) => [
      ...prev,
      {
        id: `med-alt-${Date.now()}`,
        name: 'Azithromycin Tablets 500 mg (Safe Alternative)',
        dosage: '1 tablet once daily before food for 5 days',
        accepted: true,
      },
    ]);
    showToast('Azithromycin 500mg added as safe alternative', 'success');
  };

  const handleAddManualMedication = () => {
    if (!newMedQuery.trim()) {
      showToast('Please enter or select a medicine name', 'error');
      return;
    }

    setMedications((prev) => [
      ...prev,
      {
        id: `med-user-${Date.now()}`,
        name: newMedQuery.trim(),
        dosage: newMedDosage.trim() || 'As directed by clinician',
        accepted: true,
      },
    ]);

    setNewMedQuery('');
    setNewMedDosage('');
    setShowAddMedForm(false);
    showToast('Prescription updated', 'success');
  };

  const handleConfirmAiSuggestion = (suggestion) => {
    setMedications((prev) => [
      ...prev,
      {
        id: `med-ai-${Date.now()}`,
        name: `${suggestion.drug_name} ${suggestion.strength}`,
        dosage: `${suggestion.dosage} (${suggestion.duration})`,
        accepted: true,
        source: 'AI Assistant (Clinician Confirmed)',
      },
    ]);
    showToast(`Added ${suggestion.drug_name} to prescription upon doctor confirmation`, 'success');
  };

  const handleSaveAndApprove = async () => {
    if (!doctorVerified) {
      showToast('Please check the Doctor Verification checkbox before approving this record.', 'warning');
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      // 1. Commit encounter & all individual prescriptions to both Local Vault and SQLite Backend
      const result = await persistEncounterWithPrescriptions({
        patient,
        observations,
        diagnosis: 'Acute Febrile Illness • Probable Dengue Fever (ICD-10: A90)',
        icd10: 'A90',
        medications,
        doctor,
      });

      const encounterId = result.encounter.id;

      // 2. Update patient summary and condition in real-time
      await updatePatientRecord(patient.id, {
        condition: 'Acute Febrile Illness (AFI)',
        triage: 'urgent',
        summary: observations.slice(0, 160),
      }).catch(() => {});

      // 3. Differential Sync Engine Push
      const op = {
        op_id: `OP-VERIFIED-${patient.id}-${Date.now()}`,
        op_type: 'UPDATE',
        entity_type: 'encounter',
        entity_id: encounterId,
        patient_id: patient.id,
        field_path: 'status',
        base_version: 0,
        value_enc: JSON.stringify({ status: 'approved', medications }),
        client_ts: Date.now(),
        priority: 2,
      };

      await api.pushOperations([op]).catch(() => {
        syncDispatch({ type: 'QUEUE_OUTBOX', payload: op });
      });

      setSaveSuccess(true);
      showToast('Clinical record approved & saved to permanent EHR', 'success');

      // Task 6: Navigate to home (patient directory) only on success, preventing stale form return
      setTimeout(() => {
        navigate('/patients', { replace: true });
      }, 1000);
    } catch (err) {
      console.error('Save encounter error:', err);
      setSaveError(err.message || 'Failed to save patient record.');
      showToast(`Save error: ${err.message}`, 'error');
      // On failure, stay on the page and show the error!
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm">
        <AppHeader
          title="Clinical Case Review"
          subtitle="Verification & Doctor Sign-off"
          showBack={true}
          showLock={true}
        />
        {patient.allergies?.length > 0 && (
          <AllergyBanner patient={patient} riskLevel="High Risk" />
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-32 px-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Save Error Alert Banner */}
        {saveError && (
          <div className="bg-error-container border border-error/50 rounded-xl p-4 flex items-start gap-3 text-on-error-container">
            <span className="material-symbols-outlined text-error text-[24px] shrink-0 mt-0.5">error</span>
            <div className="flex-1">
              <span className="text-label-lg font-bold text-error block">Error Saving Record</span>
              <p className="text-body-sm mt-0.5">{saveError}</p>
              <p className="text-[12px] opacity-80 mt-1">You are still on this page. No inputs were lost. Please try saving again.</p>
            </div>
          </div>
        )}

        {/* Patient Profile Card & Vitals */}
        <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-headline-sm">
                {patient.name.slice(0, 2)}
              </div>
              <div className="flex flex-col">
                <h2 className="text-headline-sm text-primary font-bold">{patient.name}</h2>
                <span className="text-body-sm text-on-surface-variant">
                  {patient.age} yrs • {patient.gender} • ABHA: {patient.abha}
                </span>
              </div>
            </div>
            <span className="text-label-sm font-mono text-outline font-bold">#{patient.id}</span>
          </div>
        </section>

        {/* Section 1: Clinical History & Intake Synthesis (Fully Editable) */}
        <ReviewSection
          title="1. Clinical Observations & History"
          aiSource="Ambient Edge Voice Model • Clinician Editable"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-secondary">
                {isEditingObservations ? 'Editing Clinical Notes' : 'Synthesized Intake Findings'}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingObservations(!isEditingObservations)}
                className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-variant text-primary font-bold text-label-sm flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isEditingObservations ? 'check' : 'edit_note'}
                </span>
                <span>{isEditingObservations ? 'Done Editing' : 'Edit Observations'}</span>
              </button>
            </div>

            {isEditingObservations ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={5}
                  placeholder="Enter or modify patient observation notes, physical findings, and clinician comments..."
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-primary text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-inner leading-relaxed"
                />

                {/* Quick Symptom Injection Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-outline mr-1">Quick Add:</span>
                  {[
                    '+ Severe Retro-orbital pain',
                    '+ High grade fever 101.4°F',
                    '+ Rigors & chills',
                    '+ Moderate dehydration',
                    '+ Cough/dyspnea absent',
                    '+ Platelet count watch',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setObservations((prev) => `${prev.trim()} ${chip.replace('+', '')}.`)}
                      className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary hover:bg-primary-container/20 text-[11px] font-semibold border border-surface-container-high transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-outline pt-1">
                  <span>{observations.length} characters</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingObservations(false)}
                    className="text-primary font-bold hover:underline"
                  >
                    Save &amp; Collapse Editor
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingObservations(true)}
                className="cursor-pointer group p-3 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container transition-colors flex flex-col gap-1.5"
                title="Click to edit observations"
              >
                <p className="text-body-md text-on-surface leading-relaxed whitespace-pre-wrap">
                  {observations}
                </p>
                <div className="flex items-center justify-between text-[11px] text-outline pt-1 border-t border-surface-container">
                  <span className="flex items-center gap-1 text-primary font-semibold group-hover:underline">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    <span>Click anywhere to edit clinical notes</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold text-secondary">Verified Record</span>
                </div>
              </div>
            )}

            <div className="bg-surface-container-low p-2.5 rounded-lg flex items-center justify-between text-[12px] text-on-surface-variant font-mono">
              <span className="truncate">Ambient Voice Audio Synced</span>
              <span className="text-primary font-sans font-bold shrink-0 ml-2">Verified</span>
            </div>
          </div>
        </ReviewSection>

        {/* Section 2: Suspected Diagnosis */}
        <ReviewSection
          title="2. Suspected Diagnosis & Clinical Coding"
          aiSource="Clinical RAG Diagnostic Model"
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-label-sm border border-outline-variant">
                <span className="text-secondary font-mono">R50.9</span>
                <span>Fever, unspecified (Acute febrile illness)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-label-sm border border-outline-variant">
                <span className="text-secondary font-mono">R51.9</span>
                <span>Headache, unspecified (Retro-orbital)</span>
              </span>
            </div>
            <div className="bg-surface-container-low p-2.5 rounded-lg text-body-sm text-on-surface leading-snug">
              <strong>Differential Assessment:</strong> High clinical suspicion for Dengue Fever vs P. vivax Malaria given seasonal endemicity. Rapid diagnostic tests (NS1 Antigen &amp; Malaria RDT) recommended.
            </div>
          </div>
        </ReviewSection>

        {/* Section 3: AI Assistant Prescribing Recommendations */}
        <AIAssistant
          diagnosis="Acute Febrile Illness • Probable Dengue Fever"
          symptoms="High grade fever, rigors, retro-orbital headache"
          patientAge={patient.age || 34}
          patientAllergies={patient.allergies || []}
          currentMedications={medications}
          onConfirmSuggestion={handleConfirmAiSuggestion}
        />

        {/* Section 4: Prescribed Medicines & Drug Allergy Conflict Card */}
        <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">prescriptions</span>
              <h2 className="text-headline-sm text-primary font-bold">4. Prescribed Medicines</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMedForm(!showAddMedForm)}
              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold text-label-sm hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">
                {showAddMedForm ? 'close' : 'add'}
              </span>
              <span>{showAddMedForm ? 'Close' : 'Add Medicine'}</span>
            </button>
          </div>

          {/* Searchable Medicine Autocomplete Input */}
          {showAddMedForm && (
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-primary/30 flex flex-col gap-3 animate-in fade-in duration-150">
              <span className="text-label-sm font-bold text-primary">Search Formulary / Add Medication</span>
              <MedicineAutocomplete
                value={newMedQuery}
                onChange={setNewMedQuery}
                onSelectMedicine={(med) => {
                  setNewMedQuery(`${med.name} ${med.strength} (${med.form})`);
                  setNewMedDosage(med.dosage);
                }}
                patientAllergies={patient.allergies || []}
              />

              <div>
                <label className="text-[12px] font-semibold text-on-surface block mb-1">
                  Dosage &amp; Administration Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1 tablet twice daily after meals for 5 days"
                  value={newMedDosage}
                  onChange={(e) => setNewMedDosage(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMedForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-semibold text-label-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddManualMedication}
                  className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-label-sm shadow-sm"
                >
                  Add to Prescription
                </button>
              </div>
            </div>
          )}

          {/* CRITICAL DRUG CONFLICT ALERT CARD */}
          <DrugConflictCard
            conflictDrug="Amoxicillin 500mg"
            safeAlternative="Azithromycin 500mg"
            onAdoptAlternative={handleAdoptAzithromycin}
          />

          {/* Approved & Active Medications List */}
          <div className="flex flex-col gap-2 pt-1">
            {medications.map((med, idx) => (
              <div
                key={med.id}
                className="bg-surface-container-low rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-surface-container"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-surface-container-high text-primary font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-label-md font-bold text-on-surface">{med.name}</span>
                      {med.source && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-secondary-container text-on-secondary-container">
                          {med.source}
                        </span>
                      )}
                    </div>
                    <span className="text-body-sm text-on-surface-variant truncate">{med.dosage}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 self-end sm:self-center">
                  <button
                    onClick={() => setMedications((prev) => prev.filter((m) => m.id !== med.id))}
                    className="min-h-[38px] px-2.5 text-error hover:opacity-80 font-semibold text-label-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Remove</span>
                  </button>
                  <span className="min-h-[38px] px-2.5 rounded bg-primary-container text-on-primary font-bold text-label-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>Accepted</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: Doctor Verification & Primary Sign-off */}
        <section className="bg-surface-container-low rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer select-none bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/40">
            <input
              type="checkbox"
              checked={doctorVerified}
              onChange={(e) => setDoctorVerified(e.target.checked)}
              className="w-6 h-6 rounded text-primary accent-primary cursor-pointer shrink-0"
            />
            <div className="flex flex-col">
              <span className="text-body-lg text-primary font-bold">Doctor Verification &amp; Licensure Check</span>
              <span className="text-body-sm text-on-surface-variant">
                I ({doctor?.name || 'Dr. Priya Sharma'}) have examined the clinical data, reviewed and authorized these diagnoses and prescriptions under state medical council guidelines.
              </span>
            </div>
          </label>

          <button
            onClick={handleSaveAndApprove}
            disabled={isSaving || saveSuccess}
            className={`w-full min-h-[52px] rounded-xl font-bold text-label-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all ${
              saveSuccess
                ? 'bg-secondary text-on-secondary'
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
          >
            {isSaving ? (
              <>
                <span className="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>
                <span>Saving to Encrypted Local Database...</span>
              </>
            ) : saveSuccess ? (
              <>
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
                <span>Record Approved &amp; Saved (Redirecting...)</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
                <span>Save &amp; Approve Medical Record</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1 text-body-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-secondary">lock</span>
            <span>All modifications are permanently timestamped and cryptographically signed</span>
          </div>
        </section>
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
