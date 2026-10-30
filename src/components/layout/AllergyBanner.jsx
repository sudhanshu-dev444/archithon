import React from 'react';

export default function AllergyBanner({ patient, riskLevel = 'High Risk' }) {
  if (!patient?.allergies?.length) return null;

  const riskColors = {
    'High Risk': { banner: 'bg-[#660200] text-white', badge: 'bg-white/20 text-white' },
    'Active Guard': { banner: 'bg-error-container text-on-error-container', badge: 'bg-[#881a0f] text-white' },
    'Lethal Risk': { banner: 'bg-error text-on-primary', badge: 'bg-error-container text-on-error-container' },
    'Blocked in Sync': { banner: 'bg-error-container text-on-error-container', badge: 'bg-surface-container-lowest text-error' },
  };

  const colors = riskColors[riskLevel] || riskColors['High Risk'];
  const allergyText = patient.allergies.map(a => a.name).join(' / ');

  return (
    <div className={`w-full ${colors.banner} px-4 py-1.5 flex items-center justify-between text-label-sm font-bold shadow-sm`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="material-symbols-outlined text-[16px] animate-pulse shrink-0">warning</span>
        <span className="truncate">
          ALLERGY ALERT: Severe {allergyText} Anaphylaxis Risk (Cross-checked offline)
        </span>
      </div>
      <span className={`${colors.badge} px-2 py-0.5 rounded text-[11px] font-mono uppercase shrink-0 ml-2`}>
        {riskLevel}
      </span>
    </div>
  );
}
