import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Play,
  Square,
  Terminal,
  Bookmark,
  Copy,
  CheckCircle2,
  Wallet,
  Bot,
  Cpu,
} from 'lucide-react';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AgentLogEntry, type DatasetListing, type MemoryRecallResult } from '../lib/api';
import { formatAddress, formatMist } from '../lib/sui';

interface AgentWalletProps {
  wallet: {
    address: string;
    seedPhrase: string;
    privateKey: string;
    balance: number;
    toggleLoop: boolean;
    interests: string;
    maxBudgetPurchase: number;
  };

}

interface AgentLog {
  id: string;
  timestamp: string;
  action: string;
  type: 'info' | 'success' | 'warning' | 'error';
  details?: string;
}

function evaluateListing(listing: DatasetListing) {
  const text = `${listing.title} ${listing.description}`.toLowerCase();
  const matchesGoal = text.includes('alpha') || text.includes('signal');
  const affordable = listing.priceMist <= 10_000_000;
  return { matchesGoal, affordable, shouldBuy: matchesGoal && affordable };
}

const PHASE_COLORS: Record<string, string> = {
  RECALL: '#00e5ff',
  EVALUATE: '#ffd700',
  PURCHASE: '#ff8c00',
  DOWNLOAD: '#4DA2FF',
  DECRYPT: '#b388ff',
  SYNTHESIZE: '#69ff47',
  REMEMBER: '#00ff88',
  TICK_COMPLETE: '#ffffff',
};

function shortId(value?: string) {
  if (!value) return '';
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function getSuiScanUrl(txDigestOrAddress: string, type: 'tx' | 'object' | 'account' = 'tx', network: string = 'testnet') {
  return `https://suiscan.xyz/${network}/${type}/${txDigestOrAddress}`;
}

function getWalrusScanUrl(blobId: string, network: string = 'testnet') {
  return `https://walruscan.com/${network}/blob/${blobId}`;
}

function formatAgentLog(log: AgentLogEntry): string | JSX.Element {
  if (log.phase === 'REMEMBER' && log.status === 'confirmed') {
    return (
      <span>
        MEMORY STORED{' '}
        {log.blobId && (
          <>
            blob_id=
            <a
              href={getWalrusScanUrl(log.blobId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00ff88] hover:text-[#00cc6a] underline font-mono"
              title="View blob on Walrus"
            >
              {log.blobId}
            </a>
          </>
        )}
        {' '}namespace={log.namespace || '-'}
      </span>
    );
  }
  if (log.phase === 'EVALUATE') {
    return `${log.decision || 'CHECK'} ${log.listing || ''} - ${log.reason || log.status || ''}`;
  }
  if (log.phase === 'PURCHASE' && log.txDigest) {
    return (
      <span>
        {log.status || 'pending'}{' '}
        <a
          href={getSuiScanUrl(log.txDigest, 'tx')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00e5ff] hover:text-[#00b8cc] underline font-mono"
          title="View transaction on SuiScan"
        >
          tx={log.txDigest}
        </a>
        {log.receiptId && (
          <>
            {' '}receipt=
            <a
              href={getSuiScanUrl(log.receiptId, 'object')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ffd700] hover:text-[#ccaa00] underline font-mono"
              title="View receipt object on SuiScan"
            >
              {log.receiptId}
            </a>
          </>
        )}
      </span>
    );
  }
  if (log.phase === 'PURCHASE') {
    return `${log.status || 'pending'} ${log.listing || ''}`;
  }
  if (log.phase === 'SYNTHESIZE') {
    return typeof log.preview === 'string' ? log.preview : log.status || 'synthesizing';
  }
  if (log.phase === 'RECALL') {
    return `${log.status || 'recall'} count=${log.count ?? 0}`;
  }
  if (log.phase === 'DOWNLOAD') {
    if (log.blobId) {
      return (
        <span>
          {log.status || 'downloading'}{' '}
          {log.bytes && `${log.bytes} bytes `}
          <a
            href={getWalrusScanUrl(log.blobId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4DA2FF] hover:text-[#3d82cc] underline font-mono"
            title="View blob on Walrus"
          >
            blob={log.blobId}
          </a>
        </span>
      );
    }
    return `${log.status || 'downloading'} ${log.bytes ? `${log.bytes} bytes` : ''}`;
  }
  if (log.phase === 'DECRYPT') {
    return `${log.status || 'decrypting'} ${log.chars ? `${log.chars} chars` : ''}`;
  }
  return log.reason || log.message || log.result || log.status || '';
}

export default function AgentWallet({ wallet }: AgentWalletProps) {
  const account = useCurrentAccount();
  const isConnectedToSui = Boolean(account);

  // ─── State ──────────────────────────────────────────────────
  const [toggleLoop, setToggleLoop] = useState(wallet.toggleLoop);


  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [memoryQuery, setMemoryQuery] = useState('SUI market signals');
  const [memoryResults, setMemoryResults] = useState<MemoryRecallResult | null>(null);
  const [memoryError, setMemoryError] = useState('');

  // ─── Queries ────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const suiClient = useSuiClient();

  const currentOwnerAddress = account?.address || wallet.address;

  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 5000 });
  const status = useQuery({ 
    queryKey: ['agent-status', currentOwnerAddress], 
    queryFn: () => api.agentStatus(currentOwnerAddress), 
    refetchInterval: 5000,
    enabled: Boolean(currentOwnerAddress),
  });
  const agentLogs = useQuery({ 
    queryKey: ['agent-logs', currentOwnerAddress], 
    queryFn: () => api.agentLogs(currentOwnerAddress), 
    refetchInterval: 3000,
    enabled: Boolean(currentOwnerAddress),
  });
  const memoryHealth = useQuery({ queryKey: ['memory-health'], queryFn: api.memoryHealth, refetchInterval: 15000 });
  const memoryCount = useQuery({
    queryKey: ['memory-count', status.data?.agentAddress],
    queryFn: () => api.memoryCount(status.data!.agentAddress!),
    enabled: Boolean(status.data?.agentAddress),
    refetchInterval: 10000,
  });
  const listings = useQuery({ queryKey: ['marketplace-listings'], queryFn: api.listings, refetchInterval: 15000 });
  const vault = useQuery({ queryKey: ['seal-vault'], queryFn: api.sealVault, refetchInterval: 15000 });

  // ─── Derived state (MUST be after queries) ──────────────────
  const agentRegistered = Boolean(status.data?.isRegistered);
  const backendRegistered = Boolean(status.data?.agentAddress && status.data?.ownerAddress);
  const backendStatusLoading = status.isLoading;
  const activeListings = listings.data?.listings.filter((l) => l.isActive) ?? [];
  const memoryLogEntries = agentLogs.data?.logs ?? [];
  const storedMemoryCount = memoryCount.data?.count ?? 0; // Use actual MemWal count instead of log count
  const latestRemember = [...memoryLogEntries].reverse().find((log) => log.phase === 'REMEMBER' && log.status === 'confirmed');

  // ─── Chain balance (real on-chain data) ─────────────────────
  const agentBalance = useQuery({
    queryKey: ['agent-wallet-balance', status.data?.agentAddress],
    queryFn: () => suiClient.getBalance({ owner: status.data!.agentAddress! }),
    enabled: Boolean(status.data?.agentAddress),
    refetchInterval: 15000,
  });

  // ─── Mutations ──────────────────────────────────────────────
  const start = useMutation({
    mutationFn: () => api.startAgent(currentOwnerAddress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-status', currentOwnerAddress] }),
  });

  const stop = useMutation({
    mutationFn: () => api.stopAgent(currentOwnerAddress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-status', currentOwnerAddress] }),
  });

  const recallMemory = useMutation({
    mutationFn: async () => {
      if (!status.data?.agentAddress) throw new Error('Agent wallet is not ready yet.');
      if (!memoryQuery.trim()) throw new Error('Enter a memory query.');
      return api.recallMemory(memoryQuery.trim(), status.data.agentAddress, 5);
    },
    onSuccess: (result) => {
      setMemoryError('');
      setMemoryResults(result);
    },
    onError: (error) => {
      setMemoryResults(null);
      setMemoryError(error instanceof Error ? error.message : 'Memory recall failed.');
    },
  });

  const initBackendWallet = useMutation({
    mutationFn: () => api.registerAgent(currentOwnerAddress),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent-status', currentOwnerAddress] });
    },
    onError: (error) => console.error('Failed to register agent:', error),
  });

  // ─── Auto-reconnect returning users ─────────────────────────
  const autoReconnected = useRef(false);
  useEffect(() => {
    autoReconnected.current = false;
  }, [wallet.address]);

  useEffect(() => {
    if (
      health.isSuccess &&
      status.isSuccess &&
      !status.data?.ownerAddress &&
      !autoReconnected.current &&
      !initBackendWallet.isPending
    ) {
      autoReconnected.current = true;
      initBackendWallet.mutate();
    }
  }, [health.isSuccess, status.isSuccess, status.data?.ownerAddress]);

  // ─── Sync toggleLoop with backend state ─────────────────────
  useEffect(() => {
    if (status.data) setToggleLoop(status.data.isRunning);
  }, [status.data]);

  // ─── Sync toggleLoop with parent wallet state ──────────────
  useEffect(() => {
    setToggleLoop(wallet.toggleLoop);
  }, [wallet]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    }).catch(() => {});
  };

  const handleToggleLoop = async () => {
    const nextState = !toggleLoop;
    setToggleLoop(nextState);
    try {
      if (nextState) await start.mutateAsync(undefined);
      else await stop.mutateAsync();
    } catch (e) {
      setToggleLoop(!nextState); // revert on error
      console.error(e);
    }
  };


  // ─── Activity log (mirrors Agents.tsx buildAgentLog) ────────
  const activityEntries = useMemo(() => {
    const entries: AgentLog[] = [];
    const time = status.data?.lastTickTime ?? new Date().toISOString();

    if (health.isError) {
      return [{
        id: 'backend-offline',
        timestamp: new Date().toISOString(),
        action: 'AGENT RUNTIME OFFLINE',
        type: 'error' as const,
        details: 'Start the backend before the agent can scan or report live activity.',
      }];
    }

    if (!status.data?.agentAddress || !status.data?.isRegistered) {
      return [
        {
          id: 'wallet-missing',
          timestamp: new Date().toISOString(),
          action: 'CREATE AGENT WALLET',
          type: 'warning',
          details: 'Your agent needs its own encrypted buying wallet before it can buy data.',
        },
        {
          id: 'wallet-watch',
          timestamp: new Date().toISOString(),
          action: 'MARKETPLACE WATCH',
          type: 'info',
          details: activeListings.length
            ? `${activeListings.length} active datasets available. Once the wallet is ready, the agent can evaluate them.`
            : 'No active datasets are available for the agent to evaluate yet.',
        },
      ];
    }

    if (!status.data?.isRunning) {
      return [
        {
          id: 'idle',
          timestamp: time,
          action: 'AGENT STANDING BY',
          type: 'success',
          details:
            status.data?.tickCount && status.data.tickCount > 0
              ? `Last completed run #${status.data.tickCount}. Start the agent to resume.`
              : 'Start the agent when you are ready to scan, buy, and learn from data.',
        },
        {
          id: 'wallet-ready',
          timestamp: time,
          action: 'WALLET READY',
          type: 'info',
          details: status.data?.agentAddress
            ? `Buying wallet ${formatAddress(status.data.agentAddress)} ready.`
            : 'Wallet is ready; balance will appear when the Sui client responds.',
        },
      ];
    }

    // Running state — mirror Agents.tsx activity phases
    entries.push({
      id: 'tick',
      timestamp: time,
      action: `AGENT RUN #${status.data?.tickCount || 1}`,
      type: 'info',
      details: 'The agent unlocked its buying wallet and started checking the marketplace.',
    });
    entries.push({
      id: 'recall',
      timestamp: time,
      action: 'MEMORY CHECK',
      type: 'success',
      details: 'The agent reviews prior memory before deciding if a new dataset is useful.',
    });
    entries.push({
      id: 'scan',
      timestamp: time,
      action: 'MARKETPLACE SCAN',
      type: 'success',
      details: activeListings.length
        ? `Reviewing ${activeListings.length} active datasets. Listings are being compared by topic match and price.`
        : 'No active listings found; the agent will check again on the next run.',
    });

    // Listing evaluations (same logic as Agents.tsx evaluateListing)
    for (const listing of activeListings.slice(0, 3)) {
      const decision = evaluateListing(listing);
      entries.push({
        id: `listing-${listing.id}`,
        timestamp: time,
        action: decision.shouldBuy ? 'CANDIDATE' : 'SKIP',
        type: decision.shouldBuy ? 'success' : 'warning',
        details: decision.shouldBuy
          ? `May buy: ${listing.title} — Looks relevant and stays under the ${formatMist(10_000_000)} limit.`
          : `Skipping: ${listing.title} — ${decision.matchesGoal ? 'Topic matches' : 'Topic match is weak'}; ${decision.affordable ? 'price OK' : 'over budget'}.`,
      });
    }

    entries.push({
      id: 'secure',
      timestamp: time,
      action: 'PRIVATE ACTIVITY SUMMARY',
      type: vault.data?.vaultId ? 'success' : 'warning',
      details: vault.data?.vaultId
        ? 'After buying or skipping data, the agent stores a protected activity summary.'
        : 'Private activity storage will be ready when the Seal vault responds.',
    });

    return entries;
  }, [health.isError, status.data, activeListings, vault.data]);

  // ─── Wallet disconnected guard ─────────────────────────────
  if (!isConnectedToSui) {
    return (
      <div className="max-w-6xl mx-auto py-4 px-2 font-sans selection:bg-[#111312] selection:text-white">
        <div className="border-b-2 border-[#111312] pb-5 mb-8">
          <span className="font-mono text-xs text-zinc-650 uppercase tracking-widest block font-bold">
            [ MODULE 03 // AUTONOMOUS WORKSPACE ]
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#111312] uppercase mt-1">
            Wallet Required
          </h1>
        </div>
        <div className="bg-white border-2 border-[#111312] p-8 shadow-md text-center">
          <Wallet className="w-10 h-10 text-zinc-400 mx-auto mb-4" />
          <p className="font-mono text-xs text-zinc-600 uppercase tracking-widest font-black mb-2">
            NO SUI WALLET DETECTED
          </p>
          <p className="text-sm text-zinc-500 font-serif italic max-w-md mx-auto">
            Connect your Sui wallet using the button in the top-right corner to access the autonomous agent workspace.
          </p>
        </div>
      </div>
    );
  }

  // ─── Loading state ──────────────────────────────────────────
  if (backendStatusLoading && !status.data) {
    return (
      <div className="max-w-6xl mx-auto py-4 px-2 font-sans">
        <div className="border-b-2 border-[#111312] pb-5 mb-8">
          <span className="font-mono text-xs text-zinc-650 uppercase tracking-widest block font-bold">
            [ MODULE 03 // AUTONOMOUS WORKSPACE ]
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#111312] uppercase mt-1">
            Loading agent status...
          </h1>
        </div>
      </div>
    );
  }

  // ─── Setup flow (unregistered — first-time) ─────────────────
  if (!backendRegistered) {
    return (
      <div className="max-w-6xl mx-auto py-4 px-2 font-sans selection:bg-[#111312] selection:text-white">
        <div className="border-b-2 border-[#111312] pb-5 mb-8">
          <span className="font-mono text-xs text-zinc-650 uppercase tracking-widest block font-bold">
            [ MODULE 03 // AUTONOMOUS WORKSPACE ]
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#111312] uppercase mt-1">
            Create Your Agent
          </h1>
          <p className="text-sm text-zinc-700 mt-2 max-w-2xl font-serif leading-relaxed italic">
            Your agent needs its own encrypted buying wallet before it can scan the marketplace and buy data for you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-white border-2 border-[#111312] p-6 shadow-md">
            <h2 className="text-xs font-mono text-[#111312] uppercase tracking-widest flex items-center font-black mb-4">
              <Bot className="w-4 h-4 mr-2 text-[#3E7A5E]" />
              First-time Setup
            </h2>
            <p className="text-xs text-zinc-600 mb-6 font-serif leading-relaxed italic">
              The backend only needs your wallet address. It creates or restores an encrypted agent wallet
              for that owner and returns the agent wallet address.
            </p>

            {/* Setup steps */}
            <div className="space-y-3 mb-6">
              {[
                { step: 1, title: 'Wallet detected', detail: `Address: ${formatAddress(account?.address ?? wallet.address)}`, done: true },
                { step: 2, title: 'Register with backend', detail: 'Creates or restores the encrypted buying wallet for this address.', done: backendRegistered },
                { step: 3, title: 'Open agent controls', detail: 'Once created, you can start the agent, fund the wallet, and view live activity.', done: false },
              ].map(({ step, title, detail, done }) => (
                <div key={step} className="flex gap-3 p-4 bg-[#EAEFEC] border border-[#111312]/20">
                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white border border-[#111312]/30 font-mono text-xs font-black">
                    {done ? <CheckCircle2 className="w-4 h-4 text-[#3E7A5E]" /> : step}
                  </div>
                  <div>
                    <p className="text-xs font-mono font-black uppercase tracking-wider">{title}</p>
                    <p className="text-[11px] text-zinc-600 mt-1 font-serif italic leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => initBackendWallet.mutate()}
              disabled={initBackendWallet.isPending || health.isError}
              className="w-full bg-[#111312] hover:bg-[#EAEFEC] text-white hover:text-black border-2 border-[#111312] py-3 font-mono text-xs font-black uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-50"
            >
              {initBackendWallet.isPending ? 'CREATING AGENT...' : 'CREATE AGENT WALLET'}
            </button>

            {health.isError ? (
              <p className="mt-4 p-3 bg-red-50 border-2 border-red-300 text-red-800 font-mono text-[10px] uppercase font-bold">
                Backend is offline. Start the backend before creating an agent.
              </p>
            ) : null}
          </div>

          <div className="lg:col-span-5 bg-[#111312] text-white border-2 border-[#111312] p-6 shadow-md">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4 font-black">
              What gets created?
            </h3>
            <div className="space-y-4 text-xs text-zinc-300">
              <div>
                <p className="font-mono font-black uppercase text-[10px] text-zinc-500 mb-1">Owner wallet</p>
                <p className="font-mono">{formatAddress(account?.address ?? wallet.address, 10)}</p>
              </div>
              <div>
                <p className="font-mono font-black uppercase text-[10px] text-zinc-500 mb-1">Agent buying wallet</p>
                <p className="font-serif italic">Generated by the backend and encrypted in SQLite.</p>
              </div>
              <div>
                <p className="font-mono font-black uppercase text-[10px] text-zinc-500 mb-1">On-chain profile</p>
                <p className="font-serif italic">Optional advanced step. The backend agent wallet does not require it.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main dashboard (registered) ────────────────────────────
  return (
    <div className="max-w-6xl mx-auto py-4 px-2 font-sans selection:bg-[#111312] selection:text-white">

      {/* ── Header ── */}
      <div className="border-b-2 border-[#111312] pb-5 mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
        <div>
          <span className="font-mono text-xs text-zinc-650 uppercase tracking-widest block font-bold">
            [ MODULE 03 // AUTONOMOUS WORKSPACE ]
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#111312] uppercase mt-1">
            Autonomous Agent Center
          </h1>
        </div>

        <div className="xl:mt-0 flex items-center space-x-3 bg-white py-2 px-4 border-2 border-[#111312] shadow-sm">
          <div
            className="w-2.5 h-2.5 rounded-none"
            style={{ backgroundColor: toggleLoop ? '#3E7A5E' : '#ef4444' }}
          />
          <span className="font-mono text-[10px] text-zinc-800 font-extrabold uppercase">
            RUNTIME STATE: {toggleLoop ? '● SYSTEM_LOOP_ACTIVE_SUI' : '■ SYSTEM_THREAD_IDLE'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ════════ Left column ════════ */}
        <div className="lg:col-span-8 space-y-8">

          {/* ── Balance & Ledger card ── */}
          <div className="bg-white border-2 border-[#111312] p-6 sm:p-8 relative shadow-md">
            <div className="absolute top-4 right-4 text-[9px] font-mono text-zinc-750 bg-[#EAEFEC] px-2.5 py-1 border border-zinc-450 uppercase font-black">
              SUI_TESTNET_LEDGER
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-7">
                <span className="font-mono text-[9px] text-zinc-500 tracking-widest block uppercase font-bold">
                  AGENT WALLET ADDRESS
                </span>
                <div className="font-mono text-xs text-zinc-800 mt-2.5 break-all bg-[#EAEFEC] p-3 border border-[#111312]/20 leading-relaxed font-bold">
                  {status.data?.agentAddress || wallet.address}
                  {status.data?.agentAddress && (
                    <button
                      onClick={() => handleCopy(status.data!.agentAddress!)}
                      className="inline-flex items-center justify-center h-5 w-5 ml-2 hover:bg-white rounded transition-colors"
                      title="Copy agent wallet address"
                    >
                      {copiedAddress === status.data!.agentAddress ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#3E7A5E]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-zinc-500" />
                      )}
                    </button>
                  )}
                </div>
                {status.data?.agentAddress && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold">AGENT BALANCE:</span>
                    <span className="text-xs font-mono font-black text-[#111312]">
                      {agentBalance.data ? formatMist(agentBalance.data.totalBalance) : '...'}
                    </span>
                  </div>
                )}

                <div className="mt-4 flex space-x-6">
                  <div>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold block">LEDGER PROTOCOL</span>
                    <span className="block text-xs font-mono text-[#111312] font-black uppercase">Sui Testnet // v3</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold block">SECURE SYMMETRY</span>
                    <span className="block text-xs font-mono text-emerald-800 font-black uppercase">[ SQLite Embedded Cache ]</span>
                  </div>
                </div>
              </div>

              {/* Large numerical balance display */}
              <div className="md:col-span-5 text-right border-t md:border-t-0 md:border-l border-zinc-200 pt-4 md:pt-0 md:pl-6">
                <span className="font-mono text-[9px] text-zinc-500 block uppercase font-bold">AVAILABLE LIQUID FUNDS</span>
                <span className="text-3xl sm:text-5xl font-mono text-[#111312] tracking-widest font-black select-all break-all">
                  {agentBalance.data ? formatMist(agentBalance.data.totalBalance) : `${wallet.balance.toFixed(2)} SUI`}
                </span>
                <span className="text-xs font-mono text-zinc-650 block mt-1.5 tracking-wider font-extrabold uppercase">
                  SUI BALANCE CREDITS
                </span>
              </div>
            </div>

          </div>

          {/* ── Activity Logs ── */}
          <div className="bg-white border-2 border-[#111312] shadow-md">
            <div className="border-b border-[#111312]/20 p-4 flex justify-between items-center bg-[#EAEFEC]">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-800 uppercase tracking-widest flex items-center font-black">
                <Terminal className="w-4 h-4 mr-2 text-[#111312] flex-shrink-0" />
                <span className="truncate">Cognitive Ingestion Engine Logs</span>
              </span>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-[#3E7A5E] bg-emerald-50 px-2 sm:px-3 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#3E7A5E] animate-pulse" />
                  <span className="hidden sm:inline">{status.data?.isRunning ? 'Agent running' : 'Live status'}</span>
                  <span className="sm:hidden">Live</span>
                </div>
                <span className="font-mono text-[8px] text-zinc-500 font-bold uppercase hidden md:inline">
                  THREAD_POLL: 5000MS
                </span>
              </div>
            </div>

            <div className="p-4 bg-[#111312] font-mono text-xs h-[300px] overflow-y-auto space-y-3 scrollbar text-[#D8DDD9]">
              {!isConnectedToSui ? (
                <div className="text-zinc-600 py-12 text-center uppercase tracking-wider text-[10px] font-bold">
                  [ WALLET NOT CONNECTED // NO LOG STREAM ]
                </div>
              ) : !agentRegistered ? (
                <div className="text-zinc-600 py-12 text-center uppercase tracking-wider text-[10px] font-bold">
                  [ AGENT WALLET REQUIRED // NO LOG STREAM ]
                </div>
              ) : activityEntries.length === 0 ? (
                <div className="text-zinc-600 py-12 text-center uppercase tracking-wider text-[10px] font-bold">
                  [ SYSTEM_IDLE // COGNITIVE AGENT PIPELINE IDLE ]
                </div>
              ) : (
                activityEntries.map((log) => (
                  <div key={log.id} className="border-b border-zinc-900 pb-2 flex items-start space-x-2.5">
                    <span className="text-zinc-500 text-[9px] flex-shrink-0 mt-0.5 select-none font-bold">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`text-[8px] px-1.5 py-0.5 flex-shrink-0 select-none uppercase font-black text-center w-36 overflow-hidden text-ellipsis ${
                        log.type === 'success'
                          ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-950'
                          : log.type === 'warning'
                            ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-950'
                            : log.type === 'error'
                              ? 'bg-red-900/60 text-red-400 border border-red-950'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-900'
                      }`}
                    >
                      {log.action}
                    </span>
                    <div className="text-zinc-200 leading-normal select-text">
                      <span className="font-sans leading-relaxed block text-xs">{log.details}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Memory Core ── */}
          <div className="bg-white border-2 border-[#111312] shadow-md">
            <div className="border-b border-[#111312]/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#111312] text-white">
              <div>
                <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest flex items-center font-black">
                  <Terminal className="w-4 h-4 mr-2 text-[#00ff88] flex-shrink-0" />
                  MEMORY_CORE
                </span>
                <p className="text-[10px] text-zinc-400 mt-1 font-serif italic">
                  Persistent MemWal recall, synthesis, and Walrus proof stream.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase text-zinc-400 font-black">MEMORIES</span>
                <span className="font-mono text-lg text-[#00ff88] font-black">{storedMemoryCount}</span>
              </div>
            </div>

            {latestRemember ? (
              <div className="m-4 border-2 border-[#00ff88] bg-emerald-50 p-4">
                <p className="font-mono text-[10px] text-emerald-900 uppercase font-black tracking-widest">
                  MEMORY STORED
                </p>
                <p className="mt-1 font-mono text-xs text-[#111312] break-all">
                  blob_id={latestRemember.blobId}
                </p>
                {latestRemember.walrusUrl ? (
                  <a
                    href={latestRemember.walrusUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-mono text-[10px] uppercase font-black text-emerald-900 underline"
                  >
                    Open Walrus proof
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-[#111312] border-2 border-[#111312] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] text-zinc-400 uppercase font-black tracking-widest">
                    Event Stream
                  </span>
                  <span className="font-mono text-[8px] text-zinc-500 uppercase font-bold">
                    {memoryHealth.data?.status === 'ok' ? 'MEMWAL ONLINE' : memoryHealth.data?.status || 'CHECKING'}
                  </span>
                </div>

                <div className="h-[260px] overflow-y-auto space-y-2 font-mono text-[10px]">
                  {memoryLogEntries.length ? (
                    memoryLogEntries.slice(-40).map((log, index) => (
                      <div
                        key={`${log.timestamp}-${index}`}
                        className={`border-l-2 pl-3 py-2 bg-white/5 ${
                          log.phase === 'REMEMBER' && log.status === 'confirmed' ? 'ring-1 ring-[#00ff88]/70' : ''
                        }`}
                        style={{ borderLeftColor: PHASE_COLORS[log.phase] || '#ffffff' }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-zinc-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className="font-black uppercase" style={{ color: PHASE_COLORS[log.phase] || '#ffffff' }}>
                            {log.phase}
                          </span>
                          {log.status ? <span className="text-zinc-400 uppercase">{log.status}</span> : null}
                        </div>
                        <p className="mt-1 text-zinc-200 leading-relaxed">{formatAgentLog(log)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-600 py-16 text-center uppercase tracking-wider font-bold">
                      [ NO AGENT MEMORY EVENTS YET ]
                    </div>
                  )}
                </div>
              </div>

              <div className="border-2 border-[#111312] p-4 bg-[#EAEFEC]">
                <span className="font-mono text-[10px] text-[#111312] uppercase font-black tracking-widest">
                  Query Memory
                </span>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={memoryQuery}
                    onChange={(event) => setMemoryQuery(event.target.value)}
                    className="flex-1 bg-white border-2 border-[#111312] p-2 font-mono text-xs focus:outline-none"
                    placeholder="SUI market signals"
                  />
                  <button
                    onClick={() => recallMemory.mutate()}
                    disabled={recallMemory.isPending || !status.data?.agentAddress}
                    className="bg-[#111312] text-white border-2 border-[#111312] px-4 py-2 font-mono text-[10px] font-black uppercase disabled:opacity-50"
                  >
                    {recallMemory.isPending ? 'QUERYING' : 'RECALL'}
                  </button>
                </div>

                {memoryError ? (
                  <p className="mt-3 border-2 border-red-300 bg-red-50 p-2 text-[10px] font-mono text-red-800 font-bold">
                    {memoryError}
                  </p>
                ) : null}

                <div className="mt-4 space-y-3 max-h-[220px] overflow-y-auto">
                  {memoryResults?.memories.length ? (
                    memoryResults.memories.map((memory) => (
                      <div key={memory.blob_id} className="bg-white border border-[#111312]/25 p-3">
                        <div className="flex justify-between gap-3 mb-2">
                          <span className="font-mono text-[8px] uppercase font-black text-zinc-500">
                            {shortId(memory.blob_id)}
                          </span>
                          <span className="font-mono text-[8px] uppercase font-black text-[#111312]">
                            distance {memory.distance.toFixed(3)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-700 font-serif leading-relaxed">{memory.text}</p>
                      </div>
                    ))
                  ) : memoryResults ? (
                    <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">
                      No memories matched that query.
                    </p>
                  ) : (
                    <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">
                      Enter a topic to recall this agent's MemWal knowledge.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ════════ Right column ════════ */}
        <div className="lg:col-span-4 space-y-6">

          {/* ── Runtime Trigger ── */}
          <div className="bg-white border-2 border-[#111312] p-6 relative shadow-md">
            <h3 className="text-xs font-mono text-[#111312] uppercase tracking-widest mb-4 flex items-center font-black">
              <Bookmark className="w-4.5 h-4.5 mr-2" />
              Runtime Trigger
            </h3>

            <p className="text-xs text-zinc-650 mb-6 font-serif leading-relaxed italic">
              Activate the autonomous pipeline thread. When active, background models parse listed physical metadata blocks and pay transaction SUI automatically according to targets.
            </p>

            <button
              onClick={handleToggleLoop}
              disabled={start.isPending || stop.isPending}
              className={`w-full py-4 px-6 font-mono text-xs font-black tracking-widest uppercase cursor-pointer flex items-center justify-center space-x-2 border-2 transition-all duration-200 disabled:opacity-50 ${
                toggleLoop
                  ? 'bg-red-50 hover:bg-red-105 border-red-800 text-red-800'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-800 text-emerald-800'
              }`}
            >
              {toggleLoop ? (
                <>
                  <Square className="w-4 h-4 fill-red-800" />
                  <span>{stop.isPending ? 'HALTING...' : 'HALT AUTONOMOUS CYCLE'}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-emerald-800 animate-pulse" />
                  <span>{start.isPending ? 'STARTING...' : 'START AUTONOMOUS LOOP'}</span>
                </>
              )}
            </button>
          </div>

          {/* ── Brain decoration ── */}
          <div className="bg-[#111312] text-white border-2 border-[#111352] p-4 relative overflow-hidden group">
            <span className="font-mono text-[8px] text-zinc-450 tracking-widest uppercase block mb-3 font-semibold">
              [ COGNITIVE ANALYSIS PIPELINE ]
            </span>
            <div className="border border-zinc-800 overflow-hidden mb-3 bg-[#E1E5E2] relative p-1">
              <img
                src="/brain.png"
                alt="Brain visualization in settings"
                referrerPolicy="no-referrer"
                className="w-full h-auto max-h-[140px] object-cover group-hover:scale-105 duration-500"
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-1 flex justify-between font-mono text-[8px] uppercase">
                <span className="text-emerald-400">COGNITIVE MODEL</span>
                <span className="text-zinc-400">ACTIVE</span>
              </div>
            </div>
            <p className="text-[11px] font-serif leading-relaxed italic text-zinc-300">
              The neural system parses semantic descriptions mapped onto listed catalogs. Positive matches automatically triggers purchase cycles.
            </p>
          </div>

        </div>

      </div>

      {/* ── Wallet Details Table ── */}
      <div className="mt-8 bg-white border-2 border-[#111312] shadow-md overflow-hidden">
        <div className="p-4 border-b border-[#111312]/20 flex items-center justify-between bg-[#EAEFEC]">
          <h2 className="text-xs font-mono text-[#111312] uppercase tracking-widest flex items-center font-black">
            <Wallet className="w-4 h-4 mr-2 text-[#111312]" />
            Wallet Details
          </h2>
          <Cpu className="w-4 h-4 text-zinc-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs min-w-[480px]">
          <tbody>
            <tr className="border-b border-[#111312]/10">
              <td className="py-3 px-6 text-zinc-500 uppercase text-[10px] font-black">Owner Address</td>
              <td className="py-3 px-6 font-bold break-all">{account?.address ?? wallet.address}</td>
            </tr>
            <tr className="border-b border-[#111312]/10">
              <td className="py-3 px-6 text-zinc-500 uppercase text-[10px] font-black">Agent Buying Wallet</td>
              <td className="py-3 px-6 font-bold break-all">
                {status.data?.agentAddress ? (
                  <span className="flex items-center gap-2">
                    {status.data.agentAddress}
                    <button
                      onClick={() => handleCopy(status.data!.agentAddress!)}
                      className="inline-flex items-center justify-center h-6 w-6 hover:bg-[#EAEFEC] rounded transition-colors"
                      title="Copy agent wallet address"
                    >
                      {copiedAddress === status.data!.agentAddress ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#3E7A5E]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-zinc-500" />
                      )}
                    </button>
                  </span>
                ) : (
                  'Not initialized'
                )}
              </td>
            </tr>
            <tr className="border-b border-[#111312]/10">
              <td className="py-3 px-6 text-zinc-500 uppercase text-[10px] font-black">Backend Owner</td>
              <td className="py-3 px-6 font-bold">{status.data?.ownerAddress || 'No active owner'}</td>
            </tr>
            <tr className="border-b border-[#111312]/10">
              <td className="py-3 px-6 text-zinc-500 uppercase text-[10px] font-black">Agent Balance (Chain)</td>
              <td className="py-3 px-6 font-bold">
                {agentBalance.data ? formatMist(agentBalance.data.totalBalance) : '--'}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-6 text-zinc-500 uppercase text-[10px] font-black">Last Transaction</td>
              <td className="py-3 px-6 font-bold">{status.data?.lastTickTime ? new Date(status.data.lastTickTime).toLocaleString() : 'No tick recorded'}</td>
            </tr>
          </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
