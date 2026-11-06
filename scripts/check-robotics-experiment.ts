import { MetamorphicEngine } from '../src/core/metamorphic';

console.log("🎲 Rolling the dice against the deterministic anchor...");
const initialSeed = { step: 1, observedValue: 0.85, predictedValue: 0.88, phi: 0.159 }; // Baseline Φ

const { emergentState, converged } = MetamorphicEngine.entangle(initialSeed);

console.log(`[Mutation Results] Next Step: ${emergentState.step}`);
console.log(`[Predicted vs Emergent] ${initialSeed.predictedValue} -> ${emergentState.observedValue}`);
console.log(`[System Identity .self()] New Φ: ${emergentState.phi} (Converged: ${converged})`);