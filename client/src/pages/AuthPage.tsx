import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { Eclipse, Shield, Database, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-[#D5DAD6] text-[#111312] font-sans selection:bg-[#111312] selection:text-[#D5DAD6] relative overflow-x-hidden p-3 md:p-6 transition-colors duration-500">
      {/* Tactical Grid Background */}
      <div className="absolute inset-0 tech-grid opacity-40 pointer-events-none" />

      <div className="relative border-2 border-[#111312] bg-[#E1E5E2] w-full min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 tech-grid-dense opacity-[0.15] pointer-events-none" />

        {/* Centered Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Eclipse className="w-12 h-12 text-[#111312] mb-4" />
            </motion.div>
            <h1 className="text-3xl font-black tracking-widest text-[#111312] uppercase">
              SYNAPSE
            </h1>
            <span className="font-mono text-[9px] text-zinc-500 tracking-widest uppercase mt-2">
              [ MEMORY AGENT PROTOCOL // QWEN CLOUD ]
            </span>
          </div>

          {/* Auth Card */}
          <div className="bg-white border-2 border-[#111312] p-8 shadow-lg">
            <div className="text-center mb-8">
              <h2 className="text-lg font-black tracking-wider text-[#111312] uppercase mb-2">
                Sign In
              </h2>
              <p className="text-xs text-zinc-600 font-serif italic leading-relaxed">
                Access your persistent memory agent. It evolves with every session.
              </p>
            </div>

            {/* Google Sign In Button */}
            <div className="flex justify-center mb-8">
              <GoogleLogin
                onSuccess={signInWithGoogle}
                onError={() => console.error('Google login failed')}
                text="signin_with"
                shape="rectangular"
                size="large"
                width="300"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-[#111312]/10" />
              <span className="font-mono text-[8px] text-zinc-400 tracking-widest uppercase">
                secured by
              </span>
              <div className="h-px flex-1 bg-[#111312]/10" />
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Shield, label: 'QWEN AI MODELS', sub: 'Powered by Qwen Cloud' },
                { icon: Database, label: 'PERSISTENT MEMORY', sub: 'Long-term retention' },
                { icon: Lock, label: 'AUTONOMOUS AGENTS', sub: 'Cross-session learning' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex flex-col items-center text-center">
                  <Icon className="w-4 h-4 text-[#111312] mb-1.5" />
                  <span className="font-mono text-[7px] text-zinc-600 tracking-wider font-black uppercase">
                    {label}
                  </span>
                  <span className="font-mono text-[7px] text-zinc-400 mt-0.5">
                    {sub}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Tag */}
          <div className="mt-6 text-center">
            <span className="font-mono text-[8px] text-zinc-400 tracking-widest uppercase">
              Your keys stay in your browser — non-custodial by design
            </span>
          </div>
        </motion.div>

        {/* Corner Decorations */}
        <div className="absolute top-4 left-4 hidden md:block">
          <span className="font-mono text-[9px] text-zinc-500 tracking-widest uppercase block">
            // SYNAPSE_MEMORY_AUTH
          </span>
          <span className="font-mono text-[8px] text-zinc-400 tracking-wider block mt-1">
            Google Identity Services
          </span>
        </div>

        <div className="absolute bottom-4 right-4 hidden md:block text-right">
          <span className="font-mono text-[9px] text-zinc-500 tracking-widest uppercase block">
            QWEN_CLOUD
          </span>
          <div className="flex items-center justify-end gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span className="font-mono text-[8px] text-zinc-400 tracking-wider">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
