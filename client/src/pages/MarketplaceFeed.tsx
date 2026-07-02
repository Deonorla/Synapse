import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Database, Loader2, RefreshCw, ShoppingCart } from 'lucide-react';
import { api, type DatasetListing } from '../lib/api';
import { buildPurchaseDatasetTx, formatAddress, formatMist, getChainListings } from '../lib/sui';
import { useToast } from '../components/Toast';

type MergedListing = DatasetListing & {
  chainSource?: boolean;
  backendSource?: boolean;
};

interface MarketplaceFeedLegacyProps {
  onRefreshWallet: () => void;
}

export default function MarketplaceFeedLegacy({ onRefreshWallet }: MarketplaceFeedLegacyProps) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const toast = useToast();

  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [walletBuyingId, setWalletBuyingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ─── Real chain balance ─────────────────────────────────────
  const balanceQuery = useQuery({
    queryKey: ['wallet-balance', account?.address],
    queryFn: () => suiClient.getBalance({ owner: account!.address! }),
    enabled: Boolean(account?.address),
    refetchInterval: 15000,
  });
  const realBalance = balanceQuery.data ? Number(balanceQuery.data.totalBalance) / 1_000_000_000 : null;

  // ─── Queries ────────────────────────────────────────────────
  const backendListings = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: api.listings,
    refetchInterval: 15000,
  });

  const chainListings = useQuery({
    queryKey: ['chain-listings'],
    queryFn: () => getChainListings(suiClient),
    refetchInterval: 20000,
  });

  // ─── Merge backend + chain listings ─────────────────────────
  const listings = useMemo(() => {
    const map = new Map<string, MergedListing>();
    for (const listing of backendListings.data?.listings ?? []) {
      map.set(listing.id, { ...listing, backendSource: true });
    }
    for (const listing of chainListings.data ?? []) {
      map.set(listing.id, { ...map.get(listing.id), ...listing, chainSource: true });
    }
    return [...map.values()].filter((listing) => listing.isActive);
  }, [backendListings.data, chainListings.data]);

  // ─── Mutations ──────────────────────────────────────────────
  const backendPurchase = useMutation({
    mutationFn: (id: string) => {
      setPurchasingId(id);
      return api.purchaseDataset(id);
    },
    onSuccess: () => {
      toast.success('Dataset purchased! Your agent can now ingest it.');
      queryClient.invalidateQueries({ queryKey: ['chain-listings'] });
      onRefreshWallet();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to purchase dataset.');
    },
    onSettled: () => setPurchasingId(null),
  });

  const buyWithWallet = async (listing: MergedListing) => {
    if (!account) throw new Error('Connect a Sui wallet first.');
    const res = await signAndExecute({
      transaction: buildPurchaseDatasetTx(listing.id, listing.priceMist),
      account,
    });
    toast.success(`Purchase submitted! Digest: ${res.digest.slice(0, 10)}...`);
    await queryClient.invalidateQueries({ queryKey: ['chain-listings'] });
    onRefreshWallet();
  };

  // ─── Pagination ─────────────────────────────────────────────
  const totalPages = Math.ceil(listings.length / ITEMS_PER_PAGE);
  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return listings.slice(start, start + ITEMS_PER_PAGE);
  }, [listings, currentPage]);

  // Reset to page 1 when listings change
  useEffect(() => {
    setCurrentPage(1);
  }, [listings.length]);

  // ─── Stats ──────────────────────────────────────────────────
  const isLoading = backendListings.isLoading || chainListings.isLoading;
  const totalListed = backendListings.data?.listings.length ?? 0;
  const activeCount = listings.length;
  const errorMsg = backendListings.error?.message || chainListings.error?.message || '';

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto py-4 px-2 font-sans selection:bg-[#111312] selection:text-white">

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border-2 border-[#111312] p-4 shadow-sm">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">
            SUINODE LEDGER LINK
          </span>
          <span className="block font-mono text-xs font-black text-[#111312] mt-1">
            [ SUI // TESTNET-DEV // S3 ]
          </span>
        </div>

        <div className="bg-white border-2 border-[#111312] p-4 shadow-sm">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">
            DECENTRALIZED REGISTRY
          </span>
          <span className="block font-mono text-xs font-black text-[#111312] mt-1">
            {activeCount} ACTIVE DATASETS
          </span>
        </div>

        <div className="bg-white border-2 border-[#111312] p-4 shadow-sm">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">
            CONNECTED WALLET BALANCE
          </span>
          <span className="block font-mono text-xs font-black text-emerald-800 mt-1">
            {realBalance !== null ? `${realBalance.toFixed(2)} SUI` : account ? 'Loading...' : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="border-b-2 border-[#111312] pb-5 mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <span className="font-mono text-xs text-zinc-600 uppercase tracking-widest block font-bold">
            [ MODULE 01 // DATA EXCHANGE FEED ]
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#111312] uppercase mt-1">
            Active Marketplace Registry
          </h1>
        </div>

        <button
          onClick={() => { backendListings.refetch(); chainListings.refetch(); }}
          className="bg-white border-2 border-[#111312] px-4 py-2 text-[10px] font-mono text-[#111312] font-black uppercase shadow-sm flex items-center gap-2 hover:bg-[#EAEFEC] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(backendListings.isFetching || chainListings.isFetching) ? 'animate-spin' : ''}`} />
          SYNC LEDGER
        </button>
      </div>

      {/* Error */}
      {errorMsg ? (
        <div className="mb-8 bg-red-100 border-2 border-red-800 text-red-900 p-4 text-xs font-mono font-bold">
          <strong>LEDGER SETTLEMENT EXCEPTION:</strong> {errorMsg}
        </div>
      ) : null}

      {/* Loading */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 rounded-none border-2 border-[#111312]/25 border-t-[#111312] animate-spin" />
          <span className="block mt-4 font-mono text-[#111312] text-xs font-bold uppercase tracking-widest">
            Synchronizing blockchain ledger...
          </span>
        </div>
      ) : !listings.length ? (
        /* Empty */
        <div className="py-24 text-center border-2 border-dashed border-[#111312]/30 bg-[#EAEFEC] p-8">
          <Database className="w-10 h-10 text-zinc-400 mx-auto mb-4" />
          <p className="font-mono text-xs text-zinc-600 uppercase tracking-widest font-black">
            No active datasets found in the registry
          </p>
          <p className="font-mono text-[9px] text-zinc-500 mt-2 uppercase">
            Total indexed: {totalListed} — Backend status: {backendListings.error?.message || 'ok'}
          </p>
        </div>
      ) : (
        /* ── Grid of cards ── */
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {paginatedListings.map((listing) => (
            <div
              key={listing.id}
              className="bg-white border-2 border-[#111312] p-6 shadow-md hover:shadow-lg transition-shadow relative"
            >
              {/* Source badges */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {listing.chainSource && (
                  <span className="font-mono text-[8px] text-emerald-800 bg-emerald-50 border border-emerald-800 px-1.5 py-0.5 font-black uppercase">
                    ON-CHAIN
                  </span>
                )}
                {listing.backendSource && (
                  <span className="font-mono text-[8px] text-zinc-600 bg-zinc-100 border border-zinc-400 px-1.5 py-0.5 font-black uppercase">
                    INDEX
                  </span>
                )}
              </div>

              {/* Title & description */}
              <div className="pr-24">
                <h3 className="text-lg font-black tracking-tight text-[#111312] mb-2 uppercase">
                  {listing.title}
                </h3>
                <p className="text-xs text-zinc-700 font-serif leading-relaxed pr-4">
                  {listing.description}
                </p>
              </div>

              {/* Meta row */}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[9px] font-mono text-zinc-500">
                <span className="bg-[#D4D9D5] text-zinc-800 px-2 py-0.5 border border-zinc-300 font-extrabold uppercase">
                  SELLER: {formatAddress(listing.owner)}
                </span>
                <span className="text-zinc-400">|</span>
                <span>PARTS: {listing.chunkCount}</span>
                <span className="text-zinc-400">|</span>
                <span>LISTED: {new Date(listing.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Blob ID */}
              <div className="mt-3 bg-[#EAEFEC] px-3 py-1.5 border border-[#111312]/15">
                <span className="font-mono text-[8px] text-zinc-500 uppercase">BLOB:</span>{' '}
                <span className="font-mono text-[9px] text-[#111312] font-bold select-all break-all">
                  {listing.blobIds.join(', ') || '-'}
                </span>
              </div>

              {/* Price + Buy buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-[#111312]/10 pt-4 mt-4 gap-3">
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-mono text-[#111312] font-black">
                    {formatMist(listing.priceMist)}
                  </span>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  {/* Buy for Agent */}
                  <button
                    onClick={() => {
                      if (!account) {
                        toast.error('Connect your Sui wallet first to buy datasets.');
                        return;
                      }
                      backendPurchase.mutate(listing.id);
                    }}
                    disabled={!account || (backendPurchase.isPending && purchasingId === listing.id)}
                    title={!account ? 'Connect your Sui wallet to purchase datasets for your agent' : undefined}
                    className="flex-1 sm:flex-none bg-white border-2 border-[#111312] hover:bg-[#EAEFEC] text-[#111312] px-4 py-2.5 font-mono text-[10px] font-extrabold uppercase tracking-wider cursor-pointer select-none transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {purchasingId === listing.id && backendPurchase.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Purchasing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Buy for Agent
                      </>
                    )}
                  </button>

                  {/* Buy with Wallet */}
                  <button
                    onClick={async () => {
                      setWalletBuyingId(listing.id);
                      try {
                        await buyWithWallet(listing);
                      } catch {
                        toast.error('Transaction failed. Check your wallet and try again.');
                      } finally {
                        setWalletBuyingId(null);
                      }
                    }}
                    disabled={!account || !listing.chainSource || walletBuyingId === listing.id}
                    className="flex-1 sm:flex-none bg-[#111312] hover:bg-white text-white hover:text-[#111312] border-2 border-[#111312] px-4 py-2.5 font-mono text-[10px] font-extrabold uppercase tracking-wider cursor-pointer select-none transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    title={!account ? 'Connect a Sui wallet' : !listing.chainSource ? 'Only available for on-chain listings' : undefined}
                  >
                    {walletBuyingId === listing.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Buying...
                      </>
                    ) : (
                      <>
                        <Coins className="w-3.5 h-3.5" />
                        Buy with Wallet
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Pagination Controls ── */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border-2 border-[#111312] p-4">
            <span className="font-mono text-[10px] text-zinc-500 uppercase font-black">
              PAGE {currentPage} OF {totalPages} — {activeCount} DATASETS
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="bg-white border-2 border-[#111312] hover:bg-[#EAEFEC] text-[#111312] p-2 font-mono text-[10px] font-black uppercase cursor-pointer select-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 font-mono text-[10px] font-black uppercase border-2 cursor-pointer select-none transition-all ${
                    currentPage === page
                      ? 'bg-[#111312] text-white border-[#111312]'
                      : 'bg-white text-[#111312] border-[#111312] hover:bg-[#EAEFEC]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="bg-white border-2 border-[#111312] hover:bg-[#EAEFEC] text-[#111312] p-2 font-mono text-[10px] font-black uppercase cursor-pointer select-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
