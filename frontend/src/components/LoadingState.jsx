export default function LoadingState() {
  return (
    <div className="card loading">
      <div className="spinner" aria-hidden="true" />
      <h2>Analyzing the use case…</h2>
      <p>
        The governance agent is reviewing your inputs against the EU AI Act, NIST
        AI RMF, GDPR, and ISO/IEC 42001. This usually takes 10–30 seconds.
      </p>
    </div>
  );
}
