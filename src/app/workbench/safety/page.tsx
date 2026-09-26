import { demoUnresolved } from "@/lib/safety";

export default function SafetyPage() {
  const state = demoUnresolved();
  return (
    <main>
      <h1>Diagnostic Safety Workbench</h1>
      <p className="lead">
        Evidence completeness and contradiction check. Not a diagnosis. No
        Diagnose button. No device claim.
      </p>
      <div className="card">
        <p>
          status: <b className="warn">{state.status}</b> · y:{" "}
          <b className="bad">{state.y}</b>
        </p>
        <p>{state.e}</p>
        <p className="mono">{state.limitation}</p>
        <h3>Required</h3>
        <ul>
          {state.required.map((k) => (
            <li key={k}>
              {k}{" "}
              {state.available.includes(k) ? (
                <span className="ok">available</span>
              ) : (
                <span className="bad">missing</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}