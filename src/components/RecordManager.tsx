import React, { useEffect, useState } from 'react';
import {
  Mic,
  Square,
  Download,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  FileAudio,
  Check,
  Loader2,
  Sparkles,
  Radio,
  Sliders,
} from 'lucide-react';
import { synthEngine } from '../audio/synthEngine';
import { audioBufferToWav, audioBufferToMp3, downloadAudioBlob } from '../audio/audioExport';

interface RecordManagerProps {
  isRecording: boolean;
  onStopRecord: () => void;
  presetName?: string;
}

export const RecordManager: React.FC<RecordManagerProps> = ({
  isRecording,
  onStopRecord,
  presetName = 'Aura Session',
}) => {
  const [seconds, setSeconds] = useState(0);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [isEncodingWav, setIsEncodingWav] = useState(false);
  const [isEncodingMp3, setIsEncodingMp3] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Timer while recording
  useEffect(() => {
    let interval: number;
    if (isRecording) {
      setSeconds(0);
      setRawBlob(null);
      setAudioBuffer(null);
      setPreviewUrl(null);
      setExportSuccess(null);
      interval = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleStopRecording = async () => {
    onStopRecord();
    setIsDecoding(true);

    try {
      const blob = await synthEngine.stopRecording();
      setRawBlob(blob);

      // Create preview URL
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      // Default filename based on preset and date
      const cleanPreset = presetName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const timeStamp = new Date().toISOString().slice(0, 10);
      setSessionTitle(`${cleanPreset}-${timeStamp}`);

      // Decode the raw blob into an AudioBuffer using the AudioContext
      const buffer = await synthEngine.decodeRecordedBlob(blob);
      setAudioBuffer(buffer);
    } catch (err) {
      console.error('Failed to decode recorded audio buffer:', err);
    } finally {
      setIsDecoding(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${String(mins).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  // Export as .WAV (16-bit Stereo PCM)
  const handleExportWav = async () => {
    if (!audioBuffer) return;
    setIsEncodingWav(true);
    setExportSuccess(null);

    // Yield to allow UI to update
    await new Promise((r) => setTimeout(r, 60));

    try {
      const wavBlob = audioBufferToWav(audioBuffer);
      const filename = `${sessionTitle || 'aura-master-session'}.wav`;
      downloadAudioBlob(wavBlob, filename);
      setExportSuccess(`Exported ${filename} (${(wavBlob.size / (1024 * 1024)).toFixed(2)} MB)`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      console.error('WAV export error:', err);
    } finally {
      setIsEncodingWav(false);
    }
  };

  // Export as .MP3 (192 kbps Stereo)
  const handleExportMp3 = async () => {
    if (!audioBuffer) return;
    setIsEncodingMp3(true);
    setExportSuccess(null);

    // Yield to allow UI to update
    await new Promise((r) => setTimeout(r, 60));

    try {
      const mp3Blob = audioBufferToMp3(audioBuffer, 192);
      const filename = `${sessionTitle || 'aura-master-session'}.mp3`;
      downloadAudioBlob(mp3Blob, filename);
      setExportSuccess(`Exported ${filename} (${(mp3Blob.size / 1024).toFixed(1)} KB)`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      console.error('MP3 export error:', err);
    } finally {
      setIsEncodingMp3(false);
    }
  };

  const handleDismiss = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setRawBlob(null);
    setAudioBuffer(null);
    setPreviewUrl(null);
    setExportSuccess(null);
  };

  // Nothing to display if not recording and no recording pending export
  if (!isRecording && !rawBlob && !isDecoding) {
    return null;
  }

  return (
    <div className="rounded-xl bg-neutral-900/95 border border-neutral-800 p-4 sm:p-5 shadow-xl flex flex-col gap-4 animate-in fade-in duration-200">
      {/* 1. Live Recording State Bar */}
      {isRecording && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-base font-bold text-red-400 tabular-nums">
                REC {formatTime(seconds)}
              </span>
              <span className="text-xs text-neutral-400 hidden md:inline">
                · Capturing Master stereo bus via MediaRecorder API
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStopRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop & Export Master</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Decoding Spinner */}
      {isDecoding && (
        <div className="flex items-center justify-center py-6 gap-3 text-neutral-300">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span className="text-sm font-medium">Processing Master Audio Channel & Decoding PCM Data...</span>
        </div>
      )}

      {/* 3. Session Export Console (When stopped and ready) */}
      {!isRecording && audioBuffer && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <FileAudio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Master Session Recorded</h3>
                <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                  <span className="font-mono tabular-nums">{formatTime(audioBuffer.duration)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Stereo {audioBuffer.sampleRate} Hz</span>
                  <span aria-hidden="true">·</span>
                  <span>16-Bit Master Bus</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close session export"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Audio Preview & Filename */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Audio element for instant playback preview */}
            <div className="md:col-span-6 flex items-center gap-2">
              {previewUrl && (
                <audio
                  src={previewUrl}
                  controls
                  className="w-full h-9 accent-amber-500 rounded-md"
                />
              )}
            </div>

            {/* Custom Filename */}
            <div className="md:col-span-6 flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-400 whitespace-nowrap">File name:</span>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="aura-master-session"
                className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700/80 text-xs font-mono text-neutral-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-neutral-800/80">
            <span className="text-xs text-neutral-400">
              Select export format for your master track:
            </span>

            <div className="flex items-center gap-2.5">
              {/* WAV Export Button */}
              <button
                onClick={handleExportWav}
                disabled={isEncodingWav || isEncodingMp3}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs border border-neutral-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Export lossless 16-bit uncompressed WAV"
              >
                {isEncodingWav ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Encoding WAV...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Export .WAV (Lossless 16-bit)</span>
                  </>
                )}
              </button>

              {/* MP3 Export Button */}
              <button
                onClick={handleExportMp3}
                disabled={isEncodingWav || isEncodingMp3}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs transition-all shadow-[0_0_14px_rgba(245,158,11,0.3)] active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Export high quality 192kbps MP3"
              >
                {isEncodingMp3 ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Encoding MP3...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Export .MP3 (192 kbps)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Success Message Banner */}
          {exportSuccess && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs animate-in fade-in duration-150">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
