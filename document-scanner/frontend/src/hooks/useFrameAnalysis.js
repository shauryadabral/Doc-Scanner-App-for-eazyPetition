import { useEffect, useRef, useState } from "react"
import { FRAME_ANALYSIS_INTERVAL_MS } from "../utils/constants"

export function useFrameAnalysis(videoRef) {
  const [analysis, setAnalysis] = useState({
    aligned: false,
    corners: null,
    stabilityScore: 0,
    movementVariance: 0,
    width: 0,
    height: 0
  })
  const workerRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/frameWorker.js", import.meta.url),
      { type: "module" }
    )
    workerRef.current = worker
    worker.onmessage = e => {
      const msg = e.data
      if (msg.type === "ANALYSIS_RESULT") {
        setAnalysis({
          aligned: msg.aligned,
          corners: msg.corners,
          stabilityScore: msg.stability_score,
          movementVariance: msg.movement_variance,
          width: msg.width,
          height: msg.height
        })
      }
    }
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!videoRef.current || !workerRef.current) return
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    const tick = () => {
      if (!video.videoWidth || !video.videoHeight) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      workerRef.current.postMessage(
        {
          type: "ANALYZE_FRAME",
          width: canvas.width,
          height: canvas.height,
          data: imageData.data.buffer
        },
        [imageData.data.buffer]
      )
    }

    timerRef.current = setInterval(tick, FRAME_ANALYSIS_INTERVAL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [videoRef])

  const processCapture = async () => {
    if (!videoRef.current || !workerRef.current) return null
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return new Promise(resolve => {
      const handleMessage = e => {
        const msg = e.data
        if (msg.type === "CAPTURE_RESULT") {
          workerRef.current.removeEventListener("message", handleMessage)
          resolve({
            imageData: new ImageData(
              new Uint8ClampedArray(msg.data),
              msg.width,
              msg.height
            )
          })
        }
      }
      workerRef.current.addEventListener("message", handleMessage)
      workerRef.current.postMessage(
        {
          type: "PROCESS_CAPTURE",
          width: canvas.width,
          height: canvas.height,
          data: imageData.data.buffer
        },
        [imageData.data.buffer]
      )
    })
  }

  return {
    analysis,
    processCapture
  }
}
