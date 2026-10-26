import { workbenchRegistry } from '@/lib/workbench-registry';
import { musicStudioPlugin } from './music-studio';
import { diagnosticsSafetyPlugin } from './diagnostics-safety';

// Importing this module registers the built-in plugins (idempotent).
workbenchRegistry.registerPlugin(musicStudioPlugin);
workbenchRegistry.registerPlugin(diagnosticsSafetyPlugin);

export { workbenchRegistry };
