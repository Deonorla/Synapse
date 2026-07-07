import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config({ path: '.env', override: true });

const envSchema = z.object({
  // Sui
  SUI_NETWORK: z.enum(['mainnet', 'testnet', 'devnet', 'localnet']).default('testnet'),
  SUI_PRIVATE_KEY: z.string().default(''),
  AGENT_WALLET_ENCRYPTION_KEY: z.string().min(32, "Encryption key must be at least 32 characters").default('1f9c8d7e6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e'),

  // MemWal
  MEMWAL_PRIVATE_KEY: z.string().default(''),
  MEMWAL_ACCOUNT_ID: z.string().default(''),
  MEMWAL_SERVER_URL: z.string().default('https://relayer.memwal.ai'),
  MEMWAL_NAMESPACE: z.string().default('synapse-agent'),

  // Walrus
  WALRUS_PUBLISHER_URL: z.string().url().default('https://publisher.walrus-testnet.walrus.space'),
  WALRUS_AGGREGATOR_URL: z.string().url().default('https://aggregator.walrus-testnet.walrus.space'),

  // Synapse Contracts
  SYNAPSE_PACKAGE_ID: z.string().default('0x_placeholder_synapse_package_id'),

  // Seal
  SEAL_PACKAGE_ID: z.string().default('0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d'),
  SEAL_KEY_SERVER_1: z.string().default('0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75'),
  SEAL_KEY_SERVER_2: z.string().default('0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8'),

  // AI
  GEMINI_API_KEY: z.string().default(''),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().default(''),

  // Server
  STORAGE_DRIVER: z.enum(['walrus', 'mock']).default('mock'),
  PORT: z.coerce.number().default(3002),
  AUTO_START: z.coerce.boolean().default(false),
});

// Force PORT to 3002 regardless of what is in the .env file to prevent Docker host mapping failures.
process.env.PORT = '3002';

export const env = envSchema.parse(process.env);

// Helper to check if we're running with real credentials
export const hasMemWalCredentials = Boolean(env.MEMWAL_PRIVATE_KEY && env.MEMWAL_ACCOUNT_ID);
export const hasGeminiKey = Boolean(env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY);
export const hasRealContracts = !env.SYNAPSE_PACKAGE_ID.includes('placeholder');
