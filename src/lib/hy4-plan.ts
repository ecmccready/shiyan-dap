export function getHy4Plan() {
  return {
    status: "planned",
    mode: process.env.HY4_API_URL ? "live" : "stubbed",
    principle: "Grok Bot routes to Hy4 through the model adapter. No page talks to AWS directly.",
    target: {
      cloud: "AWS",
      compute: "GPU instance or inference endpoint",
      storage: "S3 for model artifacts",
      region: "us-west-2",
      endpointEnv: "HY4_API_URL",
    },
    steps: [
      "Keep current stub in model-adapter.ts",
      "Package quantized Hy4 for inference",
      "Deploy Hy4 behind one HTTPS endpoint",
      "Set HY4_API_URL in env",
      "Leave router, agent, Bot, and pages unchanged",
    ],
    routing: {
      fast: "Grok only",
      deep: "Grok + Hy4 in parallel",
    },
    lockIn: false,
  };
}