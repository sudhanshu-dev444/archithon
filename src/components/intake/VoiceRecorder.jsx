import React, { useState, useEffect } from 'react';

export default function VoiceRecorder({ onDraftReady }) {
  const [isRecording, setIsRecording] = useState(true);
  const [seconds, setSeconds] = useState(24);
  const [language, setLanguage] = useState('hi'); // 'hi' or 'en'
  const [barHeights, setBarHeights] = useState([
    12, 28, 42, 18, 36, 48, 22, 14, 38, 44, 26, 16, 32, 40, 20, 10
  ]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesized, setSynthesized] = useState(false);

  // Timer effect
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Waveform fluctuation effect
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setBarHeights(Array.from({ length: 16 }, () => Math.floor(Math.random() * 38) + 8));
      }, 180);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSynthesize = () => {
    setIsSynthesizing(true);
    setTimeout(() => {
      setIsSynthesizing(false);
      setSynthesized(true);
      if (onDraftReady) onDraftReady();
    }, 1200);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
      {/* Header of Recorder */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${
            isRecording ? 'bg-error animate-pulse' : 'bg-outline'
          }`}></span>
          <span className="text-label-md font-bold uppercase tracking-wider text-on-surface">
            {isRecording ? 'Recording (Offline Ambient)' : 'Recording Paused'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg">
          <button
            onClick={() => setLanguage('hi')}
            className={`px-2.5 py-1 rounded text-[12px] font-bold transition-all ${
              language === 'hi' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            à¤¹à¤¿à¤¨à¥à¤¦à¥€ (HI)
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded text-[12px] font-bold transition-all ${
              language === 'en' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            English (EN)
          </button>
        </div>
      </div>

      {/* Waveform Visualization */}
      <div className="bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center gap-2">
        <div className="flex items-center justify-center gap-1.5 h-14 w-full">
          {barHeights.map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}px` }}
              className={`w-2.5 rounded-full transition-all duration-150 ${
                isRecording ? 'bg-primary' : 'bg-outline-variant'
              }`}
            ></div>
          ))}
        </div>
        <div className="flex items-center justify-between w-full text-label-sm font-mono text-outline pt-1 border-t border-surface-container">
          <span>{formatTime(seconds)} / 05:00 MAX</span>
          <span className="text-secondary font-sans font-semibold">16kHz Whisper-Tiny (Offline)</span>
        </div>
      </div>

      {/* Edge Live Transcript Stream */}
      <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
            Edge Transcript Stream (Simultaneous Translation)
          </span>
          <span className="px-1.5 py-0.5 rounded bg-surface-container text-[10px] text-on-surface-variant font-mono">
            Confidence: 96%
          </span>
        </div>
        <p className="text-body-md text-on-surface font-sans leading-relaxed">
          {language === 'hi' ? (
            <>
              "मरीज को तीन दिनों से तेज बुखार है, साथ में सिरदर्द और कंपकंपी... कल रात से उल्टी की शिकायत भी है। कोई पुरानी दवा नहीं ली।"
            </>
          ) : (
            <>
              "Patient presents with high grade fever for 3 days, accompanied by chills and retro-orbital headache. Reports nausea since last night. Denies taking unprescribed medication."
            </>
          )}
        </p>
      </div>

      {/* Recorder Controls */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => setIsRecording(!isRecording)}
          className="flex-1 min-h-[48px] rounded-xl bg-surface-container text-on-surface font-semibold text-label-md flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isRecording ? 'pause' : 'play_arrow'}
          </span>
          <span>{isRecording ? 'Pause Dictation' : 'Resume Dictation'}</span>
        </button>

        <button
          onClick={handleSynthesize}
          disabled={isSynthesizing}
          className={`flex-1 min-h-[48px] rounded-xl font-semibold text-label-md flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform shadow-sm ${
            synthesized ? 'bg-secondary text-on-secondary' : 'bg-primary-container text-on-primary'
          }`}
        >
          {isSynthesizing ? (
            <>
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              <span>Extracting Draft...</span>
            </>
          ) : synthesized ? (
            <>
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>Draft Synthesized</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              <span>Synthesize Draft</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
