import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../ui/StatusBadge';

export default function PatientCard({ patient }) {
  const navigate = useNavigate();

  const triageBadgeStyles = {
    critical: 'bg-error text-on-error',
    urgent: 'bg-[#ffdad4] text-[#881a0f]',
    routine: 'bg-secondary-container text-on-secondary-container',
  };

  return (
    <article className="flex flex-col rounded-xl bg-surface-container-lowest p-4 shadow-sm border border-surface-container hover:border-primary/40 transition-all gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {patient.photoUrl ? (
            <img
              src={patient.photoUrl}
              alt={patient.name}
              className="w-12 h-12 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary font-bold text-[18px] shrink-0">
              {patient.initials || patient.name.slice(0, 2)}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-[17px] font-bold text-on-surface truncate">{patient.name}</h4>
              {patient.triage && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  triageBadgeStyles[patient.triage] || triageBadgeStyles.routine
                }`}>
                  {patient.triage}
                </span>
              )}
            </div>
            <span className="text-body-sm text-on-surface-variant truncate">
              #{patient.id} • {patient.age}y • {patient.gender || patient.sex} • {patient.ward || patient.village}
            </span>
          </div>
        </div>
        <StatusBadge status={patient.syncStatus || 'synced'} />
      </div>

      <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-lg bg-surface-container-low text-on-surface-variant text-[13px]">
        <div className="flex flex-col">
          <span className="text-[11px] text-outline uppercase font-semibold">Last Visit</span>
          <span className="font-tabular text-[13px] font-semibold text-on-surface">{patient.lastVisit || 'Today'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-outline uppercase font-semibold">Chief Presentation</span>
          <span className="font-tabular text-[13px] font-semibold text-on-surface truncate">
            {patient.condition || 'Consultation'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/patients/${patient.id}`)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-label-sm flex items-center gap-1.5 hover:bg-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">folder_shared</span>
            <span>Record</span>
          </button>
          <button
            onClick={() => navigate(`/patients/${patient.id}/intake`)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-label-sm flex items-center gap-1.5 hover:bg-primary-container transition-colors shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[17px]">mic</span>
            <span>Intake</span>
          </button>
        </div>

        <span className="text-label-sm text-outline">
          {patient.allergies?.length > 0 ? (
            <span className="text-error font-semibold flex items-center gap-1 bg-error-container/40 px-2 py-0.5 rounded-full text-[11px]">
              <span className="material-symbols-outlined text-[13px]">warning</span>
              Allergy Alert
            </span>
          ) : (
            <span className="text-[11px] text-outline">No allergy flags</span>
          )}
        </span>
      </div>
    </article>
  );
}
