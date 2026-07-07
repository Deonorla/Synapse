#!/usr/bin/env tsx
/**
 * Check how many memories exist in the agent's MemWal namespace
 */
import dotenv from 'dotenv';
dotenv.config();

import { getMemWalClient, agentNamespace } from '../memory/memwal.ts';
import { getAgentWallet } from '../db/sqlite.ts';
import { env } from '../config/env.ts';

async function main() {
  console.log('Checking MemWal memory count for agent...\n');
  
  // Use the known agent address from previous debugging
  const agentAddress = '0x4e0cee6809c298c3f76ae651f257d0a9841abbcc1c5170d78424c263833f3c6b';
  
  const namespace = agentNamespace(agentAddress);
  console.log(`Agent Address: ${agentAddress}`);
  console.log(`MemWal Namespace: ${namespace}\n`);
  
  const client = getMemWalClient();
  
  // Try to recall with smaller limit
  console.log('Querying MemWal for memories (limit=20)...');
  try {
    const result = await client.recall({
      query: 'knowledge',
      limit: 20,
      namespace
    });
    
    console.log(`\nTotal memories retrieved: ${result.results.length}`);
    
    if (result.results.length > 0) {
      console.log('\nSample memories:');
      result.results.slice(0, 5).forEach((memory, idx) => {
        console.log(`\n${idx + 1}. Distance: ${memory.distance.toFixed(4)}`);
        console.log(`   Blob ID: ${memory.blob_id}`);
        console.log(`   Content (first 100 chars): ${memory.text.slice(0, 100)}...`);
      });
    } else {
      console.log('✓ No memories found in this namespace - clean state!');
    }
  } catch (error: any) {
    if (error.message?.includes('No memories found')) {
      console.log('✓ No memories found in this namespace - clean state!');
    } else {
      console.error('Error querying MemWal:', error.message || error);
    }
  }
}

main().catch(console.error);
