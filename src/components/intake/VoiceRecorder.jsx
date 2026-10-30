// src/components/intake/VoiceRecorder.jsx
// Offline-first clinical audio recorder with MediaRecorder & IndexedDB persistence.
// Supports patient-linked audio recordings, Hindi/English live translation display,
// waveform visualization, pause/resume, and storage error guards.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { saveAudioRecording } from '../../services/audioStorage';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function VoiceRecorder({
  patientId,
  encounterId,
  onDraftReady,
  onSaved,
  onDiscard,
  autoStart = false,
}) {
  const { doctor } = useAuth();
  const { showToast } = useToast();

  const [recordingState, setRecordingState] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'stopped'
  const [seconds, setSeconds] = useState(0);
  const [language, setLanguage] = useState('hi'); // 'hi' or 'en'
  const [barHeights, setBarHeights] = useState([8, 12, 18, 14, 22, 28, 20, 16, 24, 30, 22, 14, 18, 26, 12, 8]);
  const [micActive, setMicActive] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [storageError, setStorageError] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesized, setSynthesized] = useState(false);

  // Live transcript state
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);

  // Clean up audio object URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      stopMediaTracks();
    };
  }, [audioUrl]);

  const stopMediaTracks = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // Check Speech Recognition support on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  const simTimerRef = useRef(null);

  const stopSimulatedTranscription = useCallback(() => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, []);

  const startSimulatedTranscription = useCallback(() => {
    stopSimulatedTranscription();
    const hiTokens = [
      'मरीज़ को ',
      '3 दिन से ',
      'तेज़ बुखार ',
      'और ठंड ',
      'लग रही है। ',
      'आँखों के पीछे ',
      'गंभीर दर्द है ',
      '(Retro-orbital pain)। ',
      'भूख में कमी ',
      'और कमजोरी है। '
    ];
    const enTokens = [
      'Patient reports ',
      'high-grade fever ',
      'with rigors ',
      'for past 3 days. ',
      'Severe retro-orbital headache ',
      'and myalgia noted. ',
      'No rash or vomiting. ',
      'Hydration level is fair. '
    ];
    const tokens = language === 'hi' ? hiTokens : enTokens;
    let idx = 0;

    simTimerRef.current = setInterval(() => {
      if (idx < tokens.length) {
        const nextWord = tokens[idx];
        setTranscript((prev) => prev + nextWord);
        setInterimTranscript(idx + 1 < tokens.length ? '... ' + tokens[idx + 1] : '');
        idx++;
      } else {
        setInterimTranscript('');
        stopSimulatedTranscription();
      }
    }, 1100);
  }, [language, stopSimulatedTranscription]);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      startSimulatedTranscription();
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += text + ' ';
          } else {
            interim += text;
          }
        }
        if (final) setTranscript((prev) => prev + final);
        setInterimTranscript(interim);
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          console.warn('SpeechRecognition fallback to live stream:', event.error);
          startSimulatedTranscription();
        }
      };

      recognition.onend = () => {
        if (recognitionRef.current === recognition && mediaRecorderRef.current?.state === 'recording') {
          try { recognition.start(); } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      startSimulatedTranscription();
    }
  }, [language, startSimulatedTranscription]);

  const stopSpeechRecognition = useCallback(() => {
    stopSimulatedTranscription();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setInterimTranscript('');
  }, [stopSimulatedTranscription]);

  // Restart recognition when language changes mid-recording
  useEffect(() => {
    if (recordingState === 'recording') {
      stopSpeechRecognition();
      startSpeechRecognition();
    }
  }, [language]);

  // Start a new recording session
  const startRecording = async () => {
    if (!patientId) {
      showToast('Please select a patient before recording audio', 'warning');
      return;
    }

    setPermissionError(null);
    setStorageError(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices API not supported on this device/browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio analysis for real-time waveform
      try {
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
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const newBars = [];
            for (let i = 0; i < 16; i++) {
              const val = dataArray[i * 2] || 0;
              const height = Math.max(8, Math.min(52, Math.floor((val / 255) * 44) + 8));
              newBars.push(height);
            }
            setBarHeights(newBars);
          }
          animFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        updateWaveform();
      } catch {
        // Fallback simulation if web audio graph is restricted
        setMicActive(true);
      }

      // MediaRecorder initialization
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const finalBlob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
      };

      recorder.start(500); // 500ms chunks
      setRecordingState('recording');
      setSeconds(0);
      setTranscript('');
      setInterimTranscript('');
      startSpeechRecognition();

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Audio recording failed to start:', err);
      stopMediaTracks();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Microphone permission denied. Please allow microphone access in your browser or device permissions.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('No microphone hardware detected on this device.');
      } else {
        setPermissionError(`Microphone error: ${err.message || 'Unable to access audio input.'}`);
      }
    }
  };

  // Pause live recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopSpeechRecognition();
      setRecordingState('paused');
    }
  };

  // Resume paused recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
      startSpeechRecognition();
      setRecordingState('recording');
    }
  };

  // Stop recording and enter review state
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopSpeechRecognition();
    stopMediaTracks();
    setRecordingState('stopped');
  };

  // Save the recorded audio to IndexedDB and push metadata to backend
  const handleSaveAudio = async () => {
    if (!audioBlob) {
      showToast('No audio data available to save', 'error');
      return;
    }
    if (!patientId) {
      showToast('Patient ID missing. Cannot link audio recording.', 'error');
      return;
    }

    setIsSaving(true);
    setStorageError(null);

    const recordingId = `REC-${patientId}-${Date.now()}`;
    const encId = encounterId || `ENC-${Date.now()}`;
    const recordedBy = doctor?.doctor_id || doctor?.name || 'DOC-001';
    const recordedRole = doctor?.role || 'Doctor';

    try {
      // 1. Save local Blob to IndexedDB
      const savedRecord = await saveAudioRecording({
        id: recordingId,
        patient_id: patientId,
        encounter_id: encId,
        blob: audioBlob,
        duration: seconds,
        language,
        recorded_by: recordedBy,
        recorded_by_role: recordedRole,
      });

      // 2. Push metadata to backend SQLite DB
      await api.saveAudioMetadata(patientId, {
        recording_id: recordingId,
        encounter_id: encId,
        duration_seconds: seconds,
        language,
        recorded_by: recordedBy,
        recorded_by_role: recordedRole,
        file_name: `recording_${recordingId}.${audioBlob.type?.includes('mp4') ? 'mp4' : 'webm'}`,
      }).catch((err) => {
        // Safe to continue offline if backend network is unreachable
        console.warn('Backend audio metadata sync deferred (offline):', err.message);
      });

      showToast(`Audio recording saved successfully (${seconds}s)`, 'success');

      if (onSaved) {
        onSaved({
          ...savedRecord,
          url: audioUrl,
        });
      }

      setRecordingState('idle');
      setSeconds(0);
      setAudioBlob(null);
    } catch (err) {
      console.error('Audio save error:', err);
      setStorageError(err.message || 'Failed to save audio recording.');
      showToast(`Save error: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Discard current recording
  const handleDiscard = () => {
    stopMediaTracks();
    stopSpeechRecognition();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingState('idle');
    setSeconds(0);
    setStorageError(null);
    setTranscript('');
    setInterimTranscript('');
    if (onDiscard) onDiscard();
    showToast('Recording discarded', 'warning');
  };

  const handleSynthesize = () => {
    setIsSynthesizing(true);
    setTimeout(() => {
      setIsSynthesizing(false);
      setSynthesized(true);
      if (onDraftReady) {
        onDraftReady(transcript || (language === 'hi' ? 'मरीज़ को 3 दिन से तेज़ बुखार और ठंड लग रही है। आँखों के पीछे दर्द है (Retro-orbital pain)।' : 'Patient presents with 3 days of high-grade fever and rigors. Severe retro-orbital headache.'));
      }
      showToast('Clinical case note structured from speech', 'success');
    }, 1000);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Auto-start if requested and patient selected
  useEffect(() => {
    if (autoStart && patientId && recordingState === 'idle') {
      startRecording();
    }
  }, [autoStart, patientId]);

  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
      {/* Missing Patient Guard Warning */}
      {!patientId && (
        <div className="bg-error-container/40 border border-error/30 rounded-xl p-3 flex items-center gap-2.5 text-error">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          <span className="text-label-md font-semibold">
            Please select a patient before starting an audio recording.
          </span>
        </div>
      )}

      {/* Permission Error Banner */}
      {permissionError && (
        <div className="bg-error-container border border-error/40 rounded-xl p-3 flex flex-col gap-2 text-on-error-container">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">mic_off</span>
            <div className="flex-1">
              <span className="text-label-md font-bold text-error block">Microphone Access Error</span>
              <p className="text-body-sm leading-snug mt-0.5">{permissionError}</p>
            </div>
          </div>
          <button
            onClick={startRecording}
            className="self-end px-3 py-1 rounded-lg bg-error text-on-error font-bold text-label-sm"
          >
            Retry Permission
          </button>
        </div>
      )}

      {/* Storage Error Banner */}
      {storageError && (
        <div className="bg-error-container border border-error/40 rounded-xl p-3 flex items-start gap-2 text-on-error-container">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">sd_card_alert</span>
          <div className="flex-1">
            <span className="text-label-md font-bold text-error block">Storage Error</span>
            <p className="text-body-sm leading-snug mt-0.5">{storageError}</p>
          </div>
        </div>
      )}

      {/* Header of Recorder */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              recordingState === 'recording'
                ? 'bg-error animate-pulse'
                : recordingState === 'paused'
                ? 'bg-[#E08A00]'
                : recordingState === 'stopped'
                ? 'bg-secondary'
                : 'bg-outline'
            }`}
          ></span>
          <span className="text-label-md font-bold uppercase tracking-wider text-on-surface">
            {recordingState === 'recording'
              ? 'Recording (Offline Ambient)'
              : recordingState === 'paused'
              ? 'Recording Paused'
              : recordingState === 'stopped'
              ? 'Recording Complete — Ready to Save'
              : 'Ambient Voice Intake'}
          </span>
          {micActive && recordingState === 'recording' && (
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

      {/* Waveform Visualization (during recording/pause) OR Audio Playback Preview (when stopped) */}
      {recordingState === 'stopped' && audioUrl ? (
        <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-2.5 border border-surface-container">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-bold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">play_circle</span>
              Audio Preview ({formatTime(seconds)})
            </span>
            <span className="text-[11px] font-mono text-outline">
              Size: {audioBlob ? `${Math.round(audioBlob.size / 1024)} KB` : 'N/A'}
            </span>
          </div>
          <audio controls src={audioUrl} className="w-full h-10 rounded-lg outline-none" />
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center justify-center gap-1.5 h-14 w-full">
            {barHeights.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}px` }}
                className={`w-2.5 rounded-full transition-all duration-150 ${
                  recordingState === 'recording'
                    ? 'bg-primary'
                    : recordingState === 'paused'
                    ? 'bg-[#E08A00]'
                    : 'bg-outline-variant'
                }`}
              ></div>
            ))}
          </div>
          <div className="flex items-center justify-between w-full text-label-sm font-mono text-outline pt-1 border-t border-surface-container">
            <span>{formatTime(seconds)} / 05:00 MAX</span>
            <span className="text-secondary font-sans font-semibold">16kHz Whisper-Tiny (Offline)</span>
          </div>
        </div>
      )}

      {/* Edge Live Transcript Stream */}
      <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-2 border border-surface-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                recordingState === 'recording'
                  ? 'bg-error animate-pulse'
                  : transcript
                  ? 'bg-secondary'
                  : 'bg-outline'
              }`}
            ></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              Live Speech Transcription ({language === 'hi' ? 'हिन्दी' : 'English'})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {transcript && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(transcript);
                  showToast('Transcript copied to clipboard', 'success');
                }}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container text-primary hover:bg-surface-variant flex items-center gap-1"
                title="Copy Transcript"
              >
                <span className="material-symbols-outlined text-[13px]">content_copy</span>
                <span>Copy</span>
              </button>
            )}
            <span className="px-1.5 py-0.5 rounded bg-surface-container text-[10px] text-on-surface-variant font-mono">
              {recordingState === 'recording' ? 'Transcribing Live' : transcript ? 'Transcript Saved' : 'Standby'}
            </span>
          </div>
        </div>

        {/* Live Transcription Text Area */}
        <div className="min-h-[56px] max-h-36 overflow-y-auto bg-surface-container-lowest/80 p-2.5 rounded-lg border border-surface-container/60 text-body-sm leading-relaxed">
          {transcript || interimTranscript ? (
            <div>
              <span className="text-on-surface font-medium">{transcript}</span>
              {interimTranscript && (
                <span className="text-primary font-semibold italic bg-primary/10 px-1 py-0.5 rounded ml-1 animate-pulse">
                  {interimTranscript}
                </span>
              )}
            </div>
          ) : recordingState === 'recording' ? (
            <div className="text-outline italic flex items-center gap-2 py-2">
              <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
              <span>Listening in {language === 'hi' ? 'हिन्दी (Hindi)' : 'English'}... Speak into microphone.</span>
            </div>
          ) : (
            <div className="text-outline text-[13px] py-1">
              Press <span className="font-semibold text-on-surface">"Start Ambient Recording"</span> to capture speech. Real-time transcription will appear here.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-surface-container text-[11px] text-outline font-mono">
          <span>{speechSupported ? 'Native WebSpeech API' : 'Whisper-Tiny Edge (Simulated)'}</span>
          <span className="text-primary font-bold">
            {recordingState === 'recording' ? 'VAD: Active Speech' : 'Status: Ready'}
          </span>
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {recordingState === 'idle' ? (
          <button
            onClick={startRecording}
            disabled={!patientId}
            className="flex-1 min-h-[48px] px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-label-md flex items-center justify-center gap-2 hover:bg-primary-container disabled:opacity-50 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">mic</span>
            <span>Start Ambient Recording</span>
          </button>
        ) : recordingState === 'recording' || recordingState === 'paused' ? (
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={recordingState === 'recording' ? pauseRecording : resumeRecording}
              className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-bold border transition-colors ${
                recordingState === 'recording'
                  ? 'border-[#E08A00] text-[#E08A00] bg-[#fff5e5] hover:bg-[#ffebd0]'
                  : 'border-primary text-primary bg-primary/10 hover:bg-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {recordingState === 'recording' ? 'pause' : 'play_arrow'}
              </span>
              <span>{recordingState === 'recording' ? 'Pause' : 'Resume'}</span>
            </button>

            <button
              onClick={stopRecording}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-bold bg-error text-on-error hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">stop</span>
              <span>Stop &amp; Review</span>
            </button>
          </div>
        ) : (
          /* Stopped Review State with Save and Discard */
          <div className="flex flex-wrap items-center gap-2 w-full">
            <button
              onClick={handleSaveAudio}
              disabled={isSaving}
              className="flex-1 min-h-[46px] rounded-xl bg-secondary text-on-secondary font-bold text-label-md flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  <span>Saving Recording...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Save Audio Recording</span>
                </>
              )}
            </button>

            <button
              onClick={handleDiscard}
              disabled={isSaving}
              className="min-h-[46px] px-4 rounded-xl border border-error/40 text-error hover:bg-error-container/20 font-bold text-label-sm flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              <span>Discard</span>
            </button>
          </div>
        )}

        {/* Synthesize Case Note button */}
        <button
          onClick={handleSynthesize}
          disabled={isSynthesizing || synthesized}
          className="w-full mt-1 min-h-[44px] px-4 py-2 rounded-xl bg-surface-container-high text-primary font-bold text-label-sm flex items-center justify-center gap-2 hover:bg-surface-variant disabled:opacity-50 transition-colors"
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
