import { classifyTypeHeuristically } from './src/lib/parsers/heuristic-classifier.js';
import { classifyAttestation } from './src/lib/attestation.js';

const testText = "Does the solution support mobile delivery? What types of mobile devices does the solution support? How is this achieved?";

console.log('Test text:', testText);
console.log('\n=== Type Classification ===');
const typeResult = classifyTypeHeuristically(testText);
console.log('Type:', typeResult.type);
console.log('Confidence:', typeResult.confidence);
console.log('Pattern:', typeResult.matchedPattern);

console.log('\n=== Attestation Classification ===');
const attestResult = classifyAttestation(testText);
console.log('isAttestation:', attestResult.isAttestation);
console.log('Confidence:', attestResult.confidence);
console.log('Reasoning:', attestResult.reasoning);
console.log('Signals:', attestResult.signals);
