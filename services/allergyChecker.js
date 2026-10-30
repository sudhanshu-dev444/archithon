// services/allergyChecker.js
// Checks a list of drug names against a patient's known allergies.
// Returns any conflicts found.

import { getDb } from '../db/schema.js';

// Common cross-reactivity mappings (extend with a real formulary)
const CROSS_REACTIVITY = {
  'Penicillin': ['Amoxicillin', 'Ampicillin', 'Augmentin', 'Piperacillin', 'Amoxicillin-Clavulanate'],
  'Sulfonamide': ['Co-trimoxazole', 'Trimethoprim-Sulfamethoxazole'],
  'NSAIDs': ['Aspirin', 'Ibuprofen', 'Diclofenac', 'Naproxen'],
};

/**
 * Checks drugs against a patient's allergy list.
 * @param {string} patientId
 * @param {string[]} drugNames - list of drug names to check
 * @returns {Array} - list of conflicts { drug, allergy, severity }
 */
export function checkAllergies(patientId, drugNames) {
  const db = getDb();
  const allergies = db.prepare('SELECT * FROM allergies WHERE patient_id = ?').all(patientId);

  const conflicts = [];
  for (const drug of drugNames) {
    const drugUpper = drug.toUpperCase();
    for (const allergy of allergies) {
      const allergyName = allergy.name.toUpperCase();
      // Direct match
      if (drugUpper.includes(allergyName) || allergyName.includes(drugUpper)) {
        conflicts.push({ drug, allergy: allergy.name, severity: allergy.severity, type: 'direct' });
        continue;
      }
      // Cross-reactivity check
      let crossList = [];
      try {
        crossList = JSON.parse(allergy.cross_reactivity || '[]');
      } catch { /* */ }
      for (const [group, members] of Object.entries(CROSS_REACTIVITY)) {
        if (members.some(m => allergyName.includes(m.toUpperCase()))) {
          if (members.some(m => drugUpper.includes(m.toUpperCase()))) {
            conflicts.push({ drug, allergy: allergy.name, severity: allergy.severity, type: 'cross-reactive', group });
          }
        }
      }
      // Explicit cross-reactivity from the allergy record
      for (const crossDrug of crossList) {
        if (drugUpper.includes(crossDrug.toUpperCase())) {
          conflicts.push({ drug, allergy: allergy.name, severity: allergy.severity, type: 'cross-reactive' });
        }
      }
    }
  }

  return conflicts;
}

