import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LOGO_URL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTCKd8JyE3pMNe-xO7-aHqY4Aa5U3Q8Zktmt4XpsKF4RDzamR0RuX4oHk3Zax-c2o4itGS6gx0-E1nrOj40dE-pMQuK15MSG6CaZvbe_fqFYJf2OezwqgkVI4oYP8b9Myg672GOnuyeChiRYLKTN6LWO1Ww8Ek-inXYgnvjTjd-GPE7_YWmGhKsmdfHnVdR2a59nZyQ1yA_ATqG65Qi8xN_Lxg9yn_IHBp3I-JOphnUwjhM2gXa4k';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('doctor');
  const [doctorId, setDoctorId] = useState('doc.jenkins@ruralhealth.org');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { dispatch } = useAuth();

  const handleLogin = () => {
    const newErrors = {};
    if (!doctorId) newErrors.doctorId = 'Doctor ID is required';
    if (!password) newErrors.password = 'Password is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setIsLoading(true);
    setTimeout(() => {
      dispatch({ type: 'LOGIN', payload: { name: 'Dr. Sarah Jenkins', role: 'Attending Field Physician', license: 'MCI-2018-847291' } });
      setIsLoading(false);
      navigate('/patients');
    }, 1200);
  };

  const handlePinDigit = (digit) => {
    const newPin = [...pin];
    const emptyIdx = newPin.findIndex(d => d === '');
    if (emptyIdx === -1) return;
    newPin[emptyIdx] = digit;
    setPin(newPin);
    if (newPin.every(d => d !== '')) {
      setTimeout(() => {
        dispatch({ type: 'LOGIN_PIN' });
        navigate('/patients');
      }, 400);
    }
  };

  const handlePinBackspace = () => {
    const newPin = [...pin];
    const lastFilledIdx = newPin.map((d, i) => d !== '' ? i : -1).filter(i => i !== -1).pop();
    if (lastFilledIdx !== undefined) {
      newPin[lastFilledIdx] = '';
      setPin(newPin);
    }
  };

  const handleEmergencyBypass = () => {
    if (window.confirm('Activate Emergency Triage Bypass?\n\nThis will be logged for audit. An authorized clinician must review all anonymous entries.')) {
      dispatch({ type: 'EMERGENCY_BYPASS' });
      navigate('/patients/PAT-8812/intake');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top Info Strip */}
      <div className="bg-surface-container-high px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-on-surface">
          <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>cloud_sync</span>
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Encrypted SQLite DB v4.12</span>
        </div>
        <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-0.5 rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="text-label-sm text-secondary font-semibold">AES-256 Encrypted</span>
        </div>
      </div>

      {/* App Bar */}
      <header className="bg-surface-container-lowest px-4 py-4 shadow-sm flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-md overflow-hidden p-1">
              <img src={LOGO_URL} alt="Swasthya Sync Logo" className="w-8 h-8 rounded object-contain" />
            </div>
            <div>
              <span className="text-label-sm text-secondary block leading-tight uppercase tracking-wider">CLINICAL SUITE</span>
              <h1 className="text-headline-sm text-primary font-bold tracking-tight">Swasthya Sync</h1>
            </div>
          </div>
          <div className="flex items-center bg-surface-container px-3 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-primary text-[18px] mr-1.5" style={{ fontVariationSettings: '"FILL" 1' }}>verified_user</span>
            <span className="text-label-sm text-primary uppercase">AES-256</span>
          </div>
        </div>
        <div className="flex items-center justify-between bg-surface-container-low px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">wifi_off</span>
            <span className="text-label-md text-on-surface">Works Offline • Local PIN Ready</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">lock</span>
        </div>
      </header>

      {/* Station Info */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-primary text-[20px]">domain</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-label-sm uppercase bg-primary-fixed text-on-primary-fixed px-1.5 py-0.5 rounded">Station 04</span>
              <span className="text-body-sm text-on-surface-variant font-medium truncate">Ganiyari Outpost Hub</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-secondary text-[16px]">folder_shared</span>
              <p className="text-label-md text-on-surface font-semibold">248 Patients Locally Cached • Ready</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-3 flex flex-col gap-4 flex-1">
        {/* Tab Switcher */}
        <div className="bg-surface-container p-1 rounded-xl flex items-center" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'doctor'}
            onClick={() => setActiveTab('doctor')}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-label-lg font-semibold ${
              activeTab === 'doctor'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'bg-transparent text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">stethoscope</span>
            <span>Doctor Login</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'pin'}
            onClick={() => setActiveTab('pin')}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-label-lg font-semibold ${
              activeTab === 'pin'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'bg-transparent text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">pin</span>
            <span>Quick PIN</span>
          </button>
        </div>

        {/* Doctor Login Form */}
        {activeTab === 'doctor' && (
          <div className="flex flex-col gap-4">
            {/* Terminal Assignment */}
            <div className="bg-surface-container-lowest p-3 rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-secondary text-[20px]">laptop_chromebook</span>
                <div className="truncate">
                  <span className="text-label-sm text-on-surface-variant block">TERMINAL ASSIGNMENT</span>
                  <span className="text-body-md font-semibold text-on-surface truncate">Tablet Node Alpha (Bedside Triage)</span>
                </div>
              </div>
              <button className="bg-surface-container px-2.5 py-1.5 rounded-lg text-primary text-label-sm flex items-center gap-0.5 h-[36px]">
                <span>SWITCH</span>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>

            {/* Credentials */}
            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-4">
              {/* Doctor ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-on-surface font-semibold flex items-center justify-between" htmlFor="doctor-id">
                  <span>Doctor ID / Medical Reg. No.</span>
                  <span className="text-label-sm text-secondary font-normal">State Registry Sync</span>
                </label>
                <div className={`flex items-center h-[52px] rounded-xl transition-all ${errors.doctorId ? 'ring-2 ring-error bg-error-container/20' : 'bg-surface-container-low'}`}>
                  <div className="pl-3.5 flex items-center pointer-events-none text-secondary">
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                  <input
                    id="doctor-id"
                    type="text"
                    value={doctorId}
                    onChange={e => { setDoctorId(e.target.value); setErrors(p => ({ ...p, doctorId: '' })); }}
                    placeholder="e.g. MCI-2018-99410"
                    className="flex-1 h-full px-3.5 bg-transparent text-on-surface text-body-md focus:outline-none placeholder:text-outline"
                  />
                </div>
                {errors.doctorId && <p className="text-label-sm text-error">{errors.doctorId}</p>}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-label-md text-on-surface font-semibold" htmlFor="password">Local Vault Password</label>
                  <button className="text-label-sm text-primary hover:underline" type="button">Forgot Key?</button>
                </div>
                <div className={`flex items-center h-[52px] rounded-xl transition-all ${errors.password ? 'ring-2 ring-error bg-error-container/20' : 'bg-surface-container-low'}`}>
                  <div className="pl-3.5 flex items-center pointer-events-none text-secondary">
                    <span className="material-symbols-outlined text-[20px]">password</span>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                    placeholder="Enter cryptographic key"
                    className="flex-1 h-full px-3.5 bg-transparent text-on-surface text-body-md focus:outline-none placeholder:text-outline"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    className="pr-3.5 text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {errors.password && <p className="text-label-sm text-error">{errors.password}</p>}
              </div>

              {/* Trust Device */}
              <label className="flex items-center gap-3 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={e => setTrustDevice(e.target.checked)}
                  className="w-5 h-5 rounded accent-primary cursor-pointer"
                />
                <span className="text-body-sm text-on-surface">
                  Trust this device for <span className="font-semibold text-primary">12-hour offline shift</span>
                </span>
              </label>

              {/* Login Button */}
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full h-[52px] bg-primary text-on-primary text-label-lg font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                    <span>INITIALIZING LOCAL DATABASE...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">login</span>
                    <span>SIGN IN TO CLINICAL WORKSTATION</span>
                  </>
                )}
              </button>

              {/* Biometric Quick Auth */}
              <button
                onClick={() => setActiveTab('pin')}
                className="w-full h-[48px] bg-surface-container-low text-primary text-label-lg font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                <span>Quick Biometric / 6-Digit PIN Quick Auth</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick PIN Form */}
        {activeTab === 'pin' && (
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary mt-1">
              <span className="material-symbols-outlined text-[28px]">lock_clock</span>
            </div>
            <h2 className="text-headline-sm text-on-surface font-semibold">Enter Shift PIN</h2>
            <p className="text-body-sm text-on-surface-variant max-w-xs">
              Authorized for registered clinician Dr. E. Jenkins on Station 04
            </p>

            {/* PIN Dots */}
            <div className="flex items-center gap-4 my-2">
              {pin.map((digit, i) => (
                <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all ${digit !== '' ? 'bg-primary' : 'bg-surface-variant'}`}></div>
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px] pt-2">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button
                  key={d}
                  onClick={() => handlePinDigit(d)}
                  className="h-12 rounded-xl bg-surface-container-low text-headline-sm text-on-surface flex items-center justify-center active:bg-surface-container"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => { dispatch({ type: 'LOGIN_PIN' }); navigate('/patients'); }}
                className="h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary active:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[24px]">fingerprint</span>
              </button>
              <button
                onClick={() => handlePinDigit('0')}
                className="h-12 rounded-xl bg-surface-container-low text-headline-sm text-on-surface flex items-center justify-center active:bg-surface-container"
              >
                0
              </button>
              <button
                onClick={handlePinBackspace}
                className="h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant active:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[24px]">backspace</span>
              </button>
            </div>
          </div>
        )}

        {/* Emergency Bypass */}
        <div className="bg-error-container p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-tertiary-container flex items-center justify-center flex-shrink-0 text-on-tertiary shadow-sm">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-label-sm uppercase bg-error text-on-error px-1.5 py-0.5 rounded font-bold">CODE BLUE READY</span>
                <h3 className="text-label-lg font-bold text-on-error-container">Emergency Triage Bypass</h3>
              </div>
              <p className="text-body-sm text-on-error-container mt-1">
                Immediate clinical intake for resuscitation, trauma shock, or mass casualties without active doctor authentication credentials.
              </p>
            </div>
          </div>
          <button
            onClick={handleEmergencyBypass}
            className="w-full h-[52px] bg-tertiary text-on-tertiary text-label-lg font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm active:opacity-90 uppercase tracking-wide"
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>e911_emergency</span>
            <span>ENTER EMERGENCY BYPASS MODE</span>
          </button>
        </div>

        {/* Footer Links */}
        <div className="flex flex-col items-center gap-3 pb-8">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button
              onClick={() => navigate('/register')}
              className="text-label-md text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Register New Medical Officer</span>
            </button>
            <span className="text-outline-variant">•</span>
            <button className="text-label-md text-on-surface-variant hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">smart_card_reader</span>
              <span>Key Reset / SmartCard Issue</span>
            </button>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: '"FILL" 1' }}>shield</span>
            <span className="text-label-sm text-on-surface-variant font-medium">AES-256 Encrypted Vault • DPDP Act 2023 Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
