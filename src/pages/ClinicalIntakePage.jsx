import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatients } from '../context/PatientContext';
import AppHeader from '../components/layout/AppHeader';
import AllergyBanner from '../components/layout/AllergyBanner';
import BottomNav from '../components/layout/BottomNav';
import VoiceRecorder from '../components/intake/VoiceRecorder';
import DrugConflictCard from '../components/review/DrugConflictCard';

export default function ClinicalIntakePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPatientById } = usePatients();

  const patient = getPatientById(id) || {
    id: id || 'PAT-8812',
    name: 'Sunita Devi',
    age: 34,
    gender: 'Female',
    abha: '91-4421-9982-1102',
    ward: 'Ward 4, Ganiyari',
    condition: 'Acute Febrile Illness',
    allergies: [
      {
        id: 'alg-1',
        name: 'Penicillin / Amoxicillin',
        severity: 'Severe Anaphylaxis Risk',
      },
    ],
  };

  const [consentGranted, setConsentGranted] = useState(true);
  const [manualNotes, setManualNotes] = useState(
    'Patient visibly febrile, flushed, sweating. Reports retro-orbital headache and chills for 3 days. No cough or shortness of breath. Hydration moderate.'
  );
  const [ocrDetected, setOcrDetected] = useState(true);
  const [ocrAlternativeAdopted, setOcrAlternativeAdopted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
        setOcrDetected(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSynthesize = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setDraftReady(true);
      navigate(`/patients/${patient.id}/review`);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm">
        <AppHeader
          title="Clinical Intake"
          subtitle="Multimodal Offline AI Intake"
          showBack={true}
          showLock={true}
        />
        {patient.allergies?.length > 0 && (
          <AllergyBanner patient={patient} riskLevel="High Risk" />
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-28 px-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Patient Identity Banner */}
        <section className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-[16px]">
              {patient.name.slice(0, 2)}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-label-lg font-bold text-on-surface">{patient.name}</span>
                <span className="text-body-sm text-outline">({patient.age}F)</span>
              </div>
              <span className="text-[12px] text-secondary font-mono">
                ABHA: {patient.abha} â€¢ #{patient.id}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/patients')}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-label-sm hover:bg-surface-variant transition-colors"
          >
            Switch Patient
          </button>
        </section>

        {/* Informed Consent Toggle */}
        <div className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between border border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
            <div className="flex flex-col">
              <span className="text-label-md font-bold text-on-surface">Offline Patient Consent Protocol</span>
              <span className="text-[11px] text-on-surface-variant">
                Ambient audio recorded and processed locally on device only (DPDP Act compliant)
              </span>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={consentGranted}
              onChange={(e) => setConsentGranted(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Section 1: Ambient Clinical Dictation Voice Recorder */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">mic</span>
              <h2 className="text-headline-sm text-on-surface font-bold">
                1. Ambient Clinical Dictation
              </h2>
            </div>
            <span className="text-[11px] font-bold text-secondary bg-surface-container px-2 py-0.5 rounded">
              Hindi + English Auto-Detect
            </span>
          </div>

          <VoiceRecorder onDraftReady={() => setDraftReady(true)} />
        </section>

        {/* Section 2: Prescription / Lab Slip OCR Scanner */}
        <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">document_scanner</span>
              <h2 className="text-headline-sm text-on-surface font-bold">
                2. Document & Rx Slip OCR Scanner
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-bold">
              Edge OCR (Tesseract Offline)
            </span>
          </div>

          {ocrDetected && (
            <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-2 border border-surface-container">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary font-bold">
                    <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-label-md font-bold text-on-surface">Scanned Paper Prescription Slip</span>
                    <span className="text-[12px] text-outline">District Referral Sub-Center â€¢ Scanned 2m ago</span>
                  </div>
                </div>
                <button
                  onClick={() => setOcrDetected(false)}
                  className="text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {uploadedImage && (
                <div className="rounded-lg overflow-hidden border border-surface-container max-h-48 flex justify-center bg-black/5">
                  <img src={uploadedImage} alt="Prescription Scan" className="object-contain max-h-48 w-full" />
                </div>
              )}

              {/* Detected Text Preview */}
              <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant/40 text-[13px] font-mono text-on-surface">
                <span className="text-[10px] text-secondary font-bold uppercase block mb-1">OCR Extracted Text:</span>
                "Rx: Tab Amoxicillin 500mg TID x 5d; Tab Paracetamol 650mg QDS x 3d"
              </div>

              {/* CRITICAL DRUG CONFLICT ALERT IN INTAKE */}
              <DrugConflictCard
                conflictDrug="Amoxicillin 500mg"
                safeAlternative="Azithromycin 500mg"
                onAdoptAlternative={() => setOcrAlternativeAdopted(true)}
                onReject={() => setOcrAlternativeAdopted(false)}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOcrDetected(true)}
              className="flex-1 min-h-[48px] rounded-xl bg-surface-container-high text-primary font-bold text-label-md flex items-center justify-center gap-2 hover:bg-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              <span>Capture Prescription Slip</span>
            </button>
            <label className="min-h-[48px] px-4 rounded-xl bg-surface-container text-on-surface font-semibold text-label-md flex items-center justify-center gap-1.5 hover:bg-surface-variant transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">upload_file</span>
              <span>Upload Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </section>

        {/* Section 3: Manual Clinical Observations */}
        <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">edit_note</span>
              <h2 className="text-headline-sm text-on-surface font-bold">
                3. Manual Observations & Quick Notes
              </h2>
            </div>
            <span className="text-[11px] text-outline">Optional</span>
          </div>

          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            rows={3}
            placeholder="Type or dictate additional clinical findings, examination notes, or specific instructions..."
            className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
          />
        </section>

        {/* Bottom CTA Bar */}
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={handleSynthesize}
            disabled={isProcessing}
            className="w-full min-h-[52px] rounded-xl bg-primary text-on-primary font-bold text-label-lg flex items-center justify-center gap-2 hover:bg-primary-container shadow-md active:scale-[0.99] transition-all disabled:opacity-75"
          >
            {isProcessing ? (
              <>
                <span className="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>
                <span>Compiling Structured Clinical Case File...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[22px]">rate_review</span>
                <span>Proceed to Clinician Review & Verification</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-body-sm text-outline">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>All AI suggestions require explicit doctor sign-off before saving</span>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
