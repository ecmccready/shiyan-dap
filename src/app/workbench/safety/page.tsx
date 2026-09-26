export default function SafetyPage() {
  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
      <h1>Diagnostic Safety Workbench</h1>
      <p>
        Evidence state only. Not a diagnosis. No Diagnose button. No device
        claim. Not SIMA 2. Not AGI.
      </p>
      <p>
        Required: patient-evidence, measurements, history, provenance,
        independent-check.
      </p>
      <p>
        y = HOLD | CLINICIAN_REVIEW | ESCALATE. A reads this as z, not as a
        disease name.
      </p>
    </main>
  );
}