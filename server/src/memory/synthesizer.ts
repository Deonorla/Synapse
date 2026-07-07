import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { withMemWal } from '@mysten-incubation/memwal/ai';
import { getMemWalConfig, isMemWalConfigured } from './memwal.ts';

const MAX_INPUT_CHARS = 6000;
const DEFAULT_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

type EvaluationResult = {
  shouldBuy: boolean;
  reason: string;
  memoryContext: string;
};

function candidateModels() {
  return Array.from(new Set([process.env.GEMINI_MODEL, ...DEFAULT_MODELS].filter(Boolean))) as string[];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function synthesizeDataset(title: string, rawContent: string): Promise<string> {
  const truncated = rawContent.slice(0, MAX_INPUT_CHARS);

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const lines = rawContent.split('\n').filter((line) => line.trim().length > 20).slice(0, 10);
    return `[${title}] Key content: ${lines.join(' | ')}`;
  }

  for (const modelName of candidateModels()) {
    try {
      const { text } = await generateText({
        model: google(modelName),
        prompt: `You are an autonomous AI agent that just purchased a dataset from a blockchain marketplace called Synapse.

Dataset title: "${title}"
Raw content sample (${truncated.length} chars):
---
${truncated}
---

Extract the 3-5 most important, concrete, actionable facts from this dataset.
An autonomous trading/research agent should remember these for future decision-making.
Include specific numbers, dates, patterns, or rules if present.
Write as a dense paragraph of key facts (max 300 words). No preamble.`,
      });
      return text.trim();
    } catch (err) {
      console.warn(`[Synthesizer] Gemini synthesis failed for ${modelName}:`, errorMessage(err));
    }
  }

  return `[${title}] Content acquired. Key excerpt: ${truncated.slice(0, 400)}`;
}

export async function evaluateListingWithMemory(
  listing: { title: string; description: string; priceMist: number },
  namespace?: string
): Promise<EvaluationResult> {
  if (listing.priceMist > 100_000_000) {
    return {
      shouldBuy: false,
      reason: `Price ${listing.priceMist / 1e9} SUI exceeds 0.1 SUI limit`,
      memoryContext: 'price gate',
    };
  }

  if (isMemWalConfigured() && (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)) {
    for (const modelName of candidateModels()) {
      try {
        const memoryAwareModel = withMemWal(google(modelName), {
          ...getMemWalConfig(namespace),
          autoSave: false,
        });

        const { text } = await generateText({
          model: memoryAwareModel,
          messages: [{
            role: 'user',
            content: `You are an autonomous AI agent managing your own knowledge acquisition budget on the Synapse marketplace.

Based on everything you already know and remember, evaluate this new dataset:
Title: "${listing.title}"
Description: "${listing.description}"
Price: ${listing.priceMist / 1e9} SUI

Decision criteria:
1. If your memory already covers this topic well -> skip (don't re-buy knowledge you have)
2. If this represents a genuine knowledge gap -> buy
3. If the price is unreasonably high for the value -> skip

Reply with valid JSON only (no markdown, no explanation outside JSON):
{"buy": true, "reason": "one concise sentence explaining the decision"}`,
          }],
        });

        const clean = text.trim().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        return {
          shouldBuy: Boolean(parsed.buy),
          reason: parsed.reason || 'Memory-aware Gemini decision',
          memoryContext: `MemWal memory injected via withMemWal (${modelName})`,
        };
      } catch (err) {
        console.warn(`[Evaluator] withMemWal evaluation failed for ${modelName}:`, errorMessage(err));
      }
    }
  }

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    for (const modelName of candidateModels()) {
      try {
        const { text } = await generateText({
          model: google(modelName),
          prompt: `Should an autonomous AI agent buy this dataset?
Title: "${listing.title}"
Description: "${listing.description}"
Price: ${listing.priceMist / 1e9} SUI
Reply JSON only: {"buy": true/false, "reason": "one sentence"}`,
        });
        const parsed = JSON.parse(text.trim().replace(/```json|```/g, '').trim());
        return {
          shouldBuy: Boolean(parsed.buy),
          reason: `[no memory context] ${parsed.reason}`,
          memoryContext: `plain Gemini fallback (${modelName})`,
        };
      } catch (err) {
        console.warn(`[Evaluator] plain Gemini evaluation failed for ${modelName}:`, errorMessage(err));
      }
    }
  }

  const keywords = [
    'agent', 'trade', 'trading', 'signal', 'market', 'data', 'defi',
    'protocol', 'sui', 'blockchain', 'coordination', 'deepbook', 'rwa', 'log',
    'intelligence', 'on-chain', 'knowledge', 'strategy', 'execution',
  ];
  const haystack = `${listing.title} ${listing.description}`.toLowerCase();
  const match = keywords.find((keyword) => haystack.includes(keyword));
  return match
    ? {
        shouldBuy: true,
        reason: `Keyword match: "${match}" - relevant to agent knowledge domain`,
        memoryContext: 'keyword fallback (memory-aware model unavailable)',
      }
    : {
        shouldBuy: false,
        reason: 'No relevant topic keywords found',
        memoryContext: 'keyword fallback (memory-aware model unavailable)',
      };
}
