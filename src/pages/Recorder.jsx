import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hardReset } from '../lib/sia'
import { useRecorder } from '../hooks/useRecorder'

export default function Recorder() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [mode, setMode] = useState('camera')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

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

  // Close the account menu when you click anywhere outside it.
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    hardReset()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">

        {/* Left: Logo */}
        <span className="text-lg font-semibold tracking-tight">PrivRec</span>

        {/* Center: Mode selector tabs */}
        {!recording && !blob && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setMode('camera')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'camera'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📷 Camera
            </button>
            <button
              onClick={() => setMode('screen')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'screen'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🖥️ Screen
            </button>
            <button
              onClick={() => setMode('pip')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'pip'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🖼️ Screen + Camera
            </button>
          </div>
        )}

        {/* Ready indicator after recording stops */}
        {blob && (
          <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-600">
              Ready · {(blob.size / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
        )}

        {/* Recording indicator in header when recording */}
        {recording && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono text-red-600">{formattedTime}</span>
          </div>
        )}

        {/* Right: History link + account menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/history')}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            My recordings
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-10">
                <button
                  onClick={() => navigate('/account')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Account stats
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-50 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-8">

        {/* Preview area */}
        <div className="w-full max-w-2xl aspect-video bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
          {recording ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : blobUrl ? (
            <video
              src={blobUrl}
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <p className="text-gray-400 text-sm">Preview will appear here</p>
          )}
        </div>

        {/* Device selectors — shown when the camera is involved (camera & PiP modes) */}
        {(mode === 'camera' || mode === 'pip') && !recording && !blob && (
          <div className="flex gap-3 w-full max-w-xl">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Camera</label>
              <select
                value={selectedCamera}
                onChange={e => setSelectedCamera(e.target.value)}
                className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              >
                {devices.cameras.length === 0 && <option>Default camera</option>}
                {devices.cameras.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Camera'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Microphone</label>
              <select
                value={selectedMic}
                onChange={e => setSelectedMic(e.target.value)}
                className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              >
                {devices.mics.length === 0 && <option>Default microphone</option>}
                {devices.mics.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Microphone'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Controls */}
        {!recording && !blob && (
          <button
            onClick={
              mode === 'camera' ? startCamera : mode === 'screen' ? startScreen : startPip
            }
            className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Start recording
          </button>
        )}

        {recording && (
          <button
            onClick={stopRecording}
            className="px-8 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
          >
            ■ Stop recording
          </button>
        )}

        {blob && (
          <div className="flex gap-4">
            <button
              onClick={reset}
              className="px-6 py-3 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Record again
            </button>
            <button
              onClick={() => navigate('/upload', { state: { blob } })}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Upload & share →
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

      </div>
    </div>
  )
}
