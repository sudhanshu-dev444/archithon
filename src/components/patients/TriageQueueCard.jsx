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
    <article className={`flex flex-col rounded-xl bg-surface-container-lowest p-4 shadow-sm gap-3 ${
      isCritical ? 'border-2 border-error/70' : 'border border-surface-container'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {patient.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={patient.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary font-bold text-[18px]">
                {patient.initials || patient.name.slice(0, 2)}
              </div>
            )}
            {isCritical && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-error rounded-full border-2 border-white animate-pulse"></span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-[17px] font-bold text-on-surface truncate">{patient.name}</h4>
              <span className="text-[12px] text-outline font-mono">#{patient.id}</span>
            </div>
            <span className="text-body-sm text-on-surface-variant truncate">
              {patient.age}y â€¢ {patient.gender} â€¢ {patient.condition}
            </span>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 ${badgeStyle}`}>
          {patient.triageLabel || patient.triage}
        </span>
      </div>

      {/* Vitals summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 px-3 rounded-lg bg-surface-container-low text-on-surface-variant text-[13px]">
        <div>
          <span className="text-[11px] text-outline uppercase font-semibold block">Blood Pressure</span>
          <span className="font-tabular text-[14px] font-bold text-on-surface">{patient.vitals?.bp}</span>
        </div>
        <div>
          <span className="text-[11px] text-outline uppercase font-semibold block">Pulse Rate</span>
          <span className="font-tabular text-[14px] font-bold text-on-surface">{patient.vitals?.pulse || `${patient.vitals?.hr} bpm`}</span>
        </div>
        <div>
          <span className="text-[11px] text-outline uppercase font-semibold block">Temperature</span>
          <span className={`font-tabular text-[14px] font-bold ${
            patient.vitals?.tempTrend === 'high' ? 'text-error' : 'text-on-surface'
          }`}>
            {patient.vitals?.temp}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-outline uppercase font-semibold block">Oxygen SpO2</span>
          <span className="font-tabular text-[14px] font-bold text-on-surface">{patient.vitals?.spo2}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          onClick={() => navigate(`/patients/${patient.id}`)}
          className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-surface-container-high text-primary font-bold text-[13px] flex items-center gap-1.5 hover:bg-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">folder_shared</span>
          <span>View Patient Record</span>
        </button>

        <button
          onClick={() => navigate(`/patients/${patient.id}/intake`)}
          className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-[13px] flex items-center gap-1.5 hover:bg-primary-container transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add_notes</span>
          <span>Start Intake</span>
        </button>
      </div>
    </article>
  );
}
