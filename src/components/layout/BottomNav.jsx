import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSync } from '../../context/SyncContext';

const navItems = [
  { to: '/patients', icon: 'people', label: 'Patients' },
  { to: '/sync', icon: 'receipt_long', label: 'Records', hasBadge: true },
  { to: '/reports', icon: 'bar_chart', label: 'Reports' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

export default function BottomNav() {
  const { conflictCount } = useSync();

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-20 px-2 bg-surface-container-lowest border-t border-surface-container">
        {navItems.map(({ to, icon, label, hasBadge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[48px] min-h-[48px] w-16 h-16 gap-1 transition-all ${
                isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[24px]">{icon}</span>
              {hasBadge && conflictCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1.5 py-0.5 bg-[#660200] text-white text-[10px] rounded-full min-w-[16px] text-center leading-tight font-bold">
                  {conflictCount}
                </span>
              )}
            </div>
            <span className="text-label-sm tracking-tight text-center leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
