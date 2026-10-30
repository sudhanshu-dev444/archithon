import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TriageQueueCard({ patient, isCritical = false }) {
  const navigate = useNavigate();

  const triageBadgeStyles = {
    critical: 'bg-error text-on-error',
    urgent: 'bg-[#ffdad4] text-[#881a0f]',
    routine: 'bg-secondary-container text-on-secondary-fixed',
  };

  const badgeStyle = triageBadgeStyles[patient.triage] || triageBadgeStyles.routine;

  return (
    <article className={`flex flex-col rounded-xl bg-surface-container-lowest p-3.5 shadow-sm gap-2.5 ${
      isCritical ? 'border-2 border-error/70' : 'border border-surface-container'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {patient.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={patient.name}
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary font-bold text-[16px]">
                {patient.initials || patient.name.slice(0, 2)}
              </div>
            )}
            {isCritical && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-error rounded-full border-2 border-white animate-pulse"></span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-[15px] font-bold text-on-surface truncate">{patient.name}</h4>
              <span className="text-[11px] text-outline font-mono">#{patient.id}</span>
            </div>
            <span className="text-[12px] text-on-surface-variant truncate">
              {patient.age}y • {patient.gender || patient.sex} • {patient.condition}
            </span>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${badgeStyle}`}>
          {patient.triageLabel || patient.triage}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-container/60">
        <span className="text-[12px] font-mono text-outline">
          BP: {patient.vitals?.bp || '120/80'} • SpO2: {patient.vitals?.spo2 || '98%'}
        </span>
        <button
          onClick={() => navigate(`/patients/${patient.id}/intake`)}
          className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-bold text-[12px] flex items-center gap-1 hover:bg-primary-container transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[15px]">add_notes</span>
          <span>Intake</span>
        </button>
      </div>
    </article>
  );
}
