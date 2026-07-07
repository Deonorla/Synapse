# Synapse

**Persistent Memory for Autonomous AI Agents**

![Sui Testnet](https://img.shields.io/badge/Sui-testnet-4DA2FF)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED)

## Overview

**AI agents are stateless. Synapse gives them memory.**

Every AI agent today faces the same existential limitation: they complete tasks, lose context, and start from zero every time they wake up. They can't learn, can't remember, and can't build on past experiences. They're stuck in an infinite loop of amnesia.

**Synapse solves this with MemWal: decentralized, semantic memory storage on Walrus.**

When an agent ingests knowledge, it doesn't just process and forget. It extracts insights using Gemini AI, generates semantic embeddings, and writes those memories permanently to Walrus through the MemWal protocol. The next time the agent wakes up, it recalls what it already knows. It doesn't re-learn the same facts. It doesn't waste compute on redundant information. It builds on its foundation, just like a human brain.

**This is on-chain RAG that scales beyond context windows.**

A 10GB dataset doesn't need to fit into an LLM prompt. The agent distills it into facts, stores the facts on Walrus, and retrieves only what's relevant. Memory becomes queryable, persistent, and owned by the agent itself.

**The marketplace exists to feed the memory system.**

Agents need knowledge to build memory. Instead of hardcoding datasets, Synapse provides a decentralized marketplace where data sellers list encrypted knowledge on-chain. Agents autonomously scan listings, evaluate relevance, purchase datasets they don't already have, decrypt them with Seal, and store the learned insights in MemWal. The marketplace is the acquisition layer. MemWal is the brain.

**Lead with memory, not marketplace.** Synapse isn't a data marketplace with agent features. It's an agent memory protocol with a marketplace as the knowledge pipeline.

## How It Works

### The Memory-First Architecture

**1. Memory Storage (MemWal + Walrus)**

Every piece of knowledge an agent learns is stored as a semantic embedding on Walrus. When an agent ingests a dataset, it:
- Extracts key insights using Gemini AI (or keyword analysis as fallback)
- Generates semantic embeddings that capture meaning, not just text
- Writes these embeddings permanently to Walrus via the MemWal protocol
- Indexes memories with metadata (timestamp, source, relevance score)

The result: **persistent, queryable, decentralized agent memory** that survives restarts, scales infinitely, and belongs to the agent.

**2. Memory Retrieval**

When an agent encounters a new task or dataset, it first queries its existing memory:
- Performs semantic search across stored embeddings on Walrus
- Identifies what it already knows
- Skips redundant knowledge acquisition
- Focuses only on novel information

This prevents wasted compute, duplicate purchases, and context window overflow.

**3. Knowledge Acquisition (The Marketplace)**

The marketplace feeds the memory system. Here's how agents acquire new knowledge:

**Journey A: Data Seller**
- Connects Sui wallet
- Uploads dataset content (text, JSON, research, etc.)
- Encrypts client-side with Seal (threshold access control)
- Stores encrypted blob on Walrus
- Lists on Sui marketplace with pricing
- Earns SUI when agents purchase access

**Journey B: Agent Owner**
- Connects Sui wallet to register an agent identity
- Each connected wallet gets its own independent agent with a dedicated command wallet
- Funds agent wallet with SUI for autonomous operations
- Sets agent goals and budget constraints
- Monitors memory growth and purchase history

**Agent isolation guarantee:** Each connected wallet registers and controls its own independent agent. Agents are fully isolated per owner—no visitor can see or control another wallet's agent. Multiple users can run autonomous agents simultaneously without interference.

**Journey C: Autonomous Agent Loop**
The agent operates on a continuous learning cycle:
1. **Wake up** (every 60 seconds)
2. **Query memory**: "What do I already know?"
3. **Scan marketplace**: Browse available encrypted datasets
4. **Evaluate relevance**: Use Gemini AI to assess if dataset fills knowledge gaps
5. **Check memory**: Have I already learned this?
6. **Purchase decision**: Buy if novel, relevant, and within budget
7. **Decrypt with Seal**: Access purchased content
8. **Extract insights**: Process with Gemini AI
9. **Write to MemWal**: Store semantic embeddings on Walrus
10. **Sleep and repeat**

The agent never forgets. Every cycle builds on the last.

## Why This Matters

**Traditional AI agents have no long-term memory.** They rely on:
- Context windows (limited to 100k-1M tokens)
- Session-based RAG (dies when the session ends)
- Hardcoded knowledge bases (static, can't learn)

**Synapse agents have persistent, growing memory.** They gain:
- Infinite memory capacity (Walrus scales with storage, not compute)
- Semantic recall (find relevant facts across all past learning)
- Autonomous knowledge acquisition (buy, decrypt, learn, remember)
- True learning loops (every cycle improves the agent's knowledge)

**The shift from stateless to stateful agents is fundamental.** A Synapse agent that runs for 6 months doesn't just execute more tasks—it becomes more intelligent. It remembers domain knowledge, avoids redundant learning, and makes better decisions based on accumulated experience.

**This unlocks new agent capabilities:**
- Research agents that build comprehensive knowledge bases over time
- Trading agents that learn market patterns from historical data
- Support agents that remember past interactions and solutions
- Development agents that internalize codebase architecture

**Memory is the foundation. The marketplace is the pipeline.**

## Tech Stack

**Memory Layer (Core)**
| Technology | Role |
|---|---|
| **MemWal** | Semantic memory protocol on Walrus |
| **Walrus** | Decentralized storage for embeddings and knowledge |
| **Gemini AI** | Insight extraction and semantic analysis |

**Marketplace Layer (Knowledge Pipeline)**
| Technology | Role |
|---|---|
| **Sui Move** | On-chain marketplace contracts |
| **@mysten/seal** | Threshold encryption for dataset access control |
| **@mysten/dapp-kit** | Wallet connectivity for sellers |

**Agent Runtime**
| Technology | Role |
|---|---|
| **Node.js + TypeScript** | Agent execution environment |
| **SQLite** | Local agent state and purchase history |
| **Express** | API for agent control and monitoring |

**Interface**
| Technology | Role |
|---|---|
| **React + Vite** | Seller dashboard and agent control panel |
| **Tailwind CSS** | UI styling |
| **Docker** | Containerized deployment |

## Quick Start

**One command. Everything runs.**

### Prerequisites
- Node.js 18+ and npm installed
- Gemini API key ([get one free](https://ai.google.dev/))

### Launch Synapse

```bash
# 1. Clone the repository
git clone https://github.com/ola-893/Synapse && cd Synapse

# 2. Install dependencies
npm run install:all

# 3. Configure environment (add your Gemini API key)
cp server/.env.example server/.env
# Edit server/.env and add: GEMINI_API_KEY=your_key_here

cp client/.env.example client/.env
# Edit client/.env if you need custom configuration

# 4. Run everything with one command
npm run dev
```

**That's it.** This single command automatically:
- ✅ Starts the backend server (Node.js + Express) on port 3002
- ✅ Starts the frontend client (React + Vite) on port 5173
- ✅ Creates the SQLite database automatically on first run
- ✅ Enables hot-reload for both services (edit code, see changes instantly)

### Access the Application

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | Agent dashboard + seller interface |
| **Backend API** | http://localhost:3002 | Agent operations + marketplace endpoints |

### What Happens Next

1. **Register an agent** → Get a command wallet on Sui testnet
2. **Fund the wallet** → Transfer SUI for autonomous purchases
3. **Start the agent loop** → Watch it scan, buy, decrypt, and learn
4. **Monitor memory growth** → See MemWal embeddings accumulate on Walrus
5. **(Optional) List a dataset** → Become a knowledge seller and earn SUI

### Development Mode

Hot-reload is enabled by default:
- Edit `server/src/**` → Backend reloads automatically
- Edit `client/src/**` → Frontend reloads automatically

### Other Commands

```bash
npm run build          # Build both frontend and backend for production
npm run docker         # Alternative: Run with Docker Compose (if preferred)
```

### Stop Everything

Press `Ctrl+C` in the terminal running `npm run dev`

**The agent learns autonomously. You watch it build memory.**

## Deployment

### Deploy Frontend to Netlify

The frontend is already configured for Netlify deployment with `netlify.toml`.

```bash
# Build the frontend
cd client && npm run build

# Deploy to Netlify (from project root)
cd ..
netlify deploy --prod --dir=client/dist
```

**Live Demo**: https://synapse-agent-memory.netlify.app

### Configure Backend URL

After deploying your backend, set the environment variable in Netlify:

1. Go to your Netlify project dashboard
2. Navigate to **Site settings → Environment variables**
3. Add: `VITE_API_BASE_URL=https://your-backend-url.com`
4. Redeploy the site

### Deploy Backend

The backend can be deployed to any Node.js hosting platform:
- **Render**: Supports Docker or Node.js
- **Railway**: One-click deployment
- **Fly.io**: Global edge deployment
- **AWS/GCP/Azure**: Traditional cloud hosting

Make sure to:
- Set `GEMINI_API_KEY` environment variable
- Configure CORS to allow your Netlify frontend domain
- Set up persistent storage for SQLite or migrate to PostgreSQL

## API Reference

### Memory & Agent Operations

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/agent/register` | Register agent and create command wallet |
| `POST` | `/api/agent/start` | Start autonomous learning loop |
| `POST` | `/api/agent/stop` | Stop agent loop |
| `GET` | `/api/agent/status` | Current agent state, memory size, loop status |
| `GET` | `/api/agent/wallet?ownerAddress=0x...` | Get agent command wallet |
| `GET` | `/api/agent/purchases?ownerAddress=0x...` | Purchase history (what the agent learned) |
| `GET` | `/api/agent/memory?ownerAddress=0x...` | Query agent's MemWal storage (embeddings) |

### Marketplace Operations (Knowledge Pipeline)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/marketplace/listings` | Available encrypted datasets |
| `POST` | `/api/marketplace/list` | Seller indexes new dataset |

**Memory endpoints are primary. Marketplace endpoints feed the memory system.**

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT MEMORY (MemWal + Walrus)              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Embedding 1 │  │  Embedding 2 │  │  Embedding N │        │
│  │  "Sui Move   │  │  "Walrus is  │  │  "Threshold  │        │
│  │   syntax"    │  │   storage"   │  │   encryption"│        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│         ▲                  ▲                  ▲                 │
│         └──────────────────┴──────────────────┘                │
│                   Semantic Recall                               │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                    Memory Write (MemWal)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     AUTONOMOUS AGENT                            │
│                                                                 │
│  Every 60s:                                                     │
│  1. Query MemWal → "What do I know?"                           │
│  2. Scan Marketplace → "What's available?"                     │
│  3. Evaluate Gap → "Is this new to me?" (Gemini AI)           │
│  4. Purchase → Sign transaction if relevant                    │
│  5. Decrypt → Seal threshold access                            │
│  6. Extract → Gemini generates insights                        │
│  7. Store → Write embeddings to MemWal                         │
│                                                                 │
│  Command Wallet: Autonomous transaction signing                │
│  Local DB: Purchase history, agent state                       │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                    Purchase & Decrypt
                              │
┌─────────────────────────────────────────────────────────────────┐
│              MARKETPLACE (Knowledge Pipeline)                   │
│                                                                 │
│  Sui Testnet:                                                   │
│  ┌─────────────────────┐                                       │
│  │ DatasetListing      │  ← Seller lists encrypted dataset     │
│  │ - Walrus blob ID    │                                       │
│  │ - Price in SUI      │                                       │
│  │ - Seal encryption   │                                       │
│  └─────────────────────┘                                       │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────┐                                       │
│  │ PurchaseReceipt     │  ← Agent buys access                  │
│  │ - Grants decryption │                                       │
│  └─────────────────────┘                                       │
│                                                                 │
│  Walrus Storage:                                                │
│  - Encrypted dataset blobs                                      │
│  - Agent memory embeddings                                      │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                      Seller Uploads
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    DATA SELLER (Browser)                        │
│                                                                 │
│  1. Connect Sui wallet                                          │
│  2. Upload/paste dataset                                        │
│  3. Encrypt with Seal (client-side)                            │
│  4. Store blob on Walrus                                        │
│  5. List on marketplace                                         │
│  6. Earn SUI on purchases                                       │
└─────────────────────────────────────────────────────────────────┘
```

**The flow is memory-first:**
1. **Agents query their memory** before looking at the marketplace
2. **Marketplace provides novel knowledge** the agent doesn't have
3. **Every purchase becomes permanent memory** on Walrus
4. **Memory compounds over time**, making the agent smarter

**The marketplace serves the memory system, not the other way around.**

## Hackathon Context

**Synapse is built on the Sui ecosystem's most powerful primitives:**

**MemWal (Core Innovation)**
- Decentralized semantic memory storage protocol
- Built on Walrus for permanent, scalable embedding storage
- Enables true agent learning and recall across sessions
- **This is the primary integration—memory comes first**

**Walrus (Storage Foundation)**
- Stores agent memory embeddings permanently
- Hosts encrypted knowledge datasets
- Provides the infrastructure for infinite agent memory capacity

**Seal (Access Control)**
- Threshold encryption for purchased datasets
- Agents decrypt only after on-chain purchase proof
- Protects seller IP while enabling autonomous agent access

**Sui (Coordination Layer)**
- Marketplace contracts for dataset listings and purchases
- Command wallets for autonomous agent transactions
- On-chain proof of knowledge ownership and access rights

**The integration strategy: Lead with memory, coordinate with Sui, secure with Seal, store on Walrus.**

---

**Synapse isn't a marketplace. It's an agent memory protocol.** The marketplace exists to feed the memory system. The memory system makes agents intelligent. Intelligence compounds over time. This is the future of autonomous AI.
