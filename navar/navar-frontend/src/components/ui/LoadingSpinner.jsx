export default function LoadingSpinner({ label = 'Loading', showLabel = false }) {
  return <span className="table-loading" role="status" aria-label={label}>
    <span className="table-loading-spinner" aria-hidden="true" />
    {showLabel && <span>{label}</span>}
  </span>
}
