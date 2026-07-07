#!/usr/bin/env tsx
/**
 * Seed listing: Memory Architecture for Long-Running AI Agents
 */
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  console.log('Creating: Memory Architecture for Long-Running AI Agents\n');
  
  const content = {
    title: 'Memory Architecture for Long-Running AI Agents',
    category: 'AI Systems Architecture',
    overview: 'Persistent memory is essential for agents that operate autonomously over weeks or months. Without memory, every decision starts from scratch. With memory, agents accumulate expertise and avoid repeating mistakes.',
    
    memory_layers: {
      short_term_working_memory: {
        description: 'Current context window - what the agent is thinking about right now',
        implementation: 'LLM native context (up to 200K tokens for Claude, 1M for Gemini)',
        duration: 'Single task or conversation (minutes to hours)',
        use_cases: ['Current conversation state', 'Intermediate reasoning steps', 'Temporary variables'],
        limitations: 'Lost when task completes, expensive to maintain, fixed size'
      },
      
      episodic_memory: {
        description: 'Specific events and experiences - what happened, when, and what was the outcome',
        implementation: {
          storage: 'MemWal on Walrus for permanent decentralized storage',
          structure: 'Each memory = {timestamp, event_type, context, action_taken, outcome, tags}',
          indexing: 'Vector embeddings for semantic similarity search',
          retrieval: 'Top-K most relevant memories based on current context'
        },
        duration: 'Permanent (years), unless explicitly forgotten',
        use_cases: [
          'Learning from past mistakes: "Last time I bought this type of data, it was low quality"',
          'Tracking interaction history: "I already have knowledge about this topic"',
          'Building trust: "This seller has provided accurate data 5 times before"'
        ],
        best_practices: [
          'Store outcome data: not just what happened, but whether it was good/bad',
          'Include confidence scores: how certain was the agent about this decision?',
          'Tag with themes: #purchase #evaluation #error for easier filtering',
          'Compress after 30 days: summarize similar events into higher-level insights'
        ]
      },
      
      semantic_knowledge_base: {
        description: 'General facts and concepts - what the agent knows about the world',
        implementation: {
          storage: 'Structured knowledge graph or vector database',
          structure: 'Entity-Relationship triples: (Subject, Predicate, Object)',
          examples: [
            '(Sui, is_a, blockchain)',
            '(Walrus, provides, decentralized_storage)',
            '(Seal, enables, threshold_encryption)'
          ],
          update_mechanism: 'Incremental learning - merge new knowledge with existing, resolve conflicts'
        },
        duration: 'Permanent with versioning (e.g., "SUI price was $2 on Jan 1, $3 on Feb 1")',
        use_cases: [
          'Domain expertise: technical details about protocols, best practices',
          'Contextual understanding: relationships between concepts',
          'Fact verification: check claims against known truths'
        ],
        acquisition: [
          'Purchased datasets from marketplaces (like Synapse)',
          'Web scraping and API integration',
          'User-provided corrections and feedback',
          'LLM-generated summaries of experiences'
        ]
      },
      
      procedural_memory: {
        description: 'How to do things - learned skills and procedures',
        implementation: {
          storage: 'Code snippets, workflow templates, decision trees',
          structure: 'IF-THEN rules or executable code',
          examples: [
            'Function: how to swap tokens on Cetus DEX',
            'Workflow: purchase decision process (evaluate → recall → compare → decide)',
            'Heuristic: "If gas price > 2x normal, wait 5 minutes before retrying"'
          ]
        },
        duration: 'Permanent with versioning (procedures improve over time)',
        use_cases: [
          'Task automation: reusable code for common operations',
          'Strategy templates: DeFi trading playbooks',
          'Error recovery: proven solutions to known problems'
        ],
        learning_mechanisms: [
          'Supervised: user provides correct procedure',
          'Reinforcement: trial-and-error with success/failure feedback',
          'Imitation: observe human expert, extract procedure',
          'Synthesis: LLM generates procedure from natural language description'
        ]
      }
    },
    
    memory_operations: {
      encoding: {
        description: 'Converting experiences into storable format',
        steps: [
          '1. Experience occurs (e.g., purchase dataset, execute transaction)',
          '2. Extract key information (what, when, why, outcome)',
          '3. Generate semantic embedding vector (e.g., 1536-dim from OpenAI)',
          '4. Add metadata (timestamp, tags, confidence, related entities)',
          '5. Store in MemWal with namespace isolation per agent'
        ],
        optimization: 'Batch encode multiple memories to reduce API calls'
      },
      
      retrieval: {
        description: 'Finding relevant memories when needed',
        strategies: [
          {
            name: 'Semantic Similarity',
            method: 'Embed current context, cosine similarity to stored memories, return top-K',
            tuning: 'K=5-10 for most tasks, increase for complex decisions'
          },
          {
            name: 'Temporal Recency',
            method: 'Weight recent memories higher (exponential decay)',
            formula: 'score = similarity * exp(-λ * days_old), where λ=0.1'
          },
          {
            name: 'Importance Filtering',
            method: 'Pre-filter by tags or metadata before similarity search',
            example: 'Only search #purchase memories when deciding to buy'
          },
          {
            name: 'Hierarchical Recall',
            method: 'First retrieve high-level summaries, then drill down to specific episodes',
            benefit: 'Faster for large memory stores (>10K memories)'
          }
        ],
        cost_optimization: [
          'Cache frequent queries: "What do I know about Sui DeFi?" → store result for 1 hour',
          'Lazy loading: only retrieve when decision requires it, not every loop',
          'Approximate search: use quantized embeddings (reduce dim 1536→384) for 4x speedup'
        ]
      },
      
      consolidation: {
        description: 'Periodically compress and organize memories for efficiency',
        techniques: [
          {
            name: 'Clustering',
            method: 'Group similar memories, replace with single summary',
            example: '10 memories of "bought low-quality data" → 1 memory "avoid seller X"',
            frequency: 'Weekly background job'
          },
          {
            name: 'Forgetting',
            method: 'Delete memories below relevance threshold',
            criteria: 'Not accessed in 90 days AND low importance score',
            caution: 'Keep all error/failure memories - they prevent repeat mistakes'
          },
          {
            name: 'Schema Evolution',
            method: 'Update memory structure as agent learns new categories',
            example: 'Initially: generic "knowledge" tag → Later: "DeFi", "Security", "Governance"'
          }
        ]
      },
      
      reflection: {
        description: 'Meta-level analysis of memory contents to extract insights',
        prompts: [
          '"What patterns do I see in my successful vs failed decisions?"',
          '"Which knowledge areas am I weakest in? (few memories, low confidence)"',
          '"Have my strategies improved over time? Compare month 1 vs month 3."'
        ],
        output: 'High-level insights stored as semantic knowledge',
        frequency: 'Daily for active agents, weekly for low-activity'
      }
    },
    
    architectural_patterns: {
      centralized_memory_service: {
        description: 'Single memory system shared across all agent tasks',
        pros: ['Unified knowledge', 'Easier to maintain', 'Cross-task learning'],
        cons: ['Single point of failure', 'Privacy concerns with shared memory'],
        best_for: 'Single-agent systems or trusted multi-agent teams'
      },
      
      distributed_per_agent_memory: {
        description: 'Each agent has isolated memory namespace',
        pros: ['Privacy preserved', 'Parallel scaling', 'Fault isolation'],
        cons: ['No knowledge sharing', 'Redundant storage'],
        best_for: 'Multi-tenant systems, competitive agent environments',
        implementation: 'MemWal namespace per agent address'
      },
      
      hierarchical_memory: {
        description: 'Personal memories + shared team knowledge base',
        pros: ['Balance privacy and collaboration', 'Reuse common knowledge'],
        structure: 'Local: agent-specific experiences. Global: domain facts, procedures',
        access_control: 'Read global (everyone), write global (reputation threshold)'
      }
    },
    
    performance_metrics: {
      memory_utilization: 'Total memories stored / Total experiences (target: 10-30%)',
      retrieval_precision: 'Relevant memories in top-K / K (target: >70%)',
      decision_improvement: 'Success rate month N / month N-1 (target: >1.0)',
      storage_cost: '$ per 1K memories per month (MemWal: ~$0.10 at current rates)',
      latency: 'Time from query to retrieved memories (target: <500ms)'
    },
    
    common_pitfalls: [
      {
        issue: 'Memory Overload',
        symptom: 'Agent retrieves too many memories, context window fills up',
        solution: 'Implement aggressive filtering, summarization before retrieval'
      },
      {
        issue: 'Stale Memories',
        symptom: 'Agent acts on outdated information',
        solution: 'Version all time-sensitive facts, check freshness before use'
      },
      {
        issue: 'Catastrophic Forgetting',
        symptom: 'New memories overwrite similar old ones, losing important history',
        solution: 'Pin critical memories (mark as permanent), use append-only storage'
      },
      {
        issue: 'Privacy Leakage',
        symptom: 'Sensitive data from one context bleeds into another',
        solution: 'Strict namespace isolation, encrypt memories at rest, audit access logs'
      }
    ],
    
    implementation_checklist: [
      '✓ Choose storage backend: MemWal (decentralized), Pinecone (managed), Chroma (self-hosted)',
      '✓ Design memory schema: what fields are essential for your use case?',
      '✓ Implement encoding pipeline: experience → structured data → embedding → storage',
      '✓ Build retrieval logic: query generation, similarity search, ranking',
      '✓ Add consolidation job: weekly cleanup, monthly reflection',
      '✓ Monitor metrics: track memory growth, retrieval relevance, decision outcomes',
      '✓ Test edge cases: empty memory (cold start), memory corruption, storage failure',
      '✓ Document memory strategy: future maintainers need to understand your design choices'
    ],
    
    resources: [
      'MemGPT: research on virtual context management for LLMs',
      'Voyager (MineDojo): lifelong learning agent with skill library',
      'LangChain Memory modules: production-ready implementations',
      'AutoGPT Memory architecture: lessons from early autonomous agents'
    ],
    
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
      title: 'Memory Architecture for Long-Running AI Agents',
      description: 'Comprehensive guide to persistent memory systems: episodic, semantic, and procedural memory layers, encoding/retrieval/consolidation operations, architectural patterns, and production implementation checklist. Essential for agents that learn and improve over time. 20-epoch storage.',
    },
    10_000_000 // 0.01 SUI
  );
  
  console.log('\n✅ Listing Created!');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Price: 0.01 SUI`);
}

main().catch(console.error);
