export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <span className="ui-spinner" role="status" aria-live="polite">
      <span className="ui-spinner-ring" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
