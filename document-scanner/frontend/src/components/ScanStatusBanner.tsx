import { ScanPhase } from "../App";

type Props = {
  phase: ScanPhase;
  message: string;
};

function phaseColor(phase: ScanPhase): string {
  if (phase === "ready") return "status-ready";
  if (phase === "holding" || phase === "processing" || phase === "capturing")
    return "status-warn";
  if (phase === "error") return "status-error";
  return "status-neutral";
}

export function ScanStatusBanner({ phase, message }: Props) {
  return (
    <div className={`status-banner ${phaseColor(phase)}`}>
      <span className="status-label">{message}</span>
    </div>
  );
}
