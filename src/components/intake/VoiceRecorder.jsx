import React, { useState, useEffect, useRef } from 'react';

export default function VoiceRecorder({ onDraftReady }) {
  const [isRecording, setIsRecording] = useState(true);
  const [seconds, setSeconds] = useState(24);
  const [language, setLanguage] = useState('hi'); // 'hi' or 'en'
  const [barHeights, setBarHeights] = useState([
    12, 28, 42, 18, 36, 48, 22, 14, 38, 44, 26, 16, 32, 40, 20, 10
  ]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesized, setSynthesized] = useState(false);
  const [micActive, setMicActive] = useState(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

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

  // Real microphone audio analysis with fallback
  useEffect(() => {
    let fallbackInterval;

    const startMic = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('No media devices');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;

        setMicActive(true);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateWaveform = () => {
          if (!isRecording) return;
          analyser.getByteFrequencyData(dataArray);

          // Sample 16 points from frequency data
          const newBars = [];
          for (let i = 0; i < 16; i++) {
            const val = dataArray[i * 2] || 0;
            // Scale 0-255 to 8px-52px
            const height = Math.max(8, Math.min(52, Math.floor((val / 255) * 44) + 8));
            newBars.push(height);
          }
          setBarHeights(newBars);
          animFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        updateWaveform();
      } catch {
        // Fallback acoustic simulation if microphone permission is not granted
        setMicActive(false);
        fallbackInterval = setInterval(() => {
          if (isRecording) {
            setBarHeights(Array.from({ length: 16 }, () => Math.floor(Math.random() * 38) + 8));
          }
        }, 160);
      }
    };

    if (isRecording) {
      startMic();
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
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

  const toggleRecording = () => {
    setIsRecording(prev => !prev);
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
          {micActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold">
              LIVE MIC
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg">
          <button
            onClick={() => setLanguage('hi')}
            className={`px-2.5 py-1 rounded text-[12px] font-bold transition-all ${
              language === 'hi' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            हिन्दी (HI)
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

        {language === 'hi' ? (
          <div className="text-body-sm text-on-surface leading-relaxed">
            <span className="text-outline">"मरीज़ को 3 दिन से तेज़ बुखार और ठंड लग रही है...</span>{' '}
            <span className="font-semibold text-primary">आँखों के पीछे दर्द है (Retro-orbital pain)...</span>{' '}
            <span className="text-on-surface">पैरिसिटामोल 650 चार बार और ORS दिया जाए।"</span>
          </div>
        ) : (
          <div className="text-body-sm text-on-surface leading-relaxed">
            <span className="text-outline">"Patient presents with 3 days of high-grade fever and rigors...</span>{' '}
            <span className="font-semibold text-primary">severe retro-orbital headache...</span>{' '}
            <span className="text-on-surface">Paracetamol 650mg QDS and ORS ad libitum prescribed."</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-surface-container text-[11px] text-outline font-mono">
          <span>Hindi → English Auto-Structured</span>
          <span className="text-primary font-bold">VAD: Active Speech</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          onClick={toggleRecording}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-sm font-bold border transition-colors ${
            isRecording
              ? 'border-error/30 text-error bg-error-container/20 hover:bg-error-container/40'
              : 'border-primary/30 text-primary bg-primary/10 hover:bg-primary/20'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isRecording ? 'pause' : 'mic'}
          </span>
          <span>{isRecording ? 'Pause Recording' : 'Resume Mic'}</span>
        </button>

        <button
          onClick={handleSynthesize}
          disabled={isSynthesizing || synthesized}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-label-sm flex items-center gap-2 active:scale-95 transition-transform hover:bg-primary-container disabled:opacity-50 shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isSynthesizing ? 'sync' : 'auto_awesome'}
          </span>
          <span>{isSynthesizing ? 'Structuring...' : synthesized ? 'Structured Case Ready' : 'Synthesize Case Note'}</span>
        </button>
      </div>
    </div>
  );
}
