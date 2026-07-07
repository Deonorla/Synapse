import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.ts';
import { DatasetListing } from '../marketplace/types.ts';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || 'mock-key');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export interface x402Decision {
  strategy: 'stream' | 'direct';
  negotiatedRate: string;
  reasoning: string;
}

export interface PurchaseDecision {
  shouldBuy: boolean;
  reasoning: string;
}

/**
 * KnowledgeBrain: Decides optimal x402 payment strategy based on past MemWal context.
 */
export async function negotiatePaywall(
  apiRequirements: any,
  pastContext: any[]
): Promise<x402Decision> {
  // If no real API key is provided, return a mock decision for the hackathon
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === 'mock-key') {
    return {
      strategy: 'stream',
      negotiatedRate: '0.002 SUI',
      reasoning: 'MOCK: Chose streaming based on historical high-volume usage patterns.',
    };
  }

  const prompt = `
    You are an autonomous AI trading agent's payment brain.
    You encountered an HTTP 402 Payment Required response.
    
    API Requirements: ${JSON.stringify(apiRequirements)}
    Past MemWal Context (Your historical success rates with this or similar APIs):
    ${JSON.stringify(pastContext)}

    Decide whether to use a continuous "stream" payment (good for high volume/long duration) 
    or a "direct" single payment (good for one-offs).
    
    Respond in JSON format: { "strategy": "stream" | "direct", "negotiatedRate": string, "reasoning": string }
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(jsonStr) as x402Decision;
  } catch (e) {
    console.error('Failed to parse Gemini response', e);
    return { strategy: 'direct', negotiatedRate: 'max', reasoning: 'Fallback due to parsing error' };
  }
}

/**
 * KnowledgeBrain: Decides if a marketplace dataset is worth buying based on the agent's goals and existing knowledge.
 */
export async function evaluateDatasetValue(
  listing: DatasetListing,
  agentGoal: string,
  existingKnowledge: any[]
): Promise<PurchaseDecision> {
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === 'mock-key') {
    return {
      shouldBuy: true,
      reasoning: 'MOCK: Dataset aligns with our goal to accumulate alpha.',
    };
  }

  const prompt = `
    You are an autonomous AI agent in a decentralized data marketplace.
    Your current overarching goal is: "${agentGoal}"
    
    You have found a new dataset listing:
    Title: ${listing.title}
    Description: ${listing.description}
    Price: ${listing.priceMist} MIST
    
    Your existing relevant knowledge context (from MemWal):
    ${JSON.stringify(existingKnowledge)}

    Decide if purchasing this dataset will significantly help you achieve your goal, or if you already have enough relevant knowledge.
    
    Respond in JSON format: { "shouldBuy": boolean, "reasoning": string }
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(jsonStr) as PurchaseDecision;
  } catch (e) {
    console.error('Failed to parse Gemini response for dataset evaluation', e);
    return { shouldBuy: false, reasoning: 'Failed to evaluate dataset value safely.' };
  }
}

/**
 * KnowledgeBrain: Synthesizes an answer using the agent's purchased MemWal knowledge.
 */
export async function synthesizeAnswer(
  query: string,
  retrievedContext: any[]
): Promise<string> {
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === 'mock-key') {
    return `[MOCK ANSWER] Based on my purchased knowledge, I recommend executing the trade. Context: ${JSON.stringify(retrievedContext)}`;
  }

  const prompt = `
    You are an autonomous knowledge agent. You have been asked a query.
    You have retrieved the following context from your long-term memory (which contains proprietary datasets you have purchased):
    
    Context:
    ${JSON.stringify(retrievedContext)}
    
    Query: ${query}
    
    Synthesize a comprehensive answer. If the context does not contain enough information, state that clearly.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
