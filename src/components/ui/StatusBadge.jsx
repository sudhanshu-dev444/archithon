import React from 'react';

const STATUS_STYLES = {
  offline: { bg: 'bg-[#F1F5F9]', text: 'text-[#334155]', border: 'border-[#64748B]', icon: 'wifi_off', label: 'Offline' },
  local: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', border: 'border-[#E08A00]', icon: 'save', label: 'Saved on device' },
  pending: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', border: 'border-[#E08A00]', icon: 'hourglass_top', label: 'Sync pending' },
  synced: { bg: 'bg-[#DCFCE7]', text: 'text-[#14532D]', border: 'border-[#16A34A]', icon: 'check_circle', label: 'Synced' },
  conflict: { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]', border: 'border-[#E05A47]', icon: 'warning', label: 'Conflict' },
  ready: { bg: 'bg-[#E0F2FE]', text: 'text-[#075985]', border: 'border-[#0F4C5C]', icon: 'cloud_upload', label: 'Ready to send' },
};

export default function StatusBadge({ status = 'local', label, className = '' }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.local;
  const displayLabel = label || s.label;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-label-sm font-semibold ${s.bg} ${s.text} ${s.border} ${className}`}>
      <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
      {displayLabel}
    </span>
  );
}
