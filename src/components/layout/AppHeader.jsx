import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const LOGO_URL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTCKd8JyE3pMNe-xO7-aHqY4Aa5U3Q8Zktmt4XpsKF4RDzamR0RuX4oHk3Zax-c2o4itGS6gx0-E1nrOj40dE-pMQuK15MSG6CaZvbe_fqFYJf2OezwqgkVI4oYP8b9Myg672GOnuyeChiRYLKTN6LWO1Ww8Ek-inXYgnvjTjd-GPE7_YWmGhKsmdfHnVdR2a59nZyQ1yA_ATqG65Qi8xN_Lxg9yn_IHBp3I-JOphnUwjhM2gXa4k';

export default function AppHeader({ title = 'Swasthya Sync', subtitle, showBack = false, showLock = false, rightContent }) {
  const navigate = useNavigate();
  const { status } = useSync();
  const { doctor, isDoctor, logout } = useAuth();
  const { showToast } = useToast();

  const offlinePillText = status === 'syncing' ? 'Syncing...' :
    status === 'synced' ? 'Synced' :
    status === 'conflict' ? 'Review needed' :
    'Works offline • Saved on device';

  const pillColor = status === 'conflict' ? 'bg-error-container text-on-error-container' :
    status === 'synced' ? 'bg-secondary-container text-on-secondary-fixed' :
    'bg-secondary-container text-on-secondary-fixed';

  return (
    <div className="flex flex-col justify-between bg-surface-container-lowest shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-on-surface bg-surface-container active:scale-95 transition-transform"
              aria-label="Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-sm overflow-hidden p-1">
              <img src={LOGO_URL} alt="Swasthya Sync Logo" className="w-8 h-8 rounded object-contain" />
            </div>
            <div>
              <span className="text-label-sm text-secondary block leading-tight uppercase tracking-wider">CLINICAL SUITE</span>
              <h1 className="text-headline-sm text-primary font-bold tracking-tight">{title}</h1>
              {subtitle && <span className="text-label-sm text-secondary">{subtitle}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doctor && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-[12px] font-semibold text-on-surface">
              <span className={`w-2 h-2 rounded-full ${isDoctor ? 'bg-primary' : 'bg-secondary'}`}></span>
              <span className="truncate max-w-[130px]">{doctor.name}</span>
              <span className="text-[10px] uppercase font-bold text-outline">({doctor.role || 'Staff'})</span>
            </div>
          )}
          {rightContent}
          {showLock && (
            <button
              onClick={() => {
                logout();
                showToast?.('Terminal session locked. Shift ended.', 'info');
                navigate('/login');
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-surface-container transition-colors active:scale-95"
              title="Sign Out / Lock Session"
              aria-label="Lock Session"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          )}
        </div>
      </div>
      {/* Offline Pill */}
      <div className={`px-4 py-1.5 flex items-center gap-2 ${pillColor} border-t border-surface-container`}>
        <span className={`w-2 h-2 rounded-full ${status === 'syncing' ? 'bg-secondary animate-spin' : 'bg-secondary animate-pulse'}`}></span>
        <span className="text-label-md font-semibold">{offlinePillText}</span>
      </div>
    </div>
  );
}
