import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecorder } from '../hooks/useRecorder'
import AppHeader from '../components/AppHeader'
import {
  IconCamera,
  IconMonitor,
  IconPip,
  IconMic,
  IconChevronDown,
  IconLock,
  IconVideo,
  IconLink,
} from '../components/icons'

const MODES = [
  { id: 'camera', label: 'Camera', Icon: IconCamera },
  { id: 'screen', label: 'Screen', Icon: IconMonitor },
  { id: 'pip', label: 'Screen + Camera', Icon: IconPip },
]

function DeviceSelect({ label, Icon, value, onChange, options, fallback }) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors focus-within:border-gray-400 hover:border-gray-300">
      <Icon size={16} className="shrink-0 text-gray-400" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="min-w-0 flex-1 appearance-none truncate bg-transparent text-sm text-gray-800 focus:outline-none"
      >
        {options.length === 0 && <option>{fallback}</option>}
        {options.map(d => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || fallback}
          </option>
        ))}
      </select>
      <IconChevronDown size={14} className="shrink-0 text-gray-400" />
    </label>
  )
}

export default function Recorder() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const previewVideoRef = useRef(null)
  const previewStreamRef = useRef(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [previewOn, setPreviewOn] = useState(false)
  const [mode, setMode] = useState('camera')

  const {
    recording,
    formattedTime,
    blob,
    error,
    startCamera,
    startScreen,
    startPip,
    stopRecording,
    reset,
    streamRef,
    devices,
    selectedCamera,
    selectedMic,
    setSelectedCamera,
    setSelectedMic,
    refreshDevices,
  } = useRecorder()

  // Make a preview URL for the finished recording, and clean it up after.
  // (createObjectURL is a real side effect, so doing this in an effect is fine.)
  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlobUrl(url)
    return () => {
      URL.revokeObjectURL(url)
      setBlobUrl(null)
    }
  }, [blob])

  // Show the live stream in the preview while recording.
  useEffect(() => {
    if (recording && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [recording, streamRef])

  // Live camera preview while idle in camera mode, so you can frame the shot
  // before hitting record. Screen/PiP modes can't preview: the browser only
  // reveals the chosen screen once getDisplayMedia runs at record time.
  useEffect(() => {
    if (mode !== 'camera' || recording || blob) return
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
      })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        previewStreamRef.current = stream
        setPreviewOn(true)
        // Device labels only appear after a permission grant — refresh the
        // selector lists now that we have one.
        refreshDevices()
      })
      .catch(() => {
        // No preview (permission denied / no camera). "Start recording" will
        // surface a friendly error if the user goes ahead anyway.
      })
    return () => {
      cancelled = true
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(t => t.stop())
        previewStreamRef.current = null
      }
      setPreviewOn(false)
    }
    // refreshDevices is recreated each render but only re-enumerates devices;
    // including it would restart the camera preview on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, recording, blob, selectedCamera])

  // Attach the preview stream once its <video> is mounted.
  useEffect(() => {
    if (previewOn && previewVideoRef.current && previewStreamRef.current) {
      previewVideoRef.current.srcObject = previewStreamRef.current
    }
  }, [previewOn])

  // Release the preview camera before recording grabs it — some cameras can't
  // be opened twice at once.
  function handleStart() {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop())
      previewStreamRef.current = null
      setPreviewOn(false)
    }
    if (mode === 'camera') startCamera()
    else if (mode === 'screen') startScreen()
    else startPip()
  }

  const activeMode = MODES.find(m => m.id === mode)

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-950">
      <AppHeader>
        {recording && (
          <div className="mr-2 flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-medium tabular-nums text-red-700">{formattedTime}</span>
          </div>
        )}
        {blob && !recording && (
          <div className="mr-2 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">
              Ready · {(blob.size / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
        )}
      </AppHeader>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-5 px-4 py-8 sm:px-6">

        {/* Heading */}
        {!recording && (
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              {blob ? 'Review your recording' : 'New recording'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {blob
                ? 'Watch it back, then upload or record again.'
                : 'Everything is encrypted in your browser before upload.'}
            </p>
          </div>
        )}

        {/* Mode selector */}
        {!recording && !blob && (
          <div className="mx-auto inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
            {MODES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                  mode === id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Stage */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-sm">
          {recording ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-contain"
              />
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-gray-950/70 px-2.5 py-1 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-xs font-medium tabular-nums text-white">{formattedTime}</span>
              </div>
            </>
          ) : blobUrl ? (
            <video src={blobUrl} controls className="h-full w-full object-contain" />
          ) : previewOn ? (
            <video
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5">
                {activeMode && <activeMode.Icon size={20} />}
              </span>
              <p className="text-sm">
                {mode === 'camera'
                  ? 'Camera preview will appear here'
                  : 'You\u2019ll pick what to share when recording starts'}
              </p>
            </div>
          )}
        </div>

        {/* Device selectors — shown when the camera is involved (camera & PiP modes) */}
        {(mode === 'camera' || mode === 'pip') && !recording && !blob && (
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <DeviceSelect
              label="Camera"
              Icon={IconCamera}
              value={selectedCamera}
              onChange={e => setSelectedCamera(e.target.value)}
              options={devices.cameras}
              fallback="Default camera"
            />
            <DeviceSelect
              label="Microphone"
              Icon={IconMic}
              value={selectedMic}
              onChange={e => setSelectedMic(e.target.value)}
              options={devices.mics}
              fallback="Default microphone"
            />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!recording && !blob && (
            <button
              onClick={handleStart}
              className="group flex items-center gap-2.5 rounded-full bg-gray-900 py-2.5 pl-3 pr-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 transition-transform group-hover:scale-110">
                <span className="h-2 w-2 rounded-full bg-white" />
              </span>
              Start recording
            </button>
          )}

          {recording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2.5 rounded-full bg-red-600 py-2.5 pl-3 pr-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                <span className="h-2 w-2 rounded-[2px] bg-white" />
              </span>
              Stop recording
            </button>
          )}

          {blob && (
            <>
              <button
                onClick={reset}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Record again
              </button>
              <button
                onClick={() => navigate('/upload', { state: { blob } })}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
              >
                Upload & share
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        {/* Trust strip */}
        {!recording && !blob && (
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <IconLock size={15} />
              </span>
              <p className="text-xs leading-snug text-gray-500">
                <span className="font-medium text-gray-700">Encrypted locally</span>
                <br />before anything uploads
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <IconVideo size={15} />
              </span>
              <p className="text-xs leading-snug text-gray-500">
                <span className="font-medium text-gray-700">Stored on Sia</span>
                <br />decentralized, no central server
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <IconLink size={15} />
              </span>
              <p className="text-xs leading-snug text-gray-500">
                <span className="font-medium text-gray-700">Expiring links</span>
                <br />you decide how long they live
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
