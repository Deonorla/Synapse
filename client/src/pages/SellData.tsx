import React, { useState } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  CheckCircle,
  Database,
  HelpCircle,
  FileUp,
  Loader2,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { api } from '../lib/api';
import { formatMist, buildListDatasetTx } from '../lib/sui';
import { useSeal } from '../hooks/useSeal';
import { uploadToWalrus } from '../lib/walrus';
import { useToast } from '../components/Toast';

interface SellDataLegacyProps {
  onSuccess: () => void;
}

async function readFileForBackend(file: File): Promise<string> {
  if (file.type.startsWith('text/') || file.name.match(/\.(csv|json|txt|md)$/i)) {
    return file.text();
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return JSON.stringify({
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    encoding: 'base64',
    data: btoa(binary),
  });
}


export default function SellDataLegacy({ onSuccess }: SellDataLegacyProps) {
  const account = useCurrentAccount();
  const { encryptData } = useSeal();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // ─── Form state ─────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceSui, setPriceSui] = useState('');
  const [datasetText, setDatasetText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // ─── UI state ───────────────────────────────────────────────
  const [statusStep, setStatusStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [blobId, setBlobId] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // ─── Queries ────────────────────────────────────────────────
  const listings = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: api.listings,
    refetchInterval: 15000,
  });

  const totalListings = listings.data?.listings.filter((l) => l.isActive).length ?? 0;

  // ─── Handlers ───────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) return setErrorMsg('Dataset title is required.');
    if (!description.trim() || description.length < 20)
      return setErrorMsg('Description must be at least 20 characters.');
    if (!datasetText.trim()) return setErrorMsg('Provide dataset content to encrypt.');
    const priceNum = parseFloat(priceSui);
    if (Number.isNaN(priceNum) || priceNum <= 0) return setErrorMsg('Price must be a valid positive number.');

    try {
      if (!account) throw new Error('Connect your Sui wallet first');

      setIsPublishing(true);
      // Step 1: Generate random 32-byte Seal policy ID
      setStatusStep(1);
      const policyIdBytes = crypto.getRandomValues(new Uint8Array(32));
      const policyId = Array.from(policyIdBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

      // Step 2: Encrypt in browser via Seal
      setStatusStep(2);
      const encryptedBytes = await encryptData(datasetText, policyId);

      // Step 3: Upload to Walrus from browser
      setStatusStep(3);
      const uploadedBlobId = await uploadToWalrus(encryptedBytes);
      setBlobId(uploadedBlobId);

      // Step 4: Sign and submit listing transaction from user's wallet
      setStatusStep(4);
      const priceMist = Math.round(priceNum * 1_000_000_000);
      const tx = buildListDatasetTx({
        title,
        description,
        priceMist,
        blobId: uploadedBlobId,
        policyIdBytes,
      });
      const result = await signAndExecute({ transaction: tx as any });

      // Notify backend to index the listing for fast reads
      try {
        await api.indexListing({
          digest: result.digest,
          blobId: uploadedBlobId,
          policyId,
          title,
          description,
          priceMist,
          sellerAddress: account.address,
        });
      } catch (indexErr) {
        console.warn('[SellData] Backend indexing failed (non-critical):', indexErr);
      }

      // Step 5: Done — reset
      setStatusStep(5);
      toast.success(`"${title}" published to marketplace — encrypted & listed on-chain.`);
      setTitle('');
      setDescription('');
      setPriceSui('');
      setDatasetText('');
      setSelectedFileName(null);
      setBlobId('');
      setStatusStep(0);
      setIsPublishing(false);
      await queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Listing failed.';
      setErrorMsg(msg);
      toast.error(msg);
      setStatusStep(0);
      setIsPublishing(false);
    }
  };

  // ─── Wallet disconnected guard ──────────────────────────────
  if (!account) {
    return (
      <div className="max-w-6xl mx-auto py-4 px-2 font-sans selection:bg-[#111312] selection:text-white">
        <div className="border-b-2 border-[#111312] pb-5 mb-8">
          <span className="font-mono text-xs text-zinc-650 uppercase tracking-widest block font-bold">
            [ MODULE 02 // SELL & ENCRYPT PORTAL ]
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#111312] uppercase mt-1">
            Wallet Required
          </h1>
        </div>
        <div className="bg-white border-2 border-[#111312] p-8 shadow-md text-center">
          <FileUp className="w-10 h-10 text-zinc-400 mx-auto mb-4" />
          <p className="font-mono text-xs text-zinc-600 uppercase tracking-widest font-black mb-2">
            NO SUI WALLET DETECTED
          </p>
          <p className="text-sm text-zinc-500 font-serif italic max-w-md mx-auto">
            Connect your Sui wallet using the button in the top-right corner to encrypt and publish datasets.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto py-4 px-2 font-sans selection:bg-[#111312] selection:text-white">
      {/* Header */}
      <div className="border-b-2 border-[#111312] pb-5 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="font-mono text-xs text-zinc-600 uppercase tracking-widest block font-bold">
            [ MODULE 02 // SELL & ENCRYPT PORTAL ]
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#111312] uppercase mt-1">
            Publish Encrypted Listing
          </h1>
          <p className="text-sm text-zinc-600 mt-2 max-w-2xl font-serif leading-relaxed italic">
            Add the data you want to sell, set a price, and publish. Data is encrypted in-browser with Seal, uploaded
            to Walrus, and the listing is registered on-chain.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border-2 border-[#111312] px-3 py-1.5 text-[10px] font-mono text-[#111312] font-black uppercase shadow-sm">
            {totalListings} ACTIVE LISTINGS
          </div>
          <button
            onClick={() => listings.refetch()}
            className="bg-white border-2 border-[#111312] px-3 py-1.5 text-[10px] font-mono text-[#111312] font-black uppercase shadow-sm flex items-center gap-1.5 hover:bg-[#EAEFEC] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${listings.isFetching ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── Main form ── */}
        <div className="lg:col-span-8 bg-white border-2 border-[#111312] p-6 sm:p-8 relative shadow-md">
          <div className="absolute top-4 right-4 text-[8px] font-mono text-zinc-500 uppercase font-black tracking-wider">
            [ SECURE SANDBOXED WRAPPER ]
          </div>

          {errorMsg ? (
            <div className="mb-6 bg-red-100 border-2 border-red-800 text-red-900 p-4 text-xs font-mono flex items-start space-x-3 font-bold">
              <ShieldAlert className="w-4 h-4 mt-0.5 text-red-700 flex-shrink-0" />
              <div>
                <strong>LISTING ERROR:</strong>
                <p className="mt-1 font-medium">{errorMsg}</p>
              </div>
            </div>
          ) : null}

          {statusStep > 0 ? (
            /* ── Step animation ── */
            <div className="py-12 flex flex-col justify-center items-center text-center space-y-8">
              <div className="relative">
                <div className="w-16 h-16 rounded-none border-2 border-[#111312]/20 border-t-[#111312] animate-spin" />
                <Database className="w-6 h-6 text-[#111312] absolute inset-0 m-auto animate-pulse" />
              </div>

              <div className="space-y-3 max-w-md">
                <h3 className="text-md font-mono text-zinc-900 tracking-widest uppercase font-black">
                  {statusStep === 1 && 'SEAL_POLICY_GENERATION'}
                  {statusStep === 2 && 'CRYPTOGRAPHIC_ENCRYPTION_ACTIVE'}
                  {statusStep === 3 && 'WALRUS_MUTABLE_BLOB_COMMIT'}
                  {statusStep === 4 && 'SUI_LEDGER_BROADCAST_PUBLISH'}
                  {statusStep === 5 && 'SYNAPSE_LEDGER_SUCCESS'}
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed font-serif italic">
                  {statusStep === 1 && 'Generating random 32-byte Seal policy ID...'}
                  {statusStep === 2 && 'Encrypting data in-browser via Seal threshold cryptography...'}
                  {statusStep === 3 && 'Uploading encrypted payload to Walrus decentralized storage...'}
                  {statusStep === 4 && 'Requesting wallet signature and registering listing on Sui Testnet...'}
                  {statusStep === 5 && 'Listing published successfully!'}
                </p>
              </div>

              <div className="w-full max-w-xs grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`h-2 transition-colors duration-300 ${
                      statusStep >= step ? 'bg-black' : 'bg-zinc-200'
                    }`}
                  />
                ))}
              </div>

              <div className="text-zinc-700 font-mono text-[9px] tracking-widest bg-[#EAEFEC] px-3 py-1.5 border border-zinc-300">
                BLOB: {blobId || '[ ALLOCATING_IMMUTABLE_HASH_ADDRESS ]'}
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title + Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 font-black">
                    Dataset Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    placeholder="e.g. Neuro-Anatomy_fMRI_Volumetric_Metrics"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#EAEFEC] border-2 border-[#111312] focus:bg-white focus:border-[#111312] p-3 text-sm text-[#111312] font-mono rounded-none focus:outline-none transition-colors font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 font-black">
                    Price (SUI)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 0.0001, 0.01, 1.5, 5.0"
                    value={priceSui}
                    onChange={(e) => setPriceSui(e.target.value)}
                    className="w-full bg-[#EAEFEC] border-2 border-[#111312] p-3 text-sm text-[#111312] font-mono rounded-none focus:outline-none font-bold"
                  />
                  {priceSui && !isNaN(parseFloat(priceSui)) && parseFloat(priceSui) > 0 && (() => {
                    const mist = Math.round(parseFloat(priceSui) * 1_000_000_000);
                    if (mist === 0) {
                      return (
                        <span className="text-[9px] font-mono text-amber-700 mt-1 block font-bold bg-amber-50 border border-amber-300 px-2 py-1">
                          ⚠ Price too low — rounds to 0 MIST. Minimum is ~0.000000001 SUI (1 MIST).
                        </span>
                      );
                    }
                    return (
                      <span className="text-[9px] font-mono text-zinc-500 mt-1 block font-bold">
                        = {formatMist(mist)} (MIST)
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 font-black">
                  Marketplace Metadata Description
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={500}
                  placeholder="Summarize what agents will find in this dataset..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#EAEFEC] border-2 border-[#111312] p-3 text-sm text-[#111312] font-serif rounded-none focus:outline-none leading-relaxed italic"
                />
                <span className="text-[9px] text-zinc-500 font-mono mt-1 block font-bold">
                  ({description.length} / 500 characters)
                </span>
              </div>

              {/* File upload */}
              <div className="border-t border-[#111312]/15 pt-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider font-extrabold flex items-center">
                    <FileUp className="w-3.5 h-3.5 mr-1.5" />
                    Dataset Content
                  </label>
                  {selectedFileName && (
                    <span className="text-[9px] text-zinc-500 font-mono font-bold">{selectedFileName}</span>
                  )}
                </div>

                <div className="mb-3 rounded-lg border-2 border-dashed border-[#111312]/30 bg-[#EAEFEC] p-4 hover:border-[#111312] transition-colors">
                  <label className="flex cursor-pointer flex-col items-center justify-center text-center">
                    <FileUp className="mb-2 h-5 w-5 text-zinc-500" />
                    <span className="text-[10px] font-mono text-zinc-600 uppercase font-bold">
                      {selectedFileName ?? 'Choose a CSV, JSON, TXT, MD file or paste below'}
                    </span>
                    <span className="mt-1 text-[9px] text-zinc-400 font-mono">
                      Text files loaded directly. Binary files packaged before encryption.
                    </span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.json,.csv,.txt,.md,application/pdf,application/json,text/csv,text/plain,text/markdown"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setSelectedFileName(file.name);
                        readFileForBackend(file)
                          .then(setDatasetText)
                          .catch(() => setErrorMsg('Failed to read file.'));
                      }}
                    />
                  </label>
                </div>

                <textarea
                  required
                  rows={5}
                  placeholder="VOX_ID,TIME_MS,BOLD_Z_SCORE... (or paste file content above)"
                  value={datasetText}
                  onChange={(e) => setDatasetText(e.target.value)}
                  className="w-full bg-[#111312] border-2 border-[#111312] p-3 text-xs text-emerald-400 font-mono rounded-none focus:outline-none leading-relaxed"
                />
                <span className="text-[9px] text-zinc-500 font-mono mt-1 block font-bold">
                  ({datasetText.length} bytes)
                </span>
              </div>

              {/* Encryption info bar */}
              <div className="bg-[#EAEFEC] border border-[#111312]/20 p-4 flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-800 flex-shrink-0" />
                <div>
                  <span className="text-[10px] font-mono text-zinc-800 font-black uppercase block">
                    Client-side Seal encryption active — keys never leave the browser
                  </span>
                  <p className="text-[9px] text-zinc-500 font-serif italic mt-0.5">
                    A random 32-byte policy ID is generated per listing. Encrypted payload uploads to Walrus; only
                    metadata is indexed on-chain.
                  </p>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={
                    isPublishing ||
                    !title.trim() ||
                    !description.trim() ||
                    !datasetText.trim() ||
                    priceSui === '' ||
                    parseFloat(priceSui) <= 0
                  }
                  className="w-full md:w-auto bg-[#111312] hover:bg-white text-white hover:text-[#111312] border-2 border-[#111312] px-8 py-4 font-extrabold tracking-widest text-xs uppercase duration-300 shadow-md cursor-pointer select-none disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Encrypting & Publishing...
                    </>
                  ) : (
                    'Encrypt & Publish Listing'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Presets */}
          {/* <div className="bg-white border-2 border-[#111312] p-6 relative shadow-md">
            <h3 className="text-xs font-mono text-[#111312] uppercase tracking-widest mb-4 flex items-center font-black">
              <Layers className="w-4 h-4 mr-2" />
              Dataset Presets (Fast Load)
            </h3>
            <p className="text-xs text-zinc-600 mb-4 font-serif italic leading-relaxed">
              Click any preset to fill the form with sample data.
            </p>
            <div className="space-y-3">
              {PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => handleApplyPreset(idx)}
                  className="p-3 bg-[#EAEFEC] hover:bg-[#111312] border border-[#111312]/30 hover:border-[#111312] transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs text-[#111312] group-hover:text-white font-bold truncate max-w-[180px]">
                      {preset.title}
                    </span>
                    <span className="font-mono text-[9px] bg-white group-hover:bg-[#EAEFEC] text-zinc-800 border border-[#111312]/30 px-1.5 py-0.5 font-black uppercase">
                      {preset.price} SUI
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-500 group-hover:text-zinc-350 mt-1 truncate font-serif italic">
                    {preset.description.substring(0, 60)}...
                  </div>
                </div>
              ))}
            </div>
          </div> */}

          {/* Flow info */}
          <div className="bg-white border-2 border-[#111312]/90 p-6 space-y-4">
            <h3 className="text-xs font-mono text-[#111312] uppercase tracking-widest flex items-center font-black">
              <HelpCircle className="w-4 h-4 mr-2" />
              How It Works
            </h3>
            <div className="space-y-4 text-xs font-serif leading-relaxed italic text-zinc-600">
              <div>
                <strong className="text-[#111312] block font-sans not-italic font-black text-xs uppercase mb-1">
                  1. Seal Encryption
                </strong>
                <p>Data is encrypted in your browser using threshold cryptography. No plaintext ever reaches a server.</p>
              </div>
              <div>
                <strong className="text-[#111312] block font-sans not-italic font-black text-xs uppercase mb-1">
                  2. Walrus Upload
                </strong>
                <p>Encrypted payload is uploaded to Walrus decentralized storage. Only the blob ID is stored on-chain.</p>
              </div>
              <div>
                <strong className="text-[#111312] block font-sans not-italic font-black text-xs uppercase mb-1">
                  3. On-Chain Listing
                </strong>
                <p>Your wallet registers the listing on Sui Testnet. The backend only indexes metadata for fast reads.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
