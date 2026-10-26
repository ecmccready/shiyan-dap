import { workbenchRegistry } from '@/lib/workbench-registry';
import { musicStudioPlugin } from './music-studio';
import { diagnosticsSafetyPlugin } from './diagnostics-safety';
import { agentComputePlugin } from './agent-compute';

// Importing this module registers the built-in plugins (idempotent).
workbenchRegistry.registerPlugin(musicStudioPlugin);
workbenchRegistry.registerPlugin(diagnosticsSafetyPlugin);
workbenchRegistry.registerPlugin(agentComputePlugin);

export { workbenchRegistry };
