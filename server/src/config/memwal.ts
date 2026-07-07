import { env, hasMemWalCredentials } from './env.ts';

/**
 * MemWal client interface matching the real SDK shape.
 */
export interface IMemWalClient {
  remember(text: string): Promise<{ id: string }>;
  recall(query: string): Promise<string[]>;
  restore(): Promise<void>;
}

/**
 * Real MemWal client wrapper that delegates to the @mysten-incubation/memwal SDK.
 */
class RealMemWalClient implements IMemWalClient {
  private client: any | null = null;
  private initPromise: Promise<void> | null = null;
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.client) return;
    this.initPromise ??= this.initialize();
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      const { MemWal } = await import('@mysten-incubation/memwal');
      this.client = MemWal.create({
        key: env.MEMWAL_PRIVATE_KEY,
        accountId: env.MEMWAL_ACCOUNT_ID,
        serverUrl: env.MEMWAL_SERVER_URL || 'https://relayer.memwal.ai',
      });
      console.log(`[MemWal:Real] Connected to MemWal relayer for namespace "${this.namespace}"`);
    } catch (error) {
      console.error(`[MemWal:Real] Failed to initialize MemWal SDK:`, error);
      throw error;
    }
  }

  async remember(text: string): Promise<{ id: string }> {
    try {
      await this.ensureInitialized();
      const job = await this.client.remember(text, this.namespace);
      if (job?.job_id) {
        await this.client.waitForRememberJob(job.job_id);
      }
      console.log(`[MemWal:Real] Stored memory: "${text.substring(0, 60)}..."`);
      return { id: job?.job_id || 'unknown' };
    } catch (error) {
      console.error(`[MemWal:Real] remember() failed:`, error);
      throw error;
    }
  }

  async recall(query: string): Promise<string[]> {
    try {
      await this.ensureInitialized();
      const results = await this.client.recall({ query, limit: 10, namespace: this.namespace });
      const texts = (results.results || []).map((r: any) => r.text || r.content || JSON.stringify(r));
      console.log(`[MemWal:Real] Recalled ${texts.length} memories for query: "${query.substring(0, 40)}"`);
      return texts;
    } catch (error) {
      console.error(`[MemWal:Real] recall() failed:`, error);
      return [];
    }
  }

  async restore(): Promise<void> {
    console.log(`[MemWal:Real] Restore initiated for namespace "${this.namespace}"`);
  }
}

// --- Singleton cache ---
const clientCache = new Map<string, IMemWalClient>();

/**
 * Returns a MemWal client for the given agent address.
 * Uses the real SDK only. Missing credentials should surface clearly instead of
 * pretending memory was persisted.
 */
export function getMemWal(agentAddress: string): IMemWalClient {
  const namespace = `${env.MEMWAL_NAMESPACE}-${agentAddress}`;

  if (clientCache.has(namespace)) {
    return clientCache.get(namespace)!;
  }

  if (!hasMemWalCredentials) {
    throw new Error(
      'MemWal not configured. Set MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID in server/.env.'
    );
  }

  const client = new RealMemWalClient(namespace);
  clientCache.set(namespace, client);
  return client;
}
