import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Compass, ShoppingBag, Terminal, Activity, LogOut, Eclipse, CheckCircle2, Unplug, ArrowRightLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { formatMist } from './lib/sui';
import { ToastProvider } from './components/Toast';
import LandingView from './pages/LandingView';
import AuthPage from './pages/AuthPage';
import MarketplaceFeedLegacy from './pages/MarketplaceFeed';
import SellDataLegacy from './pages/SellData';
import AgentWalletLegacy from './pages/AgentWallet';
import WalletManager from './pages/WalletManager';

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

const NAV_ITEMS = [
  { to: '/feed', icon: Compass, label: '01 / DATA_MARKET' },
  { to: '/sell', icon: ShoppingBag, label: '02 / PUBLISH_LOCK' },
  { to: '/wallet', icon: Terminal, label: '03 / COMMAND_WALLETS' },
  { to: '/funds', icon: ArrowRightLeft, label: '04 / FUND_TRANSFER' },
] as const;

/* ── Route: / (Landing Page) ──────────────────────────────── */

function LandingRoute() {
  const navigate = useNavigate();
  const { googleUser, isReady } = useAuth();

  // If already signed in, skip landing and go straight to feed
  useEffect(() => {
    if (isReady && googleUser) {
      navigate('/feed', { replace: true });
    }
  }, [googleUser, isReady, navigate]);

  return <LandingView onEnter={() => navigate('/auth')} />;
}

/* ── Route: /auth (Sign In / Sign Up) ─────────────────────── */

function AuthRoute() {
  const navigate = useNavigate();
  const { googleUser, isReady } = useAuth();

  // If already signed in, go to feed
  useEffect(() => {
    if (isReady && googleUser) {
      navigate('/feed', { replace: true });
    }
  }, [googleUser, isReady, navigate]);

  return <AuthPage />;
}

/* ── Route: /feed, /sell, /wallet (App Shell) ─────────────── */

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { googleUser, isReady } = useAuth();

  useEffect(() => {
    if (isReady && !googleUser) {
      navigate('/auth', { replace: true });
    }
  }, [googleUser, isReady, navigate]);

  if (!googleUser) return null;
  return <>{children}</>;
}

const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { googleUser, address, suiClient, signOut, isReady } = useAuth();

  const balanceQuery = useQuery({
    queryKey: ['wallet-balance', address],
    queryFn: () => suiClient.getBalance({ owner: address! }),
    enabled: Boolean(address),
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
              <span className="font-mono text-[8px] text-zinc-500 tracking-widest block mt-0.5">[ PERSISTENT MEMORY AGENT // QWEN CLOUD ]</span>
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
              {address ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3E7A5E]" />
              ) : (
                <Unplug className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <div className="leading-tight text-right">
                <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-widest font-black block">
                  {address ? 'SUI_TESTNET // CONNECTED' : isReady ? 'WALLET STATE // INITIALIZING' : 'WALLET STATE // DISCONNECTED'}
                </span>
                <span className="font-mono text-xs font-black text-[#111312]">
                  {address
                    ? ` ${balanceQuery.data ? formatMist(balanceQuery.data.totalBalance) : '...'} `
                    :  ' '
                  }
                </span>
              </div>
            </div>

            {/* User info / sign out */}
            <div className="flex items-center gap-2">
              {googleUser && (
                <img
                  src={googleUser.picture}
                  alt={googleUser.name}
                  className="w-8 h-8 rounded-full border-2 border-[#111312]"
                />
              )}
              <Link
                to="/"
                onClick={signOut}
                title="Sign out"
                className="border-2 border-[#111312] bg-[#E1E5E2] hover:bg-black text-[#111312] hover:text-white p-2.5 transition-colors select-none"
              >
                <LogOut className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-grow relative z-10 w-full p-4 md:p-8">
          {location.pathname.startsWith('/sell') ? (
            <SellDataLegacy onSuccess={() => navigate('/feed')} />
          ) : location.pathname.startsWith('/wallet') ? (
            <AgentWalletLegacy wallet={wallet} />
          ) : location.pathname.startsWith('/funds') ? (
            <WalletManager />
          ) : (
            <MarketplaceFeedLegacy onRefreshWallet={fetchWallet} />
          )}
        </main>

        <footer className="border-t-2 border-[#111312] py-4 px-4 md:px-8 text-center text-[10px] font-mono text-zinc-600 bg-[#E1E5E2] relative z-10">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <Activity className="w-3.5 h-3.5 text-black animate-pulse" />
              <span className="font-bold">SYNAPSE_MEMORY_LEDGER: INTEGRAL PORT 3002 // AUTONOMOUS</span>
            </div>
            <div className="font-semibold uppercase text-[9px]">MEMORY VERIFIED // POWERED BY QWEN CLOUD + PERSISTENT MEMORY ENGINE</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

const App = () => {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingRoute />} />
              <Route path="/auth" element={<AuthRoute />} />

            {/* Protected routes (require Google sign-in) */}
            <Route path="/feed" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
            <Route path="/sell" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
            <Route path="/funds" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
