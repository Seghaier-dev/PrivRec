import { useState, useRef, useEffect } from 'react'

function friendlyMediaError(e, source) {
  const msg = (e && e.name ? e.name : '') + ' ' + (e && e.message ? e.message : '')
  if (/NotAllowedError|PermissionDeniedError/i.test(msg)) {
    return `${source} access was denied. Allow access in your browser settings and try again.`
  }
  if (/NotFoundError|DevicesNotFoundError/i.test(msg)) {
    return `No ${source.toLowerCase()} found. Plug one in and try again.`
  }
  if (/NotReadableError|TrackStartError/i.test(msg)) {
    return `${source} is in use by another app. Close it and try again.`
  }
  return `Could not start ${source.toLowerCase()}. Check your browser permissions.`
}

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [blob, setBlob] = useState(null)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState({ cameras: [], mics: [] })
  const [selectedCamera, setSelectedCamera] = useState('')
  const [selectedMic, setSelectedMic] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const recordingRef = useRef(false)

  // On unmount: stop the recorder, then the tracks, then the timer.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && recordingRef.current) {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      clearInterval(timerRef.current)
    }
  }, [])

  // Load the device list. Labels come back empty until the user grants permission,
  // so startCamera calls this again afterwards to get real names.
  // setDefaults=true only on the first call — sets selectedCamera/Mic from the
  // first available device if they haven't been chosen yet.
  async function loadDevices(setDefaults = false) {
    const all = await navigator.mediaDevices.enumerateDevices()
    const cameras = all.filter(d => d.kind === 'videoinput')
    const mics = all.filter(d => d.kind === 'audioinput')
    setDevices({ cameras, mics })
    if (setDefaults) {
      if (cameras.length) setSelectedCamera(prev => prev || cameras[0].deviceId)
      if (mics.length) setSelectedMic(prev => prev || mics[0].deviceId)
    }
  }

  useEffect(() => {
    // setError below only runs if device enumeration rejects, not synchronously
    // during the effect, so the cascading-render concern doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDevices(true).catch(() => {
      setError('Could not load camera/microphone list. Check your browser permissions.')
    })
  }, []) // loadDevices is stable within this render; setDefaults=true is intentional on mount

  function getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ]
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type
    }
    // Empty string = let MediaRecorder pick its default (webm on Chromium).
    return ''
  }

  async function startCamera() {
    setError('')
    setBlob(null)
    try {
      const constraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      // Refresh the device list now that we have permission — labels only show
      // up after the first getUserMedia call. Don't override the user's selection.
      await loadDevices(false)
      beginRecording(stream)
    } catch (e) {
      setError(friendlyMediaError(e, 'Camera'))
    }
  }

  async function startScreen() {
    setError('')
    setBlob(null)
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      streamRef.current = screen
      beginRecording(screen)
    } catch (e) {
      setError(friendlyMediaError(e, 'Screen'))
    }
  }

  function beginRecording(stream) {
    chunksRef.current = []
    const mimeType = getSupportedMimeType()
    const options = mimeType ? { mimeType } : {}
    const recorder = new MediaRecorder(stream, options)

    // If the user stops sharing with the browser's own "Stop sharing" button
    // (not ours), the track ends by itself — catch that so we still finalize the
    // recording instead of hanging.
    stream.getTracks().forEach(t => {
      t.onended = () => stopRecording()
    })

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = () => {
      const finalBlob = new Blob(chunksRef.current, {
        type: mimeType || 'video/webm',
      })
      setBlob(finalBlob)
      stream.getTracks().forEach(t => t.stop())
      clearInterval(timerRef.current)
      setRecordingTime(0)
      setRecording(false)
    }

    recorder.start(1000)
    mediaRecorderRef.current = recorder
    recordingRef.current = true
    setRecording(true)

    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recordingRef.current) {
      // Clear the flag synchronously before calling stop() so a concurrent
      // track-ended event can't fire a second stop() while the first is in flight,
      // which would throw InvalidStateError on an already-inactive MediaRecorder.
      recordingRef.current = false
      mediaRecorderRef.current.stop()
    }
  }

  function reset() {
    setBlob(null)
    setError('')
    setRecordingTime(0)
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return {
    recording,
    formattedTime: formatTime(recordingTime),
    blob,
    error,
    startCamera,
    startScreen,
    stopRecording,
    reset,
    streamRef,
    devices,
    selectedCamera,
    selectedMic,
    setSelectedCamera,
    setSelectedMic,
  }
}
