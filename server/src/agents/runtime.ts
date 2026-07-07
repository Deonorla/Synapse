import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import cron from 'node-cron';
import { getActiveListings } from '../marketplace/discovery.ts';
import { purchaseDatasetWithReceipt } from '../marketplace/buyer.ts';
import { saveAgentWallet, getAgentWallet, savePurchase, hasPurchased } from '../db/sqlite.ts';
import type { AgentLogEvent, DatasetListing } from '../marketplace/types.ts';
import { getMemWalClient, agentNamespace, isMemWalConfigured } from '../memory/memwal.ts';
import { synthesizeDataset, evaluateListingWithMemory } from '../memory/synthesizer.ts';
import { sealDecrypt } from '../seal/decrypt.ts';
import { createSessionKey, buildApprovalTransaction } from '../seal/session.ts';
import { env } from '../config/env.ts';

// Per-owner runtime state
interface OwnerRuntimeState {
  task: cron.ScheduledTask;
  lastTickTime: Date | null;
  isTickInProgress: boolean;
  tickCount: number;
  logBuffer: Array<AgentLogEvent & { timestamp: string }>;
}

const activeOwners = new Map<string, OwnerRuntimeState>();

import { initializeKeypair } from '../config/sui.ts';

const MAX_LOG_EVENTS = 100;

function createEmitter(ownerAddress: string): (event: AgentLogEvent) => void {
  return (event: AgentLogEvent) => {
    const state = activeOwners.get(ownerAddress);
    if (!state) return;
    
    const entry = { ...event, timestamp: new Date().toISOString() };
    state.logBuffer.push(entry);
    if (state.logBuffer.length > MAX_LOG_EVENTS) state.logBuffer.shift();
    console.log(`[Agent ${ownerAddress.slice(0, 8)}] ${event.phase}:`, JSON.stringify(event));
  };
}

export function getAgentLogs(ownerAddress: string): Array<AgentLogEvent & { timestamp: string }> {
  const state = activeOwners.get(ownerAddress);
  return state ? [...state.logBuffer] : [];
}

export async function getActiveAgentKeypair(ownerAddress: string): Promise<Ed25519Keypair | null> {
  if (!ownerAddress) return null;
  const wallet = await getAgentWallet(ownerAddress);
  if (!wallet) return null;
  // Use initializeKeypair to properly parse the bech32 key string
  return initializeKeypair(wallet.privateKeyStr);
}

async function decryptWithSeal(
  listing: DatasetListing,
  agentKeypair: Ed25519Keypair,
  rawBytes: Uint8Array,
  receiptId: string
): Promise<string> {
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  const sessionKey = await createSessionKey(agentAddress, agentKeypair);
  const txBytes = await buildApprovalTransaction(listing.id, receiptId, agentAddress, listing.sealPolicyId);
  return sealDecrypt(rawBytes, sessionKey, txBytes);
}

async function runAgentTick(ownerAddress: string) {
  const state = activeOwners.get(ownerAddress);
  if (!state) return;

  if (state.isTickInProgress) {
    createEmitter(ownerAddress)({ phase: 'TICK_COMPLETE', result: 'skipped', reason: 'Previous tick still in progress' });
    return;
  }

  state.isTickInProgress = true;
  state.tickCount++;
  console.log(`\n--- [Agent Tick #${state.tickCount} for ${ownerAddress.slice(0, 8)}] Waking up at ${new Date().toISOString()} ---`);
  state.lastTickTime = new Date();

  try {
    const walletData = await getAgentWallet(ownerAddress);
    if (!walletData) throw new Error('Agent wallet not found in database for owner');

    const agentKeypair = initializeKeypair(walletData.privateKeyStr);
    await executeAgentTick(walletData.agentAddress, agentKeypair, createEmitter(ownerAddress));
  } catch (error) {
    console.error(`[Agent ${ownerAddress.slice(0, 8)}] Error during tick:`, error);
    createEmitter(ownerAddress)({ phase: 'TICK_COMPLETE', result: 'error', error: String(error) });
  } finally {
    state.isTickInProgress = false;
  }
}

export async function executeAgentTick(
  agentAddress: string,
  agentKeypair: Ed25519Keypair,
  emitLog: (event: AgentLogEvent) => void
): Promise<void> {
  const namespace = agentNamespace(agentAddress);
  const memwalEnabled = isMemWalConfigured();
  const listings = await getActiveListings();

  // Phase 1: recall
  let existingMemories: Array<{ text: string; distance: number; blob_id: string }> = [];
  if (memwalEnabled) {
    try {
      const client = getMemWalClient();
      const topicQuery = listings.slice(0, 5).map((listing) => listing.title).join(', ') || 'Synapse marketplace knowledge';
      const recalled = await client.recall({ query: topicQuery, limit: 5, namespace });
      existingMemories = recalled.results;
      emitLog({
        phase: 'RECALL',
        status: existingMemories.length > 0 ? 'memories_found' : 'no_memories',
        count: existingMemories.length,
        preview: existingMemories.map((memory) => memory.text.slice(0, 80)),
      });
    } catch (err) {
      emitLog({ phase: 'RECALL', status: 'error', error: String(err) });
    }
  } else {
    emitLog({ phase: 'RECALL', status: 'disabled', reason: 'MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID not set' });
  }

  // Phase 2: evaluate
  if (!listings.length) {
    emitLog({ phase: 'EVALUATE', status: 'no_listings' });
    return;
  }

  let targetListing: DatasetListing | null = null;
  let buyReason = '';

  for (const listing of listings) {
    const listingId = listing.listingId || listing.id;
    const alreadyPurchased = await hasPurchased(agentAddress, listingId);
    if (alreadyPurchased) {
      emitLog({
        phase: 'EVALUATE',
        listing: listing.title,
        decision: 'SKIP',
        reason: 'Already purchased by this agent',
        memoryContext: 'local purchase history',
      });
      continue;
    }

    const { shouldBuy, reason, memoryContext } = await evaluateListingWithMemory(listing, namespace);
    emitLog({
      phase: 'EVALUATE',
      listing: listing.title,
      decision: shouldBuy ? 'BUY' : 'SKIP',
      reason,
      memoryContext,
    });

    if (shouldBuy) {
      targetListing = listing;
      buyReason = reason;
      break;
    }
  }

  if (!targetListing) {
    emitLog({
      phase: 'TICK_COMPLETE',
      result: 'no_action',
      reason: 'All listings evaluated - memory sufficient or no value found',
    });
    return;
  }

  const targetListingId = targetListing.listingId || targetListing.id;
  const targetBlobId = targetListing.blobId || targetListing.blobIds[0] || '';

  // Phase 3: purchase
  emitLog({ phase: 'PURCHASE', listing: targetListing.title, priceMist: targetListing.priceMist, reason: buyReason });
  let txDigest = '';
  let receiptId = '';
  try {
    const purchase = await purchaseDatasetWithReceipt(targetListing, agentKeypair);
    txDigest = purchase.txDigest;
    receiptId = purchase.receiptId;
    emitLog({ phase: 'PURCHASE', status: 'confirmed', txDigest, receiptId });
  } catch (err) {
    emitLog({ phase: 'PURCHASE', status: 'failed', error: String(err) });
    emitLog({ phase: 'TICK_COMPLETE', result: 'purchase_failed', listing: targetListing.title, error: String(err) });
    return;
  }

  // Phase 4: download
  emitLog({ phase: 'DOWNLOAD', blobId: targetBlobId });
  let rawBytes: Uint8Array;
  try {
    const walrusUrl = `${env.WALRUS_AGGREGATOR_URL.replace(/\/$/, '')}/v1/blobs/${targetBlobId}`;
    console.log(`[DOWNLOAD DEBUG] Full URL: ${walrusUrl}`);
    console.log(`[DOWNLOAD DEBUG] WALRUS_AGGREGATOR_URL from env: ${env.WALRUS_AGGREGATOR_URL}`);
    
    const response = await fetch(walrusUrl);
    console.log(`[DOWNLOAD DEBUG] HTTP Status: ${response.status}`);
    console.log(`[DOWNLOAD DEBUG] HTTP Status Text: ${response.statusText}`);
    console.log(`[DOWNLOAD DEBUG] Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Could not read error body');
      console.log(`[DOWNLOAD DEBUG] Error Response Body: ${errorBody}`);
      throw new Error(`Walrus HTTP ${response.status}: ${response.statusText} - Body: ${errorBody}`);
    }
    
    rawBytes = new Uint8Array(await response.arrayBuffer());
    emitLog({ phase: 'DOWNLOAD', status: 'success', bytes: rawBytes.length });
  } catch (err) {
    console.error(`[DOWNLOAD DEBUG] Raw error object:`, err);
    console.error(`[DOWNLOAD DEBUG] Error stack trace:`, err instanceof Error ? err.stack : 'No stack trace');
    console.error(`[DOWNLOAD DEBUG] Error name:`, err instanceof Error ? err.name : 'Unknown');
    console.error(`[DOWNLOAD DEBUG] Error message:`, err instanceof Error ? err.message : String(err));
    
    emitLog({ phase: 'DOWNLOAD', status: 'failed', error: String(err) });
    await savePurchase(agentAddress, {
      listingId: targetListingId,
      listingTitle: targetListing.title,
      amountMist: targetListing.priceMist,
      receiptId,
      txDigest,
    });
    emitLog({ phase: 'TICK_COMPLETE', result: 'download_failed', listing: targetListing.title, error: String(err) });
    return;
  }

  // Phase 5: decrypt
  let content: string;
  try {
    content = await decryptWithSeal(targetListing, agentKeypair, rawBytes, receiptId);
    emitLog({ phase: 'DECRYPT', status: 'seal_success', chars: content.length });
  } catch (err) {
    console.error(`[DECRYPT DEBUG] Seal decryption failed!`);
    console.error(`[DECRYPT DEBUG] Error name:`, err instanceof Error ? err.name : 'Unknown');
    console.error(`[DECRYPT DEBUG] Error message:`, err instanceof Error ? err.message : String(err));
    console.error(`[DECRYPT DEBUG] Error stack:`, err instanceof Error ? err.stack : 'No stack');
    console.error(`[DECRYPT DEBUG] Full error object:`, err);
    console.error(`[DECRYPT DEBUG] Listing ID:`, targetListing.id);
    console.error(`[DECRYPT DEBUG] Receipt ID:`, receiptId);
    console.error(`[DECRYPT DEBUG] Seal Policy ID:`, targetListing.sealPolicyId);
    console.error(`[DECRYPT DEBUG] Raw bytes length:`, rawBytes.length);
    console.error(`[DECRYPT DEBUG] Raw bytes sample (first 100):`, Buffer.from(rawBytes.slice(0, 100)).toString('hex'));
    
    content = Buffer.from(rawBytes).toString('utf-8');
    emitLog({ phase: 'DECRYPT', status: 'plaintext_fallback', chars: content.length, error: String(err) });
  }

  // Phase 6: synthesize
  emitLog({ phase: 'SYNTHESIZE', listing: targetListing.title });
  const synthesis = await synthesizeDataset(targetListing.title, content);
  emitLog({ phase: 'SYNTHESIZE', status: 'complete', preview: synthesis.slice(0, 150) });

  // Phase 7: remember
  let memoryBlobId: string | undefined;
  if (memwalEnabled) {
    try {
      const client = getMemWalClient();
      const memoryText = `[Dataset: ${targetListing.title}] Key insights: ${synthesis}`;
      emitLog({ phase: 'REMEMBER', status: 'storing', namespace });
      const result = await client.rememberAndWait(memoryText, namespace);
      memoryBlobId = result.blob_id;
      emitLog({
        phase: 'REMEMBER',
        status: 'confirmed',
        blobId: result.blob_id,
        walrusUrl: `https://walruscan.com/testnet/blob/${result.blob_id}`,
        namespace,
        message: 'Memory permanently stored on Walrus. Agent is now smarter.',
      });
    } catch (err) {
      emitLog({ phase: 'REMEMBER', status: 'failed', error: String(err) });
    }
  } else {
    emitLog({ phase: 'REMEMBER', status: 'disabled', reason: 'MemWal not configured' });
  }

  await savePurchase(agentAddress, {
    listingId: targetListingId,
    listingTitle: targetListing.title,
    amountMist: targetListing.priceMist,
    receiptId,
    txDigest,
    memoryBlobId,
  });

  emitLog({
    phase: 'TICK_COMPLETE',
    result: 'knowledge_acquired',
    listing: targetListing.title,
    memoryStored: Boolean(memoryBlobId),
    memoryBlobId,
  });
}

export async function registerAgent(config: { ownerPublicKey: string }): Promise<{ agentAddress: string }> {
  // Check if wallet already exists in the database
  const existingWallet = await getAgentWallet(config.ownerPublicKey);
  
  if (existingWallet) {
    console.log(`[Agent] Found existing wallet for owner: ${config.ownerPublicKey}`);
    return { agentAddress: existingWallet.agentAddress };
  }

  console.log(`[Agent] Generating new wallet for owner: ${config.ownerPublicKey}`);
  const newKeypair = new Ed25519Keypair();
  const agentAddress = newKeypair.getPublicKey().toSuiAddress();
  
  // getSecretKey returns the bech32 format starting with suiprivkey1...
  const privateKeyStr = newKeypair.getSecretKey();
  
  // Encrypt and save to DB
  await saveAgentWallet(config.ownerPublicKey, agentAddress, privateKeyStr);
  
  return { agentAddress };
}

export async function startAgentLoop(ownerAddress: string) {
  if (!ownerAddress) {
    throw new Error('ownerAddress is required to start an agent loop.');
  }

  // Ensure agent is registered
  await registerAgent({ ownerPublicKey: ownerAddress });

  // Check if already running for this owner
  if (activeOwners.has(ownerAddress)) {
    console.log(`[Agent] Loop already running for owner: ${ownerAddress.slice(0, 8)}`);
    return;
  }

  console.log(`[Agent] Starting loop for owner: ${ownerAddress.slice(0, 8)} (1-minute intervals)...`);
  
  // Create isolated state for this owner
  const state: OwnerRuntimeState = {
    task: cron.schedule('* * * * *', () => runAgentTick(ownerAddress)),
    lastTickTime: null,
    isTickInProgress: false,
    tickCount: 0,
    logBuffer: [],
  };

  activeOwners.set(ownerAddress, state);
  
  // Trigger first tick immediately
  runAgentTick(ownerAddress);
}

export function stopAgentLoop(ownerAddress: string) {
  if (!ownerAddress) {
    throw new Error('ownerAddress is required to stop an agent loop.');
  }

  const state = activeOwners.get(ownerAddress);
  if (!state) {
    console.log(`[Agent] No active loop found for owner: ${ownerAddress.slice(0, 8)}`);
    return;
  }

  console.log(`[Agent] Stopping loop for owner: ${ownerAddress.slice(0, 8)}...`);
  state.task.stop();
  activeOwners.delete(ownerAddress);
}

export async function getAgentStatus(ownerAddress: string) {
  if (!ownerAddress) {
    return {
      isRegistered: false,
      isRunning: false,
      agentAddress: null,
      ownerAddress: null,
      lastTickTime: null,
      tickCount: 0,
    };
  }

  const wallet = await getAgentWallet(ownerAddress);
  const state = activeOwners.get(ownerAddress);

  return {
    isRegistered: wallet !== null,
    isRunning: state !== undefined,
    agentAddress: wallet?.agentAddress || null,
    ownerAddress,
    lastTickTime: state?.lastTickTime || null,
    tickCount: state?.tickCount || 0,
  };
}
