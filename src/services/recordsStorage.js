// src/services/recordsStorage.js
// Offline-first storage and synchronization for Clinical Records (Encounters & Prescriptions).
// Persists all signed clinical reviews, prescriptions, and notes in localStorage and pushes to SQLite backend.

import { api } from './api';

const CLINICAL_RECORDS_KEY = 'swasthya_clinical_records_vault';

export function getLocalRecords() {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(CLINICAL_RECORDS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading local clinical records:', err);
  }
  return [];
}

export function saveLocalRecord(record) {
  try {
    const records = getLocalRecords();
    const updated = [record, ...records.filter((r) => r.id !== record.id)];
    localStorage.setItem(CLINICAL_RECORDS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('swasthya_records_updated', { detail: { record } }));
    }
    return record;
  } catch (err) {
    console.warn('Error saving clinical record locally:', err);
    return record;
  }
}

export function saveLocalRecordsBatch(newRecords) {
  try {
    const existing = getLocalRecords();
    const map = new Map();
    // Add existing
    existing.forEach((r) => map.set(r.id, r));
    // Add new (overwriting matching IDs)
    newRecords.forEach((r) => map.set(r.id, r));
    const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
    localStorage.setItem(CLINICAL_RECORDS_KEY, JSON.stringify(merged));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('swasthya_records_updated', { detail: { records: newRecords } }));
    }
    return merged;
  } catch (err) {
    console.warn('Error batch saving clinical records:', err);
    return [];
  }
}

/**
 * Persists an encounter and all its medications to local vault and pushes to backend.
 */
export async function persistEncounterWithPrescriptions({
  patient,
  encounterId,
  observations,
  diagnosis = 'Acute Febrile Illness • Probable Dengue Fever (ICD-10: A90)',
  icd10 = 'A90',
  medications = [],
  doctor,
}) {
  const now = Date.now();
  const doctorId = doctor?.doctor_id || doctor?.name || 'DOC-001';
  const doctorName = doctor?.name || (doctorId === 'DOC-001' ? 'Dr. Priya Sharma' : doctorId);
  const encId = encounterId || `ENC-${patient.id}-${now}`;

  // 1. Create Encounter record
  const encounterRecord = {
    id: encId,
    record_type: 'notes',
    patient_id: patient.id,
    patient_name: patient.name,
    doctor_id: doctorId,
    doctor_name: doctorName,
    status: 'approved',
    title: `${diagnosis} — ${observations.slice(0, 80)}...`,
    complaint: observations.slice(0, 200),
    history: observations,
    diagnosis,
    icd10_code: icd10,
    vitals: patient.vitals,
    timestamp: now,
    medications: medications.map((m) => ({
      name: m.name,
      dosage: m.dosage || 'Standard Dose',
      duration: m.duration || '3-5 days',
      frequency: m.frequency || 'TDS',
    })),
  };

  // 2. Create individual Prescription records
  const prescriptionRecords = medications.map((med, index) => {
    const rxId = `RX-${patient.id}-${now}-${index + 1}-${Math.random().toString(36).substring(2, 6)}`;
    return {
      id: rxId,
      record_type: 'prescription',
      encounter_id: encId,
      patient_id: patient.id,
      patient_name: patient.name,
      doctor_id: doctorId,
      doctor_name: doctorName,
      status: 'active',
      drug_name: med.name,
      dosage: med.dosage || 'Standard Dose',
      frequency: med.frequency || 'TDS',
      duration: med.duration || '3-5 days',
      route: med.route || 'Oral',
      title: `${med.name} (${med.dosage || 'Standard Dose'})`,
      timestamp: now + index * 5, // ensure distinct millisecond ordering
    };
  });

  // 3. Immediately save both to local persistent storage vault
  saveLocalRecordsBatch([encounterRecord, ...prescriptionRecords]);

  // 4. Send to backend SQLite asynchronously
  try {
    const encRes = await api.createEncounter(patient.id, {
      encounter_id: encId,
      complaint: observations.slice(0, 200),
      history: observations,
      diagnosis,
      icd10_code: icd10,
      vitals: patient.vitals,
      status: 'approved',
      recorded_by: doctorId,
      recorded_by_role: doctor?.role || 'Doctor',
    });

    const finalEncId = encRes?.encounter_id || encId;

    for (const rx of prescriptionRecords) {
      await api.createPrescription(patient.id, finalEncId, {
        prescription_id: rx.id,
        drug_name: rx.drug_name,
        dosage: rx.dosage,
        frequency: rx.frequency,
        duration: rx.duration,
        route: rx.route,
        confidence: 0.98,
      }).catch((e) => console.warn('Backend prescription push deferred:', e.message));
    }
  } catch (err) {
    console.warn('Encounter saved locally (will sync on connection):', err.message);
  }

  return { encounter: encounterRecord, prescriptions: prescriptionRecords };
}

/**
 * Retrieves all unified records for a patient or system-wide.
 */
export async function getUnifiedClinicalRecords(patientId = null) {
  const local = getLocalRecords();
  let server = [];

  try {
    const res = await api.getClinicalRecords();
    if (res?.records) {
      server = res.records;
    }
  } catch {
    // backend offline fallback
  }

  // Merge and deduplicate by ID
  const map = new Map();
  server.forEach((r) => map.set(r.id, r));
  local.forEach((r) => {
    // local version has latest client timestamps
    map.set(r.id, { ...(map.get(r.id) || {}), ...r });
  });

  let all = Array.from(map.values());
  if (patientId) {
    all = all.filter((r) => r.patient_id === patientId);
  }

  return all.sort((a, b) => b.timestamp - a.timestamp);
}

