import { useEffect, useRef, useState } from "react"
import {
  STABILITY_DIFF_THRESHOLD,
  STABILITY_MOVEMENT_THRESHOLD,
  STABILITY_HOLD_MS
} from "../utils/constants"

export function useStability(aligned, stabilityScore, movementVariance) {
  const [state, setState] = useState("align")
  const [isReady, setIsReady] = useState(false)
  const [stableForMs, setStableForMs] = useState(0)
  const stableStartRef = useRef(null)

  useEffect(() => {
    const now = performance.now()
    const movementOk = movementVariance <= STABILITY_MOVEMENT_THRESHOLD
    const diffOk = stabilityScore <= STABILITY_DIFF_THRESHOLD
    if (!aligned) {
      setState("align")
      setIsReady(false)
      setStableForMs(0)
      stableStartRef.current = null
      return
    }
    if (!movementOk || !diffOk) {
      setState("hold")
      setIsReady(false)
      setStableForMs(0)
      stableStartRef.current = null
      return
    }
    if (!stableStartRef.current) {
      stableStartRef.current = now
      setStableForMs(0)
      setState("hold")
      setIsReady(false)
    } else {
      const duration = now - stableStartRef.current
      setStableForMs(duration)
      if (duration >= STABILITY_HOLD_MS) {
        setState("ready")
        setIsReady(true)
      } else {
        setState("hold")
        setIsReady(false)
      }
    }
  }, [aligned, stabilityScore, movementVariance])

  return {
    state,
    isReady,
    stableForMs
  }
}
