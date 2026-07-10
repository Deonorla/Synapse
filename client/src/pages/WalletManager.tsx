import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Copy, CheckCircle2, Loader2, RefreshCw, Shield, Bot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { transferApi } from '../lib/transfer';
import { formatMist, buildPaymentTx } from '../lib/sui';
import { MIST_PER_SUI } from '../lib/config';

export default function WalletManager() {
  const { address, keypair, suiClient } = useAuth();
  const toast = useToast();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [userToAgentAmount, setUserToAgentAmount] = useState('');
  const [agentToUserAmount, setAgentToUserAmount] = useState('');
  const [userToAgentLoading, setUserToAgentLoading] = useState(false);
  const [agentToUserLoading, setAgentToUserLoading] = useState(false);

  // ─── Fetch balances ──────────────────────────────────────────
  const balances = useQuery({
    queryKey: ['wallet-balances', address],
    queryFn: () => transferApi.getBalances(address!),
    enabled: Boolean(address),
    refetchInterval: 10000,
  });

  // ─── Copy address to clipboard ───────────────────────────────
  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopiedAddress(addr);
      setTimeout(() => setCopiedAddress(null), 2000);
    }).catch(() => {});
  };

  // ─── User → Agent transfer (client-side signed) ──────────────
  const handleUserToAgent = async () => {
    if (!address || !keypair || !balances.data?.agent) return;
    const amountSui = parseFloat(userToAgentAmount);
    if (isNaN(amountSui) || amountSui <= 0) {
      toast.error('Enter a valid amount greater than 0.');
      return;
    }

    const amountMist = Math.floor(amountSui * MIST_PER_SUI);
    if (amountMist > (balances.data?.user.balanceMist ?? 0)) {
      toast.error('Insufficient balance.');
      return;
    }

    setUserToAgentLoading(true);
    try {
      const tx = buildPaymentTx(balances.data.agent.address, amountMist);
      const builtTx = await tx.build({ client: suiClient });
      const signedTx = await keypair.signTransaction(builtTx);
      const result = await suiClient.executeTransactionBlock({
        transactionBlock: signedTx.bytes,
        signature: signedTx.signature,
      });

      toast.success(`Transferred ${amountSui} SUI to agent. Digest: ${result.digest.slice(0, 12)}...`);
      setUserToAgentAmount('');
      balances.refetch();
    } catch (e: any) {
      console.error('[transfer/user-to-agent]', e);
      toast.error(e.message || 'Transfer failed. Check your wallet balance.');
    } finally {
      setUserToAgentLoading(false);
    }
  };

  // ─── Agent → User transfer (server-side signed) ──────────────
  const handleAgentToUser = async () => {
    if (!address || !balances.data?.agent) return;
    const amountSui = parseFloat(agentToUserAmount);
    if (isNaN(amountSui) || amountSui <= 0) {
      toast.error('Enter a valid amount greater than 0.');
      return;
    }

    const amountMist = Math.floor(amountSui * MIST_PER_SUI);
    if (amountMist > (balances.data?.agent.balanceMist ?? 0)) {
      toast.error('Insufficient agent balance.');
      return;
    }

    setAgentToUserLoading(true);
    try {
      const result = await transferApi.agentToUser(address, address, amountMist);
      toast.success(`Transferred ${amountSui} SUI to your wallet. Digest: ${result.digest.slice(0, 12)}...`);
      setAgentToUserAmount('');
      balances.refetch();
    } catch (e: any) {
      console.error('[transfer/agent-to-user]', e);
      toast.error(e.message || 'Transfer failed. Check agent balance.');
    } finally {
      setAgentToUserLoading(false);
    }
  };

  // ─── Quick transfer presets ───────────────────────────────────
  const quickAmounts = [0.1, 0.5, 1, 5];

  // ─── Loading state ──────────────────────────────────────────
  if (!address) {
    return (
      <div className="max-w-6xl mx-auto py-4 px-2 font-sans selection:bg-[#111312] selection:text-white">
        <div className="border-b-2 border-[#111312] pb-5 mb-8">
          <span className="font-mono text-xs text-zinc-650 uppercase tracking-widest block font-bold">
            [ MODULE 04 // WALLET MANAGER ]
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
            Sign in to access your wallet management dashboard.
          </p>
        </div>
      </div>
    );
  }

  const userBalance = balances.data?.user.balanceMist ?? 0;
  const agentBalance = balances.data?.agent?.balanceMist ?? 0;
  const agentAddress = balances.data?.agent?.address ?? null;

  return (
    <div className="max-w-6xl mx-auto py-4 px-2 font-sans selection:bg-[#111312] selection:text-white">

      {/* ── Header ── */}
      <div className="border-b-2 border-[#111312] pb-5 mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
        <div>
          <span className="font-mono text-xs text-zinc-650 uppercase tracking-widest block font-bold">
            [ MODULE 04 // WALLET MANAGER ]
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#111312] uppercase mt-1">
            Fund Transfer Hub
          </h1>
        </div>
        <button
          onClick={() => balances.refetch()}
          disabled={balances.isFetching}
          className="bg-white border-2 border-[#111312] px-4 py-2 text-[10px] font-mono text-[#111312] font-black uppercase shadow-sm flex items-center gap-2 hover:bg-[#EAEFEC] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${balances.isFetching ? 'animate-spin' : ''}`} />
          SYNC BALANCES
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ════════ Left column: Wallet Cards ════════ */}
        <div className="lg:col-span-5 space-y-6">

          {/* ── User Wallet Card ── */}
          <div className="bg-white border-2 border-[#111312] p-6 shadow-md relative">
            <div className="absolute top-4 right-4 text-[8px] font-mono text-zinc-500 bg-[#EAEFEC] px-2 py-0.5 border border-zinc-300 uppercase font-black">
              YOUR WALLET
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#111312] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block font-bold">
                  Owner Wallet
                </span>
                <span className="font-mono text-[8px] text-zinc-400 uppercase">
                  Client-side Ed25519
                </span>
              </div>
            </div>

            <div className="bg-[#EAEFEC] p-3 border border-[#111312]/20 mb-3">
              <span className="font-mono text-[8px] text-zinc-500 uppercase block mb-1 font-bold">Address</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#111312] font-bold break-all flex-1">
                  {address}
                </span>
                <button
                  onClick={() => handleCopy(address)}
                  className="flex-shrink-0 p-1 hover:bg-white transition-colors"
                  title="Copy address"
                >
                  {copiedAddress === address ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#3E7A5E]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-center py-2">
              <span className="font-mono text-[9px] text-zinc-500 uppercase font-bold block">Balance</span>
              <span className="text-2xl font-mono text-[#111312] font-black">
                {formatMist(userBalance)}
              </span>
            </div>
          </div>

          {/* ── Transfer Arrow ── */}
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-[#111312] flex items-center justify-center -my-3 z-10 relative">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* ── Agent Wallet Card ── */}
          <div className="bg-white border-2 border-[#111312] p-6 shadow-md relative">
            <div className="absolute top-4 right-4 text-[8px] font-mono text-zinc-500 bg-[#EAEFEC] px-2 py-0.5 border border-zinc-300 uppercase font-black">
              AGENT WALLET
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#3E7A5E] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block font-bold">
                  Agent Buying Wallet
                </span>
                <span className="font-mono text-[8px] text-zinc-400 uppercase">
                  Server-side encrypted
                </span>
              </div>
            </div>

            {agentAddress ? (
              <div className="bg-[#EAEFEC] p-3 border border-[#111312]/20 mb-3">
                <span className="font-mono text-[8px] text-zinc-500 uppercase block mb-1 font-bold">Address</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#111312] font-bold break-all flex-1">
                    {agentAddress}
                  </span>
                  <button
                    onClick={() => handleCopy(agentAddress)}
                    className="flex-shrink-0 p-1 hover:bg-white transition-colors"
                    title="Copy address"
                  >
                    {copiedAddress === agentAddress ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#3E7A5E]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-zinc-500" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 p-3 border border-red-200 mb-3 text-center">
                <p className="font-mono text-[10px] text-red-700 uppercase font-bold">
                  No agent wallet registered yet
                </p>
                <p className="font-mono text-[9px] text-red-500 mt-1">
                  Go to Command Wallets tab to create one
                </p>
              </div>
            )}

            <div className="text-center py-2">
              <span className="font-mono text-[9px] text-zinc-500 uppercase font-bold block">Balance</span>
              <span className="text-2xl font-mono text-[#3E7A5E] font-black">
                {agentAddress ? formatMist(agentBalance) : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* ════════ Right column: Transfer Forms ════════ */}
        <div className="lg:col-span-7 space-y-6">

          {/* ── User → Agent Transfer ── */}
          <div className="bg-white border-2 border-[#111312] p-6 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#111312] flex items-center justify-center">
                <ArrowDownToLine className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-mono text-xs text-[#111312] uppercase tracking-widest font-black">
                  Fund Agent Wallet
                </h3>
                <p className="font-mono text-[9px] text-zinc-500 uppercase">
                  Transfer SUI from your wallet to the agent
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 font-serif italic mb-4 leading-relaxed">
              Send SUI to your agent wallet so it can purchase datasets on the marketplace autonomously.
            </p>

            {/* Quick amount buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setUserToAgentAmount(String(amt))}
                  className="bg-[#EAEFEC] border border-[#111312]/20 px-3 py-1.5 font-mono text-[10px] text-[#111312] font-black uppercase hover:bg-[#111312] hover:text-white transition-colors cursor-pointer"
                >
                  {amt} SUI
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={userToAgentAmount}
                  onChange={(e) => setUserToAgentAmount(e.target.value)}
                  placeholder="Amount in SUI"
                  min="0"
                  step="0.01"
                  className="w-full bg-[#EAEFEC] border-2 border-[#111312] p-3 font-mono text-xs focus:outline-none focus:bg-white text-[#111312] placeholder:text-zinc-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-zinc-500 uppercase font-bold">
                  SUI
                </span>
              </div>
              <button
                onClick={handleUserToAgent}
                disabled={userToAgentLoading || !userToAgentAmount || !agentAddress}
                className="bg-[#111312] hover:bg-white text-white hover:text-[#111312] border-2 border-[#111312] px-6 py-3 font-mono text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {userToAgentLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                ) : (
                  <><ArrowDownToLine className="w-3.5 h-3.5" /> Send</>
                )}
              </button>
            </div>

            {!agentAddress && (
              <p className="mt-3 font-mono text-[9px] text-red-600 uppercase font-bold">
                ⚠ Register an agent wallet first (Command Wallets tab)
              </p>
            )}
          </div>

          {/* ── Agent → User Transfer ── */}
          <div className="bg-white border-2 border-[#111312] p-6 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#3E7A5E] flex items-center justify-center">
                <ArrowUpFromLine className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-mono text-xs text-[#111312] uppercase tracking-widest font-black">
                  Withdraw from Agent
                </h3>
                <p className="font-mono text-[9px] text-zinc-500 uppercase">
                  Transfer SUI from agent back to your wallet
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 font-serif italic mb-4 leading-relaxed">
              Withdraw unused funds from your agent wallet back to your main wallet at any time.
            </p>

            {/* Quick amount buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAgentToUserAmount(String(amt))}
                  className="bg-[#EAEFEC] border border-[#111312]/20 px-3 py-1.5 font-mono text-[10px] text-[#111312] font-black uppercase hover:bg-[#111312] hover:text-white transition-colors cursor-pointer"
                >
                  {amt} SUI
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={agentToUserAmount}
                  onChange={(e) => setAgentToUserAmount(e.target.value)}
                  placeholder="Amount in SUI"
                  min="0"
                  step="0.01"
                  className="w-full bg-[#EAEFEC] border-2 border-[#111312] p-3 font-mono text-xs focus:outline-none focus:bg-white text-[#111312] placeholder:text-zinc-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-zinc-500 uppercase font-bold">
                  SUI
                </span>
              </div>
              <button
                onClick={handleAgentToUser}
                disabled={agentToUserLoading || !agentToUserAmount || !agentAddress}
                className="bg-[#3E7A5E] hover:bg-white text-white hover:text-[#3E7A5E] border-2 border-[#3E7A5E] px-6 py-3 font-mono text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {agentToUserLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Withdrawing...</>
                ) : (
                  <><ArrowUpFromLine className="w-3.5 h-3.5" /> Withdraw</>
                )}
              </button>
            </div>

            {!agentAddress && (
              <p className="mt-3 font-mono text-[9px] text-red-600 uppercase font-bold">
                ⚠ Register an agent wallet first (Command Wallets tab)
              </p>
            )}
          </div>

          {/* ── Transfer Summary ── */}
          <div className="bg-[#111312] text-white border-2 border-[#111312] p-6 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[#00ff88]" />
              <h3 className="font-mono text-xs text-zinc-400 uppercase tracking-widest font-black">
                Transfer Security
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-[#00ff88] font-black">01</span>
                </div>
                <div>
                  <p className="font-mono text-zinc-300 font-bold uppercase text-[10px]">Client-side Signing</p>
                  <p className="text-zinc-500 font-serif italic text-[11px] mt-0.5">
                    Your wallet → Agent transfers are signed directly in your browser. Your private key never leaves your device.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-[#00ff88] font-black">02</span>
                </div>
                <div>
                  <p className="font-mono text-zinc-300 font-bold uppercase text-[10px]">Server-side Signing</p>
                  <p className="text-zinc-500 font-serif italic text-[11px] mt-0.5">
                    Agent → Your wallet transfers are signed by the encrypted agent keypair on the server. Funds return to your address.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-[#00ff88] font-black">03</span>
                </div>
                <div>
                  <p className="font-mono text-zinc-300 font-bold uppercase text-[10px]">On-chain Settlement</p>
                  <p className="text-zinc-500 font-serif italic text-[11px] mt-0.5">
                    All transfers execute on Sui testnet. Transaction digests are provided for verification on SuiScan.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
