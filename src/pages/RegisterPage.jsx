import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LOGO_URL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjYq9nEkdIslQtHwI6BhAT60guF6dwo4l4qfBBap9KlG89Q8ny10yP0_nKyuY1qtOLqmeBD4qdy3tZZ4-QkGWHlmikYxYzaGYROaUCmO0jzvlDhzHz1Ju6j0I7rMg7Gi-q_j8kB0r9WTWN-9PLyZUlUK9CJNWANYfx2STyZZoNXENXRg5besiJ8ZgEGxO-JNo0w_W6OOuHjV4dnFIRo3MqH-V-5_Bpa4UEVUo8Ao_PTtXDNkWGMuY';

const LICENSING_COUNCILS = [
  'National Medical Commission (NMC - Central)',
  'Maharashtra Medical Council (MMC)',
  'Chhattisgarh State Medical Council',
  'Karnataka Medical Council (KMC)',
  'Delhi Medical Council (DMC)',
  'Tamil Nadu Medical Council',
];

const SPECIALTIES = [
  'General Internal Medicine',
  'Pediatrics & Neonatology',
  'Emergency & Trauma Medicine',
  'Obstetrics & Gynecology',
  'General Surgery',
  'Infectious Disease & Epidemiology',
  'Psychiatry & Mental Health',
  'Community Medicine',
];

const DEGREES = ['MBBS', 'MD', 'MS', 'DNB', 'DM', 'MCh', 'MPH'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    legalName: '',
    email: '',
    phone: '',
    regId: 'MCI-2018-847291',
    council: LICENSING_COUNCILS[0],
    specialty: SPECIALTIES[0],
    degrees: ['MBBS', 'MD'],
    facility: 'Ganiyari Health Outpost, Sector 4',
    role: 'Attending Field Physician',
    passphrase: '',
    passphraseConfirm: '',
    pin: ['', '', '', '', '', ''],
    attestation: false,
  });
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleDegree = (deg) => {
    const updated = form.degrees.includes(deg)
      ? form.degrees.filter(d => d !== deg)
      : [...form.degrees, deg];
    update('degrees', updated);
  };

  const handlePinInput = (index, val) => {
    if (!/^\d?$/.test(val)) return;
    const newPin = [...form.pin];
    newPin[index] = val;
    update('pin', newPin);
    if (val && index < 5) {
      document.getElementById(`reg-pin-${index + 1}`)?.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !form.pin[index] && index > 0) {
      document.getElementById(`reg-pin-${index - 1}`)?.focus();
    }
  };

  const getStrength = (pass) => {
    if (pass.length === 0) return { level: 0, label: '', color: '' };
    if (pass.length < 6) return { level: 1, label: 'Weak', color: 'bg-error' };
    if (pass.length < 10) return { level: 2, label: 'Fair', color: 'bg-[#E08A00]' };
    if (pass.length < 14) return { level: 3, label: 'Strong', color: 'bg-secondary' };
    return { level: 4, label: 'Very Strong', color: 'bg-primary' };
  };

  const strength = getStrength(form.passphrase);

  const handleSubmit = () => {
    const newErrors = {};
    if (!form.legalName) newErrors.legalName = 'Required';
    if (!form.email) newErrors.email = 'Required';
    if (!form.passphrase) newErrors.passphrase = 'Required';
    if (form.passphrase !== form.passphraseConfirm) newErrors.passphraseConfirm = 'Passphrases do not match';
    if (!form.attestation) newErrors.attestation = 'You must attest';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary-fixed flex items-center justify-center">
          <span className="material-symbols-outlined text-[44px] text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>task_alt</span>
        </div>
        <h1 className="text-headline-md text-on-surface font-bold">Node Certificate Issued</h1>
        <p className="text-body-md text-on-surface-variant max-w-sm">
          Your registration has been submitted for verification. You will receive your credentials once your medical license is confirmed.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="w-full max-w-sm h-[52px] bg-primary text-on-primary rounded-xl text-label-lg font-semibold flex items-center justify-center gap-2 shadow-md"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Return to Doctor Login
        </button>
      </div>
    );
  }

  const inputCls = (err) => `flex items-center h-[52px] bg-surface-container-low rounded-lg px-3.5 gap-2 focus-within:bg-surface-container-lowest focus-within:ring-2 ${err ? 'ring-2 ring-error' : 'focus-within:ring-primary-container'}`;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            aria-label="Back to Doctor Login"
            className="h-12 w-12 rounded-xl flex items-center justify-center text-on-surface bg-surface-container active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-headline-sm">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <img src={LOGO_URL} alt="Logo" className="h-6 w-6 rounded object-contain" />
              <p className="text-headline-sm text-on-surface font-bold tracking-tight">Staff Registration</p>
            </div>
            <p className="text-label-sm text-secondary">Swasthya Sync • Clinical Mesh</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high">
          <span className="material-symbols-outlined text-label-md text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>enhanced_encryption</span>
          <span className="text-label-sm tracking-wider font-semibold uppercase">ECDSA-384</span>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg bg-primary text-on-primary text-label-sm">Step 1 of 3</span>
              <span className="text-label-lg text-on-surface">Credentials &amp; Licensure</span>
            </div>
            <span className="text-label-sm text-secondary">33% Complete</span>
          </div>
          <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full w-1/3 rounded-full transition-all duration-300"></div>
          </div>
          <div className="flex items-center justify-between text-secondary">
            <span className="text-label-sm font-semibold text-primary">1. Credentials</span>
            <span className="text-label-sm opacity-50">2. Biometrics</span>
            <span className="text-label-sm opacity-50">3. Node Provisioning</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <form className="px-4 pb-32 flex flex-col gap-4 pt-1" onSubmit={e => e.preventDefault()}>
        {/* Personal Intake */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-1 text-primary">
            <span className="material-symbols-outlined text-headline-sm" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
            <h2 className="text-headline-sm text-on-surface">Personal &amp; Institutional Intake</h2>
          </div>

          {/* Legal Name */}
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block" htmlFor="legal-name">Full Legal Name (as per registry)</label>
            <div className={`${inputCls(errors.legalName)} p-0 overflow-hidden`}>
              <div className="px-3.5 h-full flex items-center bg-surface-container text-on-surface-variant text-label-lg select-none shrink-0">Dr.</div>
              <input
                id="legal-name"
                type="text"
                value={form.legalName}
                onChange={e => { update('legalName', e.target.value); setErrors(p => ({ ...p, legalName: '' })); }}
                placeholder="Aaditya V. Shenoy"
                className="flex-1 h-full px-3 bg-transparent text-on-surface text-body-md placeholder:text-outline focus:outline-none"
              />
            </div>
            {errors.legalName && <p className="text-label-sm text-error">{errors.legalName}</p>}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block" htmlFor="inst-email">Official Institutional Email</label>
            <div className={inputCls(errors.email)}>
              <span className="material-symbols-outlined text-secondary text-headline-sm">mail</span>
              <input
                id="inst-email"
                type="email"
                value={form.email}
                onChange={e => { update('email', e.target.value); setErrors(p => ({ ...p, email: '' })); }}
                placeholder="a.shenoy@ganiyari.health.org"
                className="flex-1 h-full bg-transparent text-on-surface text-body-md placeholder:text-outline focus:outline-none"
              />
            </div>
            <p className="text-label-sm text-secondary">FHIR auth token will be anchored to institutional domain.</p>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block" htmlFor="phone">Field Operational Mobile (Triage Pager)</label>
            <div className={inputCls()}>
              <span className="material-symbols-outlined text-secondary text-headline-sm">call</span>
              <span className="text-tabular-data text-on-surface-variant">+91</span>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="98421 77310"
                className="flex-1 h-full bg-transparent text-on-surface text-tabular-data placeholder:text-outline focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Medical Licensure */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-headline-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <h2 className="text-headline-sm text-on-surface">Medical Licensure</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-semibold">FHIR R4 Verified</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block" htmlFor="reg-id">Medical Registration ID (NMC / State Registry)</label>
            <div className={inputCls()}>
              <span className="material-symbols-outlined text-secondary text-headline-sm">clinical_notes</span>
              <input
                id="reg-id"
                type="text"
                value={form.regId}
                onChange={e => update('regId', e.target.value)}
                className="flex-1 h-full bg-transparent text-on-surface text-tabular-data uppercase tracking-wider focus:outline-none font-semibold"
              />
              <span className="material-symbols-outlined text-label-lg text-primary pr-1" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block" htmlFor="council">Licensing Medical Council</label>
            <div className="relative flex items-center h-[52px] bg-surface-container-low rounded-lg px-3.5">
              <select
                id="council"
                value={form.council}
                onChange={e => update('council', e.target.value)}
                className="w-full h-full bg-transparent text-on-surface text-body-md appearance-none focus:outline-none pr-8"
              >
                {LICENSING_COUNCILS.map(c => <option key={c}>{c}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-3 pointer-events-none text-secondary">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block" htmlFor="specialty">Primary Clinical Specialty</label>
            <div className="relative flex items-center h-[52px] bg-surface-container-low rounded-lg px-3.5">
              <select
                id="specialty"
                value={form.specialty}
                onChange={e => update('specialty', e.target.value)}
                className="w-full h-full bg-transparent text-on-surface text-body-md appearance-none focus:outline-none pr-8"
              >
                {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-3 pointer-events-none text-secondary">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="text-label-md text-on-surface block">Accredited Degrees Held</label>
            <div className="grid grid-cols-4 gap-2">
              {DEGREES.map(deg => (
                <label key={deg} className="cursor-pointer">
                  <input type="checkbox" checked={form.degrees.includes(deg)} onChange={() => toggleDegree(deg)} className="sr-only peer" />
                  <div className="h-11 rounded-lg bg-surface-container-low text-on-surface flex items-center justify-center text-label-lg peer-checked:bg-primary-container peer-checked:text-on-primary transition-colors">
                    {deg}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Station Deployment */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-1 text-primary">
            <span className="material-symbols-outlined text-headline-sm" style={{ fontVariationSettings: "'FILL' 1" }}>local_hospital</span>
            <h2 className="text-headline-sm text-on-surface">Station Deployment</h2>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block" htmlFor="facility">Assigned Health Facility / Outpost</label>
            <div className={inputCls()}>
              <span className="material-symbols-outlined text-secondary text-headline-sm">share_location</span>
              <input
                id="facility"
                type="text"
                value={form.facility}
                onChange={e => update('facility', e.target.value)}
                className="flex-1 h-full bg-transparent text-on-surface text-body-md focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block">Clinical Station Role</label>
            <div className="flex items-center h-[52px] bg-surface-container rounded-lg px-3.5 gap-2">
              <span className="material-symbols-outlined text-secondary text-headline-sm">medical_services</span>
              <input
                type="text"
                value={form.role}
                readOnly
                className="flex-1 h-full bg-transparent text-on-surface text-body-md font-semibold cursor-not-allowed focus:outline-none"
              />
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-label-sm uppercase">Locked</span>
            </div>
          </div>
        </div>

        {/* Offline Station Security */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-headline-sm" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
              <h2 className="text-headline-sm text-on-surface">Offline Station Security</h2>
            </div>
            <div className="flex items-center gap-1 text-secondary text-label-sm">
              <span className="material-symbols-outlined text-label-md">wifi_off</span>
              <span>Zero-Cell Ready</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block" htmlFor="passphrase">Station Passphrase</label>
            <div className={inputCls(errors.passphrase)}>
              <span className="material-symbols-outlined text-secondary text-headline-sm">lock</span>
              <input
                id="passphrase"
                type={showPass ? 'text' : 'password'}
                value={form.passphrase}
                onChange={e => { update('passphrase', e.target.value); setErrors(p => ({ ...p, passphrase: '' })); }}
                placeholder="At least 8 characters"
                className="flex-1 h-full bg-transparent text-on-surface text-body-md focus:outline-none"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="text-secondary pr-1">
                <span className="material-symbols-outlined text-headline-sm">{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {strength.level > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-label-sm text-secondary">Passphrase Strength</span>
                  <span className={`text-label-sm font-semibold ${strength.level >= 3 ? 'text-primary' : strength.level === 2 ? 'text-[#E08A00]' : 'text-error'}`}>{strength.label}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`rounded-full ${i <= strength.level ? strength.color : 'bg-surface-container'}`}></div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface block">Confirm Station Passphrase</label>
            <div className={inputCls(errors.passphraseConfirm)}>
              <span className="material-symbols-outlined text-secondary text-headline-sm">lock_reset</span>
              <input
                type="password"
                value={form.passphraseConfirm}
                onChange={e => { update('passphraseConfirm', e.target.value); setErrors(p => ({ ...p, passphraseConfirm: '' })); }}
                placeholder="Re-enter passphrase"
                className="flex-1 h-full bg-transparent text-on-surface text-body-md focus:outline-none"
              />
            </div>
            {errors.passphraseConfirm && <p className="text-label-sm text-error">{errors.passphraseConfirm}</p>}
          </div>

          {/* 6-Digit PIN */}
          <div className="flex flex-col gap-1.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-label-md text-on-surface block">6-Digit Offline Emergency PIN</label>
              <span className="text-label-sm text-secondary">For rapid bedside unlock</span>
            </div>
            <p className="text-body-sm text-on-surface-variant">Allows clinical record authorization during zero-network field missions.</p>
            <div className="flex items-center justify-between gap-2 pt-1">
              {form.pin.map((digit, i) => (
                <input
                  key={i}
                  id={`reg-pin-${i}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  pattern="[0-9]"
                  value={digit}
                  onChange={e => handlePinInput(i, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(i, e)}
                  className="w-11 h-12 text-center bg-surface-container text-headline-sm rounded-lg focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:outline-none"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Attestation */}
        <div className={`bg-surface-container-low rounded-xl p-4 flex items-start gap-3.5 ${errors.attestation ? 'bg-error-container' : ''}`}>
          <input
            type="checkbox"
            id="attestation"
            checked={form.attestation}
            onChange={e => { update('attestation', e.target.checked); setErrors(p => ({ ...p, attestation: '' })); }}
            className="mt-0.5 h-6 w-6 rounded accent-primary-container cursor-pointer flex-shrink-0"
          />
          <label htmlFor="attestation" className="text-body-sm text-on-surface cursor-pointer select-none leading-relaxed">
            I certify under medical licensure regulations that all provided credentials are genuine and accept cryptographic attestation responsibility for all triage encounters authored on this station node.
          </label>
        </div>
        {errors.attestation && <p className="text-label-sm text-error px-1">{errors.attestation}</p>}
      </form>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex flex-col gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-[52px] bg-primary-container text-on-primary rounded-xl text-label-lg font-semibold flex items-center justify-center gap-2 active:bg-primary shadow-md active:scale-[0.99] transition-all disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <span className="material-symbols-outlined animate-spin text-headline-sm">progress_activity</span>
              <span>Validating FHIR Credential Mesh...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-headline-sm">fact_check</span>
              <span>Submit Registration for Verification</span>
            </>
          )}
        </button>
        <button
          onClick={() => navigate('/login')}
          className="w-full h-10 text-primary text-label-md flex items-center justify-center active:opacity-70 transition-opacity"
        >
          Already registered? Return to Doctor Login
        </button>
      </div>
    </div>
  );
}
