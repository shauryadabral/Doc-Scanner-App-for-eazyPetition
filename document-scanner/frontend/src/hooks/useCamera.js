import { useCallback, useEffect, useRef, useState } from "react"
import { CAMERA_WIDTH, CAMERA_HEIGHT } from "../utils/constants"

export function useCamera() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) return
      const constraints = {
        audio: false,
        video: {
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
          facingMode: { ideal: "environment" }
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setIsReady(true)
      setError(null)
    } catch (e) {
      setError(e)
      setIsReady(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsReady(false)
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef,
    isReady,
    error,
    startCamera,
    stopCamera
  }
}
