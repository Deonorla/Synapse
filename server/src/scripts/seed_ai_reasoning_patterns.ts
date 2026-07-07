#!/usr/bin/env tsx
/**
 * Seed listing: Advanced AI Reasoning Techniques
 */
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  console.log('Creating: Advanced AI Reasoning Techniques\n');
  
  const content = {
    title: 'Advanced AI Reasoning Techniques for Autonomous Agents',
    category: 'AI Decision Making',
    techniques: [
      {
        name: 'Chain-of-Thought Prompting',
        description: 'Breaking complex problems into intermediate reasoning steps before arriving at final answers',
        implementation: 'Prefix decisions with "Let me think step by step:" to activate deeper reasoning paths',
        use_case: 'Complex multi-step tasks requiring logical progression'
      },
      {
        name: 'Tree-of-Thoughts',
        description: 'Exploring multiple reasoning branches in parallel, evaluating each path before committing',
        implementation: 'Generate 3-5 alternative approaches, score each, select highest confidence path',
        use_case: 'Uncertain decisions with multiple valid solutions'
      },
      {
        name: 'ReAct Pattern',
        description: 'Interleaving Reasoning (thought) with Actions (tool calls) in a loop until goal achieved',
        implementation: 'Thought → Action → Observation → Thought cycle with explicit state tracking',
        use_case: 'Dynamic environments requiring iterative refinement'
      },
      {
        name: 'Self-Consistency Sampling',
        description: 'Generate multiple independent reasoning paths, use majority vote for final decision',
        implementation: 'Temperature 0.7, sample 5 times, count most frequent conclusion',
        use_case: 'High-stakes decisions requiring validation'
      },
      {
        name: 'Meta-Cognitive Monitoring',
        description: 'Explicit confidence scoring and uncertainty detection before committing to actions',
        implementation: 'Assign 0-100 confidence scores, flag <60 as "needs-review", auto-approve >85',
        use_case: 'Risk management in autonomous operations'
      }
    ],
    best_practices: [
      'Always articulate reasoning before actions for auditability',
      'Use structured output formats (JSON) for machine-parseable decisions',
      'Maintain decision history for pattern learning and error analysis',
      'Implement circuit breakers: halt after 3 consecutive failed attempts',
      'Separate evaluation (read-only) from execution (write) phases'
    ],
    metrics: {
      decision_quality: 'Track correctness rate over rolling 100-decision window',
      reasoning_depth: 'Count intermediate steps per decision (target: 3-7 for complex tasks)',
      confidence_calibration: 'Compare stated confidence to actual success rate'
    },
    source: 'Synthesized from OpenAI, Anthropic, Google DeepMind research papers 2023-2024',
    created: new Date().toISOString()
  };
  
  const dataBytes = new TextEncoder().encode(JSON.stringify(content, null, 2));
  const policyIdBytes = crypto.randomBytes(32);
  const policyId = Buffer.from(policyIdBytes).toString('hex');
  
  console.log('Encrypting with Seal (SYNAPSE_PACKAGE_ID)...');
  const { encryptedObject } = await sealClient.encrypt({
    kemType: 0,
    demType: 1,
    threshold: 1,
    packageId: env.SYNAPSE_PACKAGE_ID,
    id: policyId,
    data: dataBytes
  });
  
  console.log(`✅ Encrypted ${dataBytes.length} bytes`);
  console.log('Uploading to Walrus (20 epochs)...');
  const uploadResult = await uploadToWalrus(new Uint8Array(encryptedObject), 20);
  console.log(`✅ Uploaded: ${uploadResult.blobId}`);
  
  console.log('Creating on-chain listing...');
  const listingId = await listDataset(
    [uploadResult.blobId],
    policyId,
    {
      title: 'Advanced AI Reasoning Techniques',
      description: 'Chain-of-Thought, Tree-of-Thoughts, ReAct patterns, and meta-cognitive monitoring for autonomous agent decision-making. Includes implementation guides and best practices. 20-epoch storage.',
    },
    8_000_000 // 0.008 SUI
  );
  
  console.log('\n✅ Listing Created!');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Price: 0.008 SUI`);
}

main().catch(console.error);
