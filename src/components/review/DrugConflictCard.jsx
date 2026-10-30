import React, { useState } from 'react';

export default function DrugConflictCard({
  conflictDrug = 'Amoxicillin 500mg',
  safeAlternative = 'Azithromycin 500mg',
  onAdoptAlternative,
  onReject,
}) {
  const [resolution, setResolution] = useState(null); // 'rejected' | 'adopted'

  const handleAdopt = () => {
    setResolution('adopted');
    if (onAdoptAlternative) onAdoptAlternative();
  };

  const handleReject = () => {
    setResolution('rejected');
    if (onReject) onReject();
  };

  return (
    <div className="w-full bg-error-container rounded-xl p-4 shadow-sm border-2 border-error flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-error flex items-center justify-center text-on-error shrink-0 shadow-sm">
          <span className="material-symbols-outlined text-[24px]">warning</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-error text-on-error text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider">
              CRITICAL DRUG ALLERGY CONFLICT
            </span>
            <span className="text-label-sm font-mono text-on-error-container">ICD-10 Z88.0</span>
          </div>
          <h3 className="text-headline-sm text-on-error-container font-bold mt-1">
            Contraindicated: {conflictDrug}
          </h3>
          <p className="text-body-sm text-on-error-container mt-1 leading-snug">
            Patient Sunita Devi has a documented history of severe <strong>Penicillin Anaphylaxis</strong> (Emergency presentation 02 Feb 2025). Administration of beta-lactams poses imminent risk of bronchospasm or cardiovascular collapse.
          </p>
        </div>
      </div>

      {resolution === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-error/20">
          <button
            onClick={handleReject}
            className="min-h-[48px] rounded-xl bg-surface-container-lowest text-error border border-error font-bold text-label-md flex items-center justify-center gap-1.5 hover:bg-error-container transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
            <span>Reject {conflictDrug}</span>
          </button>

          <button
            onClick={handleAdopt}
            className="min-h-[48px] rounded-xl bg-tertiary-container text-on-tertiary font-bold text-label-md flex items-center justify-center gap-1.5 hover:bg-tertiary transition-all active:scale-[0.98] shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Adopt Safe Alternative: {safeAlternative}</span>
          </button>
        </div>
      ) : resolution === 'adopted' ? (
        <div className="bg-surface-container-lowest/90 rounded-xl p-3 flex items-center justify-between text-label-md font-bold text-primary border border-secondary">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
            <span>Substituted with safe formulary macrolide: <strong>{safeAlternative}</strong></span>
          </div>
          <button
            onClick={() => setResolution(null)}
            className="text-[12px] text-outline underline hover:text-primary"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest/90 rounded-xl p-3 flex items-center justify-between text-label-md font-bold text-error border border-error">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-[20px]">cancel</span>
            <span>Contraindicated drug {conflictDrug} rejected and removed from prescription.</span>
          </div>
          <button
            onClick={() => setResolution(null)}
            className="text-[12px] text-outline underline hover:text-primary"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
