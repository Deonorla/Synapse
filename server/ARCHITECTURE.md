# Server Architecture

## Multi-Wallet Agent Isolation

The agent runtime supports multiple concurrent users, each with their own independent agent instance.

### Design

Each connected wallet address gets:
- Isolated runtime state (loop, tick count, logs)
- Independent command wallet for autonomous transactions
- Separate cron job for the agent's learning cycle
- Private purchase history and memory storage

### Implementation

Located in `src/agents/runtime.ts`:

```typescript
// Per-owner runtime state
const ownerRuntimeMap = new Map<string, OwnerRuntimeState>();

interface OwnerRuntimeState {
  task: cron.ScheduledTask | null;
  isRunning: boolean;
  tickCount: number;
  logs: Array<AgentLogEvent & { timestamp: string }>;
}
```

### Guarantees

- Starting agent for wallet A does not affect wallet B
- Stopping agent for wallet A does not stop wallet B
- Each agent maintains separate state and memory
- No cross-contamination of purchase history or logs

This architecture ensures that multiple hackathon judges or demo users can interact with the system simultaneously without interference.
