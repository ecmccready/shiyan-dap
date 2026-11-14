// Opt-in storage diagnostics. When SHIYAN_STORAGE_DIAGNOSTICS=1, logs a single
// line with the operation name, Postgres (or driver) error code, and error class.
// Never logs message text, URLs, or passwords. Default off: a no-op.
export type DiagnosticEnv = Record<string, string | undefined>;

const SAFE_CODE = /^[A-Za-z0-9_]{1,64}$/;
const SAFE_CLASS = /^[A-Za-z0-9_]{1,128}$/;

export function storageDiagnosticsEnabled(env: DiagnosticEnv = process.env): boolean {
  return env.SHIYAN_STORAGE_DIAGNOSTICS === "1";
}

/** Extract a log-safe Postgres/driver code. Rejects values that look like URLs or messages. */
export function diagnosticErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string" || !SAFE_CODE.test(code)) return "";
  return code;
}

export function diagnosticErrorClass(error: unknown): string {
  if (typeof error !== "object" || error === null) return "unknown";
  const name = (error as { constructor?: { name?: unknown } }).constructor?.name;
  if (typeof name === "string" && SAFE_CLASS.test(name)) return name;
  return "unknown";
}

/**
 * Writes one diagnostic line to `out` (defaults to console.error) when the
 * env flag is exactly "1". Otherwise does nothing.
 */
export function logStorageDiagnostic(
  operation: string,
  error: unknown,
  env: DiagnosticEnv = process.env,
  out: (line: string) => void = (line) => { console.error(line); },
): void {
  if (!storageDiagnosticsEnabled(env)) return;
  const op = typeof operation === "string" && SAFE_CLASS.test(operation.replace(/\./g, "_"))
    ? operation
    : "unknown";
  const code = diagnosticErrorCode(error);
  const cls = diagnosticErrorClass(error);
  out(`shiyan storage diagnostics operation=${op} code=${code} class=${cls}`);
}
