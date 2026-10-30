// src/components/prescription/AIAssistant.jsx
// Offline rule-based AI clinical decision support assistant for prescribing guidance.
// Strictly advisory: clearly labelled, never auto-adds, requires explicit clinician sign-off.

import React from 'react';

export default function AIAssistant({
  diagnosis = '',
  symptoms = '',
  patientAge = 34,
  patientAllergies = [],
  currentMedications = [],
  onConfirmSuggestion,
}) {
  const diagLower = `${diagnosis} ${symptoms}`.toLowerCase();

  // Evaluate Penicillin / Beta-lactam Allergy
  const hasPenicillinAllergy = patientAllergies.some((a) => {
    const text = `${a.name || ''} ${a.reaction || ''} ${JSON.stringify(a.crossReactivity || '')}`.toLowerCase();
    return text.includes('penicillin') || text.includes('amoxicillin') || text.includes('beta-lactam');
  });

  // Deterministic Offline Clinical Reasoning Engine
  const suggestions = [];

  // Rule 1: Acute Febrile Illness / Dengue / Fever
  if (diagLower.includes('fever') || diagLower.includes('febrile') || diagLower.includes('dengue') || diagLower.includes('chills')) {
    suggestions.push({
      id: 'AI-SUGG-PCM',
      drug_name: 'Paracetamol',
      strength: '650mg',
      dosage: '1 tablet 4 times daily (q6h) after meals',
      duration: '3-5 days PRN',
      route: 'Oral',
      rationale: 'First-line antipyretic for acute febrile illness. Safe in dengue, malaria, and pregnancy.',
      warning: diagLower.includes('dengue') ? 'Avoid NSAIDs (Ibuprofen / Aspirin) due to acute bleeding & platelet consumption risk in dengue.' : null,
      allergyConflict: false,
    });

    suggestions.push({
      id: 'AI-SUGG-ORS',
      drug_name: 'Oral Rehydration Salts (ORS)',
      strength: '20.5g WHO formulation',
      dosage: '1 sachet dissolved in 1L clean drinking water',
      duration: 'Sip ad libitum as tolerated',
      route: 'Oral',
      rationale: 'Maintains fluid balance and prevents hypovolemia from diaphoresis and fever.',
      warning: null,
      allergyConflict: false,
    });
  }

  // Rule 2: Bacterial Infection / Presumed Antibiotic Indication
  if (diagLower.includes('infection') || diagLower.includes('bacterial') || diagLower.includes('bronchitis') || diagLower.includes('typhoid') || diagLower.includes('fever')) {
    if (hasPenicillinAllergy) {
      suggestions.push({
        id: 'AI-SUGG-AZI',
        drug_name: 'Azithromycin (Safe Macrolide Alternative)',
        strength: '500mg',
        dosage: '1 tablet once daily (OD) 1 hour before meals',
        duration: '5 days',
        route: 'Oral',
        rationale: 'Recommended alternative for beta-lactam allergic patients. Avoids penicillin cross-reactivity.',
        warning: '⚠️ Patient has documented severe penicillin allergy. Amoxicillin / Ampicillin / Cephalosporins are STRICTLY CONTRAINDICATED.',
        allergyConflict: false,
        isSafeSubstitution: true,
      });
    } else {
      suggestions.push({
        id: 'AI-SUGG-AMOX',
        drug_name: 'Amoxicillin',
        strength: '500mg',
        dosage: '1 capsule 3 times daily (TDS)',
        duration: '5-7 days',
        route: 'Oral',
        rationale: 'Standard broad-spectrum aminopenicillin for uncomplicated community infections.',
        warning: null,
        allergyConflict: false,
      });
    }
  }

  // Rule 3: Suspected Malaria
  if (diagLower.includes('malaria') || diagLower.includes('rigors') || diagLower.includes('rdt+')) {
    suggestions.push({
      id: 'AI-SUGG-ACT',
      drug_name: 'Artemether + Lumefantrine (ACT)',
      strength: '80/480mg',
      dosage: '1 tablet twice daily with milk/fatty meal',
      duration: '3 days',
      route: 'Oral',
      rationale: 'NVBDCP guideline first-line Artemisinin Combination Therapy for chloroquine-resistant P. falciparum.',
      warning: 'Confirm negative pregnancy test in 1st trimester.',
      allergyConflict: false,
    });
  }

  // Rule 4: Hypertension
  if (diagLower.includes('hypertens') || diagLower.includes('bp') || diagLower.includes('blood pressure')) {
    suggestions.push({
      id: 'AI-SUGG-AML',
      drug_name: 'Amlodipine',
      strength: '5mg',
      dosage: '1 tablet once daily in the morning',
      duration: '30 days (Follow-up review)',
      route: 'Oral',
      rationale: 'Long-acting dihydropyridine calcium channel blocker for primary essential hypertension.',
      warning: null,
      allergyConflict: false,
    });
  }

  // Filter out any medications that are already added
  const unprescribedSuggestions = suggestions.filter(
    (s) => !currentMedications.some((m) => m.name?.toLowerCase().includes(s.drug_name.toLowerCase().split(' ')[0]))
  );

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border-2 border-primary/30 flex flex-col gap-3">
      {/* Header with AI Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">psychology</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-headline-sm font-bold text-primary">AI Clinical Prescribing Assistant</h3>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold tracking-wide uppercase">
                Offline Decision Support
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant">
              Context: Age {patientAge}y • {patientAllergies.length > 0 ? 'Documented Allergies Present' : 'No Allergies'}
            </p>
          </div>
        </div>
      </div>

      {/* Mandatory Regulatory / Clinical Disclaimer */}
      <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container text-body-sm text-on-surface flex items-start gap-2.5">
        <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
          verified_user
        </span>
        <p className="text-[12px] leading-relaxed">
          <strong>Mandatory Clinician Notice:</strong> All suggestions below are generated by an offline AI decision support system. They are strictly advisory and <em>never automatically added</em> to the prescription. The final diagnosis, drug selection, and dosage responsibility rests solely with the registered medical officer.
        </p>
      </div>

      {/* Suggestions List */}
      {unprescribedSuggestions.length === 0 ? (
        <div className="p-4 rounded-xl bg-surface-container-low text-center text-on-surface-variant text-body-sm flex flex-col items-center gap-1">
          <span className="material-symbols-outlined text-[24px] text-outline">check_circle</span>
          <p className="font-semibold">All relevant AI recommendations have been reviewed or added.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {unprescribedSuggestions.map((sugg) => (
            <div
              key={sugg.id}
              className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                sugg.isSafeSubstitution
                  ? 'bg-secondary-container/20 border-secondary/40'
                  : 'bg-surface-container-low border-surface-container'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-label-lg font-bold text-on-surface">
                      {sugg.drug_name} {sugg.strength}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-container font-semibold text-primary">
                      {sugg.route}
                    </span>
                    {sugg.isSafeSubstitution && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-secondary text-on-secondary">
                        Safe Non-Beta-Lactam
                      </span>
                    )}
                  </div>
                  <span className="text-body-sm text-secondary font-medium mt-0.5">
                    Suggested Dosage: {sugg.dosage} ({sugg.duration})
                  </span>
                  <p className="text-[12px] text-on-surface-variant mt-1">
                    <strong>Clinical Rationale:</strong> {sugg.rationale}
                  </p>
                </div>

                {/* Confirm and Add Button */}
                <button
                  type="button"
                  onClick={() => onConfirmSuggestion(sugg)}
                  className="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-bold text-label-sm shadow-sm hover:bg-primary-container active:scale-95 transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                >
                  <span className="material-symbols-outlined text-[16px]">add_task</span>
                  <span>Confirm &amp; Add to Rx</span>
                </button>
              </div>

              {/* Warning Callout if present */}
              {sugg.warning && (
                <div className="p-2.5 rounded-lg bg-error-container text-on-error-container text-[12px] flex items-start gap-1.5 font-semibold">
                  <span className="material-symbols-outlined text-error text-[16px] shrink-0 mt-0.5">
                    warning
                  </span>
                  <span>{sugg.warning}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

