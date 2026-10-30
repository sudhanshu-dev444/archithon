import React from 'react';

export default function VitalsGrid({ vitals, className = '' }) {
  if (!vitals) return null;

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 ${className}`}>
      {/* BP */}
      <div className="bg-surface-container-low rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-on-surface-variant">
          <span className="text-[11px] font-bold uppercase tracking-wider">Blood Pressure</span>
          <span className="material-symbols-outlined text-[18px] text-primary">speed</span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[20px] font-bold text-on-surface font-tabular">{vitals.bp || '--/--'}</span>
          <span className="text-[11px] text-outline">mmHg</span>
        </div>
        {vitals.bpDelta && (
          <span className="text-[11px] font-semibold text-secondary mt-0.5">
            {vitals.bpDelta.startsWith('+') ? `â–² ${vitals.bpDelta}` : vitals.bpDelta} vs baseline
          </span>
        )}
      </div>

      {/* Pulse / HR */}
      <div className="bg-surface-container-low rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-on-surface-variant">
          <span className="text-[11px] font-bold uppercase tracking-wider">Pulse / HR</span>
          <span className="material-symbols-outlined text-[18px] text-secondary">favorite</span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[20px] font-bold text-on-surface font-tabular">{vitals.pulse || `${vitals.hr} bpm`}</span>
        </div>
        <span className="text-[11px] font-semibold text-secondary mt-0.5">Normal Sinus</span>
      </div>

      {/* Temperature */}
      <div className={`rounded-xl p-3 flex flex-col justify-between ${
        vitals.tempTrend === 'high' ? 'bg-error-container/60 border border-error-container' : 'bg-surface-container-low'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${
            vitals.tempTrend === 'high' ? 'text-error' : 'text-on-surface-variant'
          }`}>
            Body Temp
          </span>
          <span className={`material-symbols-outlined text-[18px] ${
            vitals.tempTrend === 'high' ? 'text-error animate-pulse' : 'text-primary'
          }`}>
            device_thermostat
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={`text-[20px] font-bold font-tabular ${
            vitals.tempTrend === 'high' ? 'text-error' : 'text-on-surface'
          }`}>
            {vitals.temp || '--'}
          </span>
        </div>
        <span className={`text-[11px] font-semibold mt-0.5 ${
          vitals.tempTrend === 'high' ? 'text-error' : 'text-secondary'
        }`}>
          {vitals.tempTrend === 'high' ? 'â–² High Grade Fever' : 'Normal'}
        </span>
      </div>

      {/* SpO2 */}
      <div className="bg-surface-container-low rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-on-surface-variant">
          <span className="text-[11px] font-bold uppercase tracking-wider">Oxygen SpO2</span>
          <span className="material-symbols-outlined text-[18px] text-primary">air</span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[20px] font-bold text-on-surface font-tabular">{vitals.spo2 || '--'}</span>
        </div>
        <span className="text-[11px] font-semibold text-secondary mt-0.5">Room air adequate</span>
      </div>
    </div>
  );
}
