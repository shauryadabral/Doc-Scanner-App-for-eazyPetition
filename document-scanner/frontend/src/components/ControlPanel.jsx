function ControlPanel({ isBusy, onRescan }) {
  return (
    <div className="control-panel">
      <button
        className="secondary-button"
        onClick={onRescan}
        disabled={isBusy}
      >
        New Scan
      </button>
    </div>
  )
}

export default ControlPanel
