import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../ui/StatusBadge';

export default function PatientCard({ patient }) {
  const navigate = useNavigate();

  return (
    <article className="flex flex-col rounded-xl bg-surface-container-lowest p-4 shadow-sm border border-surface-container gap-3">
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
            <h4 className="text-[17px] font-bold text-on-surface truncate">{patient.name}</h4>
            <span className="text-body-sm text-on-surface-variant truncate">
              #{patient.id} â€¢ {patient.age}y â€¢ {patient.gender} â€¢ {patient.ward}
            </span>
          </div>
        </div>
        <StatusBadge status={patient.syncStatus || 'local'} />
      </div>

      <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-lg bg-surface-container-low text-on-surface-variant text-[13px]">
        <div className="flex flex-col">
          <span className="text-[11px] text-outline uppercase font-semibold">Last Visit</span>
          <span className="font-tabular text-[14px] font-semibold text-on-surface">{patient.lastVisit}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-outline uppercase font-semibold">Key Condition</span>
          <span className="font-tabular text-[14px] font-semibold text-on-surface truncate">
            {patient.condition}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          onClick={() => navigate(`/patients/${patient.id}`)}
          className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-surface-container-high text-primary font-bold text-label-md flex items-center gap-1.5 hover:bg-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">folder_shared</span>
          <span>View Patient Record</span>
        </button>
        <span className="text-label-sm text-outline">
          {patient.allergies?.length > 0 ? (
            <span className="text-error font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              Allergy Alert
            </span>
          ) : (
            'No recorded allergies'
          )}
        </span>
      </div>
    </article>
  );
}
