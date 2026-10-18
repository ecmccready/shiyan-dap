export type GoalContract = {
  id: string;
  desired_outcome: string; // y*
  permitted_actions: string[];
  max_iterations: number;
  max_cost: number;
  success_condition: string; // measurable predicate
  require_approval_for: string[]; // irreversible / external
  created_at: string;
};

// Domain-agnostic abstraction (additive). See ./systemic.ts.
export type {
  SystemDomain,
  SystemicState,
  SystemicStatus,
  WorkbenchRun,
} from "./systemic";
