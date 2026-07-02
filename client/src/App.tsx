import { useState, useEffect } from 'react';
import { createNetworkConfig, SuiClientProvider, WalletProvider, ConnectButton, useCurrentAccount, useCurrentWallet, useSuiClient, useWallets } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Compass, ShoppingBag, Terminal, Activity, LogOut, Eclipse, Wallet, CheckCircle2, Unplug } from 'lucide-react';
import { formatMist } from './lib/sui';
import { ToastProvider } from './components/Toast';
import LandingViewLegacy from './pages/LandingView';
import MarketplaceFeedLegacy from './pages/MarketplaceFeed';
import SellDataLegacy from './pages/SellData';
import AgentWalletLegacy from './pages/AgentWallet';

interface Wallet {
  address: string;
  seedPhrase: string;
  privateKey: string;
  balance: number;
  toggleLoop: boolean;
  interests: string;
  maxBudgetPurchase: number;
}

const queryClient = new QueryClient();
const { networkConfig } = createNetworkConfig({
  testnet: { url: 'https://fullnode.testnet.sui.io:443' },
});

const NAV_ITEMS = [
  { to: '/feed', icon: Compass, label: '01 / DATA_MARKET' },
  { to: '/sell', icon: ShoppingBag, label: '02 / PUBLISH_LOCK' },
  { to: '/wallet', icon: Terminal, label: '03 / COMMAND_WALLETS' },
] as const;

function LandingRoute() {
  const navigate = useNavigate();
  const account = useCurrentAccount();

  // Auto-navigate to data marketplace when wallet connects on landing page
  useEffect(() => {
    if (account) {
      navigate('/feed', { replace: true });
    }
  }, [account, navigate]);

  return <LandingViewLegacy onEnter={() => navigate('/feed')} />;
}

/* ------------------------------------------------------------------ */
/*  Main AppShell                                                     */
/* ------------------------------------------------------------------ */

const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === '/';

  // Real Sui wallet connection
  const account = useCurrentAccount();
  const suiWallet = useCurrentWallet();
  const suiClient = useSuiClient();
  const wallets = useWallets();
  const isSlushAvailable = wallets.some((w: any) => w.name === 'Slush');

  const balanceQuery = useQuery({
    queryKey: ['wallet-balance', account?.address],
    queryFn: () => suiClient.getBalance({ owner: account!.address! }),
    enabled: Boolean(account?.address),
    refetchInterval: 15000,
  });

  // Shared state of the backend agent wallet
  const [wallet, setWallet] = useState<Wallet>({
    address: '',
    seedPhrase: '',
    privateKey: '',
    balance: 0,
    toggleLoop: false,
    interests: '',
    maxBudgetPurchase: 0,
  });

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/agent/status');
      if (!res.ok) return;
      const data = await res.json();
      setWallet(prev => ({
        ...prev,
        address: data.ownerAddress || prev.address,
        toggleLoop: data.isRunning ?? prev.toggleLoop,
      }));
    } catch (e) {
      console.error('Failed to fetch wallet from master nodes', e);
    }
  };


  /* ---- Landing layout (no header/footer shell) ---- */
  if (isLanding) {
    return (
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  /* ---- App shell layout ---- */
  return (
    <div className="min-h-screen bg-[#D6DAD7] text-[#111312] font-sans selection:bg-[#111312] selection:text-[#D6DAD7] flex flex-col relative overflow-x-hidden p-3 md:p-6">
      <div className="absolute inset-0 tech-grid opacity-[0.35] pointer-events-none" />

      <div className="relative border-2 border-[#111312] bg-[#E1E5E2] w-full flex-grow flex flex-col justify-between overflow-hidden shadow-2xl">
        <div className="absolute inset-0 tech-grid-dense opacity-[0.15] pointer-events-none" />

        <header className="border-b-2 border-[#111312] bg-[#E1E5E2] relative z-20 px-4 md:px-8 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Eclipse className="w-5 h-5 text-[#111312]" />
            <div>
              <h1 className="text-xl font-black tracking-widest text-[#111312] uppercase leading-none">SYNAPSE</h1>
              <span className="font-mono text-[8px] text-zinc-500 tracking-widest block mt-0.5">[ SECURE DATA PLAZA PROTOCOL // SUI ]</span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center border border-[#111312]/20 bg-[#D4D9D5] p-1 select-none">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 font-mono text-[10px] md:text-xs tracking-wider uppercase font-extrabold flex items-center space-x-1.5 transition-all duration-200 ${
                  location.pathname === to
                    ? 'bg-[#111312] text-white'
                    : 'text-zinc-700 hover:text-black hover:bg-[#E1E5E2]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-3 justify-between xl:justify-end">
            {/* Connected wallet status */}
            <div className="hidden md:flex items-center gap-2 bg-[#D4D9D5] border border-[#111312]/20 px-3.5 py-1.5">
              {account ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3E7A5E]" />
              ) : (
                <Unplug className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <div className="leading-tight text-right">
                <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-widest font-black block">
                  {account ? 'SUI_TESTNET // CONNECTED' : suiWallet.isConnecting ? 'CONNECTING...' : 'WALLET STATE // DISCONNECTED'}
                </span>
                <span className="font-mono text-xs font-black text-[#111312]">
                  {account
                    ? ` ${balanceQuery.data ? formatMist(balanceQuery.data.totalBalance) : '...'} `
                    :  ' '
                  }
                </span>
              </div>
            </div>

            {/* Connect wallet button */}
            <div className="synapse-wallet-button">
              {isSlushAvailable ? (
                <ConnectButton
                  connectText={
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      Connect
                    </span>
                  }
                />
              ) : (
                <a
                  href="https://chromewebstore.google.com/detail/slush/wpnkohnepmfndnbhlijahamhiihankppl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-col items-center gap-1 group"
                >
                  <span className="inline-flex items-center gap-1.5 bg-[#111312] text-white border-2 border-[#111312] px-4 py-2 font-mono text-[10px] font-extrabold uppercase tracking-wider hover:bg-white hover:text-[#111312] transition-colors no-underline">
                    <Wallet className="w-3.5 h-3.5" />
                    Install Slush
                  </span>
                  <span className="text-[7px] font-mono text-zinc-500 uppercase tracking-wider">
                    Required for secure dataset publishing
                  </span>
                </a>
              )}
            </div>

            <Link
              to="/"
              title="Warp back to Interactive Landing"
              className="border-2 border-[#111312] bg-[#E1E5E2] hover:bg-black text-[#111312] hover:text-white p-2.5 transition-colors select-none"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <main className="flex-grow relative z-10 w-full p-4 md:p-8">
          <Routes>
            <Route path="/feed" element={<MarketplaceFeedLegacy onRefreshWallet={fetchWallet} />} />
            <Route path="/sell" element={<SellDataLegacy onSuccess={() => navigate('/feed')} />} />
            <Route path="/wallet" element={<AgentWalletLegacy wallet={wallet} />} />
            <Route path="*" element={<Navigate to="/feed" replace />} />
          </Routes>
        </main>

        <footer className="border-t-2 border-[#111312] py-4 px-4 md:px-8 text-center text-[10px] font-mono text-zinc-600 bg-[#E1E5E2] relative z-10">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <Activity className="w-3.5 h-3.5 text-black animate-pulse" />
              <span className="font-bold">SUI_SOCIETY_LEDGER: INTEGRAL PORT 3000 // DECENTRALIZED</span>
            </div>
            <div className="font-semibold uppercase text-[9px]">MUTABILITY VERIFIED // POWERED BY WALRUS DISKS + GEMINI MEMORY ENGINE</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect walletFilter={(wallet: any) => wallet.name === 'Slush'}>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;
