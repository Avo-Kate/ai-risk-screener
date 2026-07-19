// Spinner card. Defaults describe the (long) assessment run; pass title and
// message for other waits (auth checks, fetches).
export default function LoadingState({
  title = "Analyzing the use case…",
  message = "The governance agent is reviewing your inputs against the EU AI Act, " +
    "NIST AI RMF, GDPR, and ISO/IEC 42001. This usually takes 10–30 seconds.",
}) {
  return (
    <div className="card loading">
      <div className="spinner" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
