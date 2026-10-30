// src/components/ui/CameraCapture.jsx
// Cross-platform camera capture with getUserMedia, front/back camera switching,
// stream cleanup, secure-context checks, and mobile gallery / instant test fallback.

import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function CameraCapture({
  onCapture,
  onClose,
  title = 'Capture Photo',
  mode = 'photo', // 'photo' | 'document'
  initialFacingMode = 'user', // 'user' | 'environment'
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [facingMode, setFacingMode] = useState(initialFacingMode);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Check secure context
  const isSecure =
    typeof window !== 'undefined'
      ? window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'https:'
      : true;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsStarting(false);
  }, []);

  const startCamera = useCallback(async (facing) => {
    stopStream();
    setErrorMsg(null);
    setIsStarting(true);

    if (!isSecure) {
      setErrorMsg('Camera access requires HTTPS or localhost. You can upload an image file or use the demo photo.');
      setIsStarting(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Web Camera API is not supported on this browser. Please use the file upload.');
      setIsStarting(false);
      return;
    }

    let stream = null;

    // 1. Try with preferred constraints
    try {
      const constraints = {
        video: {
          facingMode: facing === 'user' ? 'user' : { ideal: 'environment' },
          width: { ideal: mode === 'document' ? 1920 : 1280 },
          height: { ideal: mode === 'document' ? 1080 : 720 },
        },
        audio: false,
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (firstErr) {
      console.warn('Initial camera constraints failed, falling back to basic video:', firstErr);
      // 2. Fallback to basic constraints if preferred constraints failed (OverconstrainedError, etc.)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (fallbackErr) {
        console.error('All camera attempts failed:', fallbackErr);
        setIsStarting(false);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setErrorMsg('Camera permission denied. Please allow camera permissions in browser settings.');
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          setErrorMsg('No camera hardware found on this system. You can choose a file or use a demo capture.');
        } else if (fallbackErr.name === 'NotReadableError') {
          setErrorMsg('Camera hardware is currently in use by another application.');
        } else {
          setErrorMsg(`Unable to open camera: ${fallbackErr.message || 'Device error'}`);
        }
        return;
      }
    }

    if (!stream) {
      setIsStarting(false);
      setErrorMsg('Could not initialize video stream.');
      return;
    }

    streamRef.current = stream;

    // Attach stream to video element
    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.muted = true;

      video.onloadedmetadata = async () => {
        try {
          await video.play();
          setCameraActive(true);
          setIsStarting(false);
        } catch (playErr) {
          console.warn('Video play error:', playErr);
          setCameraActive(true);
          setIsStarting(false);
        }
      };
    } else {
      setCameraActive(true);
      setIsStarting(false);
    }

    // Check available devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    } catch {}
  }, [isSecure, mode, stopStream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopStream();
    };
  }, [facingMode, startCamera, stopStream]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = (video && video.videoWidth) ? video.videoWidth : 640;
    const height = (video && video.videoHeight) ? video.videoHeight : 480;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (video && cameraActive) {
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
    } else {
      // Fallback canvas drawing if video stream had issue
      drawPlaceholder(ctx, width, height);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPreview(dataUrl);
    stopStream();
  };

  const drawPlaceholder = (ctx, w, h) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Swasthya Sync Field Capture', w / 2, h / 2 - 20);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(new Date().toLocaleString(), w / 2, h / 2 + 20);
  };

  // Demo Clinical Photo generator (when testing without physical webcam)
  const generateDemoPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    if (mode === 'document') {
      // Medical Rx Slip Graphic
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 640, 480);

      ctx.fillStyle = '#0284c7';
      ctx.fillRect(20, 20, 600, 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('OUTPOST CLINICAL PRESCRIPTION / DISPENSARY SLIP', 40, 52);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Patient ID: PAT-8812  |  Ward 4 Ganiyari  |  Date: ' + new Date().toLocaleDateString(), 40, 110);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, 130);
      ctx.lineTo(600, 130);
      ctx.stroke();

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('Rx Diagnoses: Acute Febrile Illness (AFI) - Dengue RDT+', 40, 160);
      ctx.fillText('1. Tab. Paracetamol 650mg TDS x 3 days', 40, 195);
      ctx.fillText('2. Oral Rehydration Salts (ORS) ad libitum', 40, 225);
      ctx.fillText('3. Strict follow-up in 48 hours for platelet count monitoring', 40, 255);

      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 12px sans-serif';
      ctx.fillText('Verified by Station 04 Medical Officer (Hash: #04-SYNC-91)', 40, 440);
    } else {
      // Patient Photo Avatar Graphic
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 640, 480);

      // Person silhouette
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(320, 180, 75, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(320, 360, 140, 110, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Verified Clinical Patient ID Portrait', 320, 430);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPreview(dataUrl);
    stopStream();
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (capturedPreview && onCapture) {
      onCapture(capturedPreview);
    }
    if (onClose) onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedPreview(event.target.result);
        stopStream();
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-surface-container flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-surface-container flex items-center justify-between border-b border-surface-container-high">
          <div className="flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-primary text-[22px]">
              {mode === 'document' ? 'document_scanner' : 'photo_camera'}
            </span>
            <h3 className="text-headline-sm font-bold">{title}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              if (onClose) onClose();
            }}
            className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[460px] overflow-hidden">
          {capturedPreview ? (
            <img
              src={capturedPreview}
              alt="Captured Preview"
              className="w-full h-full object-contain max-h-[460px]"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover max-h-[460px] ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Scanning Overlay Grid for documents */}
              {mode === 'document' && cameraActive && (
                <div className="absolute inset-4 border-2 border-dashed border-primary/70 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <span className="text-[11px] font-mono text-primary font-bold bg-black/60 px-2 py-0.5 rounded self-start">
                    ALIGN DOCUMENT / RX SLIP WITHIN FRAME
                  </span>
                  <span className="text-[10px] font-mono text-white/80 bg-black/60 px-2 py-0.5 rounded self-center">
                    Auto-exposure &amp; Contrast Enabled
                  </span>
                </div>
              )}

              {/* Loading spinner while stream initializes */}
              {isStarting && !errorMsg && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-white">
                  <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
                    progress_activity
                  </span>
                  <span className="text-label-sm font-bold">Connecting Camera...</span>
                </div>
              )}

              {/* Error or Fallback Notice */}
              {errorMsg && (
                <div className="absolute inset-4 bg-surface-container-lowest/95 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-3">
                  <span className="material-symbols-outlined text-error text-[36px]">no_photography</span>
                  <p className="text-body-sm font-semibold text-on-surface">{errorMsg}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-3.5 py-2 rounded-xl bg-surface-container-high text-primary font-bold text-label-sm flex items-center gap-1.5 hover:bg-surface-variant transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">replay</span>
                      <span>Retry Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-label-sm flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">file_upload</span>
                      <span>Choose Image File</span>
                    </button>
                    <button
                      type="button"
                      onClick={generateDemoPhoto}
                      className="px-3 py-2 rounded-xl border border-secondary text-secondary font-bold text-label-sm flex items-center gap-1.5 hover:bg-secondary-container/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                      <span>Use Demo Capture</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Camera switch toggle button */}
          {!capturedPreview && cameraActive && hasMultipleCameras && (
            <button
              type="button"
              onClick={toggleFacingMode}
              className="absolute top-3 right-3 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition-transform active:scale-95"
              title="Switch Front/Back Camera"
            >
              <span className="material-symbols-outlined text-[20px]">flip_camera_ios</span>
            </button>
          )}
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 bg-surface-container-lowest flex items-center justify-between gap-3 border-t border-surface-container">
          {capturedPreview ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 min-h-[46px] rounded-xl border border-surface-container-high text-on-surface font-bold text-label-md hover:bg-surface-container transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">replay</span>
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 min-h-[46px] rounded-xl bg-primary text-on-primary font-bold text-label-md shadow-md hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                <span>Use This Photo</span>
              </button>
            </>
          ) : (
            <>
              {/* File upload fallback button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 min-h-[46px] rounded-xl border border-surface-container-high text-on-surface-variant font-bold text-label-sm hover:bg-surface-container flex items-center justify-center gap-1.5 transition-colors"
                title="Upload image from gallery"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                <span>Upload</span>
              </button>

              {/* Demo Sample Capture Button */}
              <button
                type="button"
                onClick={generateDemoPhoto}
                className="px-3 min-h-[46px] rounded-xl border border-surface-container-high text-secondary font-bold text-label-sm hover:bg-surface-container flex items-center justify-center gap-1 transition-colors"
                title="Generate sample clinical photo"
              >
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                <span>Demo</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Shutter Button */}
              <button
                type="button"
                onClick={captureFrame}
                disabled={!cameraActive && isStarting}
                className="flex-1 min-h-[48px] rounded-xl bg-primary text-on-primary font-bold text-label-md flex items-center justify-center gap-2 shadow-md hover:bg-primary-container transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[22px]">photo_camera</span>
                <span>Capture Photo</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
