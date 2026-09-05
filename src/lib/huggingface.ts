export function hfEnabled() {
  return Boolean(process.env.HF_TOKEN);
}

export async function emitTrainingRecord(record: {
  clusterId: string;
  domain: string;
  input: string;
  cleaned?: string;
}) {
  if (!hfEnabled()) {
    return {
      ok: true,
      backend: "stub" as const,
      repo: "https://huggingface.co/shiyan-dap",
      reason: "HF_TOKEN missing — dataset emit is TODO",
    };
  }

  return {
    ok: true,
    backend: "queued" as const,
    repo: "https://huggingface.co/shiyan-dap",
    record,
  };
}