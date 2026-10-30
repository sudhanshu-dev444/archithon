// db/seed.js
// Seeds the database with initial demo data.

import { getDb } from './schema.js';
import { createHash } from 'crypto';

const DOCTOR_ID = 'DOC-001';
const DEVICE_ID = 'DEVICE-GANIYARI-ALPHA';
const NOW = Date.now();

export function seedDatabase() {
  const db = getDb();

  // ── Device ──────────────────────────────────────────────────
  const existingDevice = db.prepare('SELECT device_id FROM devices WHERE device_id = ?').get(DEVICE_ID);
  if (!existingDevice) {
    db.prepare('INSERT INTO devices (device_id, station_name, registered_at) VALUES (?, ?, ?)')
      .run(DEVICE_ID, 'Tablet Node Alpha (Bedside Triage)', NOW);
  }

  // ── Demo doctor ──────────────────────────────────────────────
  const existingDoctor = db.prepare('SELECT doctor_id FROM doctors WHERE doctor_id = ?').get(DOCTOR_ID);
  if (!existingDoctor) {
    const pin  = createHash('sha256').update('123456').digest('hex');
    const pass = createHash('sha256').update('demo1234').digest('hex');
    db.prepare(`
      INSERT INTO doctors (doctor_id, name, email, role, pin_hash, passphrase_hash, council_number, specialty, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(DOCTOR_ID, 'Dr. Priya Sharma', 'priya.sharma@ganiyari.in', 'clinician', pin, pass, 'MCI-CG-44821', 'General Medicine', NOW);
  }

  // ── Patients ─────────────────────────────────────────────────
  const patients = [
    {
      id: 'PAT-8812', abha: '91-4421-9982-1102', name: 'Sunita Devi',
      age: 34, sex: 'Female', village: 'Ganiyari Outpost Hub', ward: 'Ward 4, Ganiyari',
      phone: '+91 98271 44021', condition: 'Acute Febrile Illness • Suspected Malaria / Dengue',
      triage: 'critical',
      summary: '34F presenting with 3 days acute high-grade fever, chills, severe retro-orbital headache. Suspected Dengue / Malaria. Known severe penicillin anaphylaxis.',
      allergies: [{
        id: 'ALG-8812-1', name: 'Penicillin / Amoxicillin', severity: 'Severe Anaphylaxis Risk',
        reaction: 'Bronchospasm, Facial Edema, Anaphylaxis',
        cross: JSON.stringify(['Amoxicillin', 'Ampicillin', 'Augmentin', 'Piperacillin']),
      }],
    },
    {
      id: 'PAT-7741', abha: '44-8821-3312-9984', name: 'Rajesh Verma',
      age: 48, sex: 'Male', village: 'Bilaspur Cluster', ward: 'Sector 2, Bilaspur Road',
      phone: '+91 94252 88120', condition: 'Hypertensive Crisis • Chest Discomfort',
      triage: 'urgent',
      summary: '48M hypertensive crisis BP 164/102. Chest discomfort. On Amlodipine & Telmisartan.',
      allergies: [],
    },
    {
      id: 'PAT-4431', abha: '77-2210-5541-6623', name: 'Geeta Bai',
      age: 62, sex: 'Female', village: 'Takhatpur PHC', ward: 'Ward 1, Takhatpur',
      phone: '+91 87654 32109', condition: 'Type 2 Diabetes • Peripheral Neuropathy',
      triage: 'routine',
      summary: '62F diabetic follow-up. Fasting 178 mg/dL. Foot examination - mild neuropathy.',
      allergies: [],
    },
  ];

  const insertPatient = db.prepare(`
    INSERT OR IGNORE INTO patients (patient_id, abha, name, age, sex, village, ward, phone, condition, triage, summary, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `);
  const insertAllergy = db.prepare(`
    INSERT OR IGNORE INTO allergies (allergy_id, patient_id, name, severity, reaction, cross_reactivity, recorded_by, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of patients) {
    insertPatient.run(p.id, p.abha, p.name, p.age, p.sex, p.village, p.ward, p.phone, p.condition, p.triage, p.summary, NOW, NOW);
    for (const a of p.allergies) {
      insertAllergy.run(a.id, p.id, a.name, a.severity, a.reaction, a.cross, DOCTOR_ID, NOW);
    }
  }

  // ── Demo encounter for PAT-8812 ───────────────────────────────
  const existingEnc = db.prepare('SELECT encounter_id FROM encounters WHERE encounter_id = ?').get('ENC-9921');
  if (!existingEnc) {
    db.prepare(`
      INSERT INTO encounters (encounter_id, patient_id, doctor_id, device_id, encounter_ts, complaint, history, diagnosis, icd10_code, vitals, status, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      'ENC-9921', 'PAT-8812', DOCTOR_ID, DEVICE_ID, NOW - 3600000,
      'Acute high-grade fever, chills, severe retro-orbital headache for 3 days',
      'No prior similar episodes. Seasonal onset. No cough or breathlessness.',
      'Acute Febrile Illness - Probable Dengue Fever', 'A90',
      JSON.stringify({ bp: '128/82', hr: 88, temp: '101.4°F', spo2: '98%', rr: '18 /min' }),
      'approved', NOW, NOW
    );
    db.prepare(`INSERT INTO prescriptions (prescription_id, encounter_id, patient_id, drug_name, dosage, frequency, duration, confirmed, source_snippet, confidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0.96, 'active', ?)`)
      .run('RX-001', 'ENC-9921', 'PAT-8812', 'Paracetamol Tablets 650 mg', '1 tablet', '4 times daily', '3 days', 'Dictation: paracetamol 650 four times', NOW);
    db.prepare(`INSERT INTO prescriptions (prescription_id, encounter_id, patient_id, drug_name, dosage, frequency, duration, confirmed, source_snippet, confidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0.91, 'active', ?)`)
      .run('RX-002', 'ENC-9921', 'PAT-8812', 'ORS (Oral Rehydration Salts)', '1 sachet in 1L water', 'ad libitum', '3 days', 'Dictation: ORS ad lib', NOW);
  }

  // ── Demo open conflict ────────────────────────────────────────
  const existingConflict = db.prepare('SELECT conflict_id FROM conflicts WHERE conflict_id = ?').get('CONF-001');
  if (!existingConflict) {
    db.prepare(`
      INSERT INTO conflicts (conflict_id, patient_id, entity_type, entity_id, field_path, op_a_id, op_b_id, version_a, version_b, value_enc_a, value_enc_b, base_value_enc, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(
      'CONF-001', 'PAT-8812', 'encounter', 'ENC-9921', 'prescriptions',
      'OP-CLINIC-001', 'OP-HOSPITAL-001', 1, 1,
      JSON.stringify({ prescriptions: ['Paracetamol 650mg QDS', 'Azithromycin 500mg OD x3d'], reason: 'Suspected bacterial bronchitis' }),
      JSON.stringify({ prescriptions: ['Paracetamol 650mg TID', 'Cetirizine 10mg nightly'], reason: 'Allergic rhinorrhea & fever' }),
      JSON.stringify({ prescriptions: ['Paracetamol 650mg TID'], reason: 'Acute febrile illness' }),
      NOW
    );
  }

  console.log('✅ Database seeded with demo data');
}
