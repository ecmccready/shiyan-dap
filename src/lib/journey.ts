/** The proof-to-pilot customer journey: four steps over existing surfaces. Used by the journey notes and GET /api/v1/status. */
export const JOURNEY_BASE = 'https://shiyan-dap.vercel.app';

export interface JourneyStep {
  step: number;
  name: string;
  summary: string;
  primary: string;
  also: string[];
}

export const JOURNEY_STEPS: JourneyStep[] = [
  { step: 1, name: 'Declare the problem', summary: 'Customer states a measurable outcome, baseline, constraints and success threshold.', primary: '/workbench/outcome', also: ['/workbench/client'] },
  { step: 2, name: 'Bounded execution', summary: 'The existing Level 4 run executes under safety and budget gates and records execution entries.', primary: '/workbench/autonomous', also: ['/workbench/safety', '/workbench/history'] },
  { step: 3, name: 'Verify the evidence', summary: 'Replay and verify the run, read the measured e, change in e and Φ, disclose failed checks, export the evidence pack.', primary: '/workbench/result', also: ['/api/level4/verify', '/api/level4/anchor', '/api/v1/audit/summary'] },
  { step: 4, name: 'Validate the value', summary: 'Customer reviews the result and decides on a paid pilot; actual economic benefit is recorded by the customer outside the product today.', primary: '/workbench/pilot', also: ['/workbench/review', '/workbench/offer'] },
];

export const AGENT_ROLES_DOC_URL = 'https://github.com/ecmccready/shiyan-dap/blob/main/docs/agent-roles.md';
