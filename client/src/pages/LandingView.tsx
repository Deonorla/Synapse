import { ArrowRight, ChevronRight, Video, Eclipse } from 'lucide-react';


import { motion } from "framer-motion"
import { ConnectButton } from '@mysten/dapp-kit';


interface LandingViewProps {
  onEnter: () => void;
}

export default function LandingView({ onEnter }: LandingViewProps) {
  return (
    <div className="min-h-screen bg-[#D5DAD6] text-[#111312] font-sans selection:bg-[#111312] selection:text-[#D5DAD6] relative overflow-x-hidden p-3 md:p-6 transition-colors duration-500">
      
      {/* Tactical Grid Background Layer */}
      <div className="absolute inset-0 tech-grid opacity-40 pointer-events-none" />

      {/* Main Structural Outer Frame - to give that clean "screen inside a display" mockup feel */}
      <div className="relative border-2 border-[#111312] bg-[#E1E5E2] w-full min-h-[calc(110vh-3rem)] flex flex-col justify-between p-4 md:p-8 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 tech-grid-dense opacity-[0.25] pointer-events-none" />
        
        {/* Top Minimalist Header Tagged directly from Vanguard design */}
        <header className="relative z-20 flex flex-wrap justify-between items-start border-b border-[#111312]/10 pb-6 gap-4">
          <div className="flex items-start space-x-3 sm:space-x-6">
            {/* Vanguard inspired clean shape mark */}
            <div className="flex flex-col items-start">
              <div className="flex items-center space-x-2">
                <Eclipse className="w-6 h-6 text-[#111312] animate-spin-slow" />
                <span className="font-extrabold tracking-widest text-[#111312] text-lg uppercase font-sans">SYNAPSE</span>
              </div>
              <span className="font-mono text-[9px] tracking-widest text-zinc-600 uppercase mt-1">[ VANGUARD COGNITIVE CORE ]</span>
            </div>
          </div>

          {/* Minimal Products / About links */}
          <div className="hidden md:flex items-center space-x-8 font-serif text-xs text-zinc-600 italic">
            <span className="uppercase font-mono tracking-wider font-semibold not-italic">[ LATEST_INTELLIGENCE ]</span>
            {/* <span>//</span>
            <span className="hover:text-black cursor-pointer">walrus security</span>
            <span>//</span>
            <span className="hover:text-black cursor-pointer">sui devnet ledger</span> */}
          </div>

        {/* Extreme Right Navigation Action Blocks */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="synapse-wallet-button">
            <ConnectButton
              connectText={
                <span className="inline-flex items-center gap-2">
                  <Eclipse className="w-4 h-4" />
                  Connect Wallet
                </span>
              }
            />
          </div>
        </div>

        </header>

        {/* Central Master Hero Piece */}
        <div className="relative my-4 sm:my-8 flex flex-col items-center justify-center min-h-[400px] sm:min-h-[600px] z-10">

          {/* GHOST TEXT — anchored to bottom so brain breaks above it */}
          <div className="absolute bottom-24 left-0 right-0 flex items-end justify-center select-none pointer-events-none z-0">
            <span
              className="font-sans font-black tracking-tighter text-[13vw] uppercase leading-none text-center select-none"
              style={{ WebkitTextStroke: "2px #111312", color: "transparent", opacity: 0.12 }}
            >
              SYNAPSE
            </span>
          </div>

          {/* Side left — pulled back, doesn't compete */}
          <div className="absolute top-4 left-0 hidden lg:block max-w-[180px] space-y-2 text-left">
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block">// SYSTEM_REGISTRY_2026</span>
            <div className="font-sans text-sm font-bold tracking-tight uppercase bg-[#111312] text-[#E1E5E2] px-2.5 py-1 inline-block">
              SUI NETWORK
            </div>
            <div className="text-xs font-mono text-zinc-600 tracking-wider">[ SECURE COGNITIVE DATABASE ]</div>
          </div>

          {/* Side right — unchanged */}
          <div className="absolute top-4 right-0 hidden lg:block max-w-xs text-right space-y-3">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">[ DESIGN METRICS ]</div>
            <div className="text-xs text-zinc-800 font-mono tracking-tight text-right uppercase space-y-1">
              <div>VISUAL DESIGN BY DEONORLA</div>
              <div className="text-zinc-400 font-semibold">[ CODE: 6829_MUTABLE ]</div>
            </div>
            <ul className="space-y-1 mt-4 text-[10px] font-mono text-zinc-500 uppercase inline-block border-r-2 border-[#111312] pr-3 text-right">
              <li>× Generative Models Active</li>
              <li>× Walrus Storage Node</li>
              <li>× Sui Network Sync Link</li>
            </ul>
          </div>

          {/* BRAIN — larger, with atmospheric glow beneath */}
          <div className="relative z-10 w-full max-w-sm sm:max-w-lg mx-auto">
            {/* Radial glow layer — sits under the brain */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(180,80,80,0.18) 0%, transparent 70%)",
                filter: "blur(24px)",
                transform: "scaleY(0.6) translateY(20%)",
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 35 }}
              animate={{ opacity: 1, y: [0, -16, 0] }}
              transition={{
                opacity: { duration: 1.2, ease: "easeOut" },
                y: { repeat: Infinity, duration: 5, ease: "easeInOut" },
              }}
              whileHover={{ scale: 1.04 }}
              className="relative cursor-pointer"
            >
              <img
                src="/brain.png"
                alt="Synapse Neural Brain View"
                referrerPolicy="no-referrer"
                className="w-full h-72  sm:h-[520px] object-contain -mt-60 mx-auto"
                style={{ filter: "drop-shadow(0 20px 60px rgba(160,60,60,0.35))" }}
              />
            </motion.div>
          </div>

          {/* Quote — overlaid at bottom-left, not stacked below */}
          <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-2 px-4">
            <h2 className="text-lg sm:text-xl font-serif font-light font-mono text-[#111312] tracking-tight leading-tight text-center max-w-md opacity-75">
              "A data marketplace where AI agents can learn on their own"
            </h2>
          </div>

        </div>

        {/* Bottom Panel Layout: Features QR style indicator and the main Call-to-Action button link inside a tech workspace block */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-end border-t border-[#111312]/10 pt-6">
          
          {/* Bottom Left: Tech details and mock QR status block */}
          <div className="md:col-span-4 flex items-center space-x-3 sm:space-x-4">
            <div className="w-14 h-14 bg-[#111312] p-1 flex items-center justify-center text-[#E1E5E2] font-mono text-[8px] tracking-tight select-none">
              <div className="grid grid-cols-4 gap-0.5 w-full h-full p-1 bg-white text-black">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={`w-full h-full ${Math.random() > 0.45 ? "bg-black" : "bg-white"}`} />
                ))}
              </div>
            </div>
            <div>
              <span className="font-mono text-[9px] text-[#111312] tracking-wider block font-black uppercase">[ WALRUS STATUS INDEXED ]</span>
              <p className="text-[11px] text-zinc-600 font-mono tracking-tight leading-normal mt-0.5">
                BLOB_ID_ENCRYPTED_AESGCM<br />
                Sovereign custody protocols online
              </p>
            </div>
          </div>

          {/* Bottom Middle: Direct enter command CTA button inside high-contrast style */}
          <div className="md:col-span-4 flex flex-col justify-center items-center">
            <button
              onClick={onEnter}
              className="group w-full max-w-[280px] bg-[#111312] hover:bg-white text-white hover:text-[#111312] border-2 border-[#111312] px-6 py-4 font-bold tracking-widest text-xs uppercase duration-300 shadow-md cursor-pointer text-center flex items-center justify-between"
            >
              <span>ACCESS THE PLATFORM</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </button>
          </div>

          {/* Bottom Right: Mock Video/Integrative system controls */}
          <div className="md:col-span-4 flex justify-end items-center">
            <div 
              onClick={onEnter}
              className="flex items-center space-x-3 bg-white hover:bg-zinc-100 p-2 border border-[#111312] cursor-pointer shadow-sm select-none"
            >
              <div className="w-10 h-10 bg-[#111312] text-white flex items-center justify-center">
                <Video className="w-5 h-5 fill-white" />
              </div>
              <div className="text-left font-mono pr-4">
                <span className="text-[8px] text-zinc-500 block uppercase font-bold">SYSTEM TUTORIAL</span>
                <span className="text-[10px] text-zinc-800 block font-bold uppercase">SECURE INGESTION</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Blueprint section with structural overview & dna.png */}
      <section className="mt-12 border-2 border-[#111312] bg-[#EAEFEC] relative z-10 overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none" />

        {/* ── SECTION HEADER ── */}
        <div className="relative border-b border-[#111312]/15 px-6 sm:px-12 pt-10 pb-8">
          <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase block mb-3">
            [ tactical telemetry module ]
          </span>

          {/* Split headline — word 1 solid, word 2 outlined */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0">
            <h3 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#111312] uppercase leading-none">
              Decentralized
            </h3>
            <h3
              className="text-4xl sm:text-6xl font-extrabold tracking-tight uppercase leading-none"
              style={{
                WebkitTextStroke: "2px #111312",
                color: "transparent",
              }}
            >
              Blueprint
            </h3>
          </div>

          {/* Thin rule with tick marks — blueprint feel */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#111312]/20" />
            <span className="font-mono text-[9px] text-zinc-400 tracking-widest">
              SUI_NETWORK · WALRUS_STORAGE · v2026
            </span>
            <div className="h-px w-12 bg-[#111312]/20" />
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12">

          {/* LEFT — 4 feature rows as a ledger, not 2-col cards */}
          <div className="lg:col-span-7 divide-y divide-[#111312]/10">

            {[
              {
                num: "01",
                title: "Sellers list data",
                body: "Upload research, CSVs, PDFs, signals, or knowledge packs. The app encrypts the data before storage.",
                tag: "ENCRYPT → STORE",
              },
              {
                num: "02",
                title: "Agents browse and buy",
                body: "Fund an agent wallet once. Your agent finds relevant datasets and pays sellers automatically.",
                tag: "DISCOVER → PURCHASE",
              },
              {
                num: "03",
                title: "Everyone stays in control",
                body: "Sellers set the price. Buyers control the wallet. Private data remains protected until access is purchased.",
                tag: "CUSTODY → GOVERNED",
              },
              {
                num: "04",
                title: "Sui network settlement",
                body: "The SUI ledger executes payment to seller addresses, releases decryption credentials, and writes to agent memory.",
                tag: "SETTLE → UNLOCK",
              },
            ].map((item) => (
              <div key={item.num} className="flex items-start gap-3 sm:gap-6 px-4 sm:px-12 py-5 sm:py-7 group hover:bg-[#111312]/[0.03] transition-colors">
                {/* Step number */}
                <span className="font-mono text-2xl font-black text-[#111312]/10 leading-none pt-1 flex-shrink-0 w-8">
                  {item.num}
                </span>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs font-bold text-zinc-900 uppercase tracking-wide">
                      {item.title}
                    </span>
                    <span className="font-mono text-[9px] text-zinc-400 tracking-widest border border-[#111312]/15 px-2 py-0.5 hidden sm:inline-block">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed font-serif max-w-sm">
                    {item.body}
                  </p>
                </div>
                {/* Right arrow — blueprint tick */}
                <span className="font-mono text-xs text-[#111312]/15 group-hover:text-[#111312]/30 transition-colors flex-shrink-0 pt-1">→</span>
              </div>
            ))}
          </div>

          {/* RIGHT — DNA image properly anchored, fills the column */}
          <div className="lg:col-span-5 relative border-t lg:border-t-0 lg:border-l border-[#111312]/10 flex items-center justify-center min-h-[320px] sm:min-h-[420px] overflow-hidden">
            {/* Ghost label behind DNA */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
              aria-hidden="true"
            >
              <span
                className="font-mono font-black text-[11vw] lg:text-[5vw] tracking-tighter uppercase"
                style={{ WebkitTextStroke: "1px rgba(17,19,18,0.07)", color: "transparent" }}
              >
                DNA
              </span>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.93 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 1, ease: "easeOut" }}
              animate={{ y: [0, -14, 0], rotate: [-0.4, 0.4, -0.4] }}
              style={{
                animationTimingFunction: "easeInOut",
              }}
            >
              <motion.div
                animate={{ y: [0, -14, 0], rotate: [-0.4, 0.4, -0.4] }}
                transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
                whileHover={{ scale: 1.04 }}
                className="cursor-pointer px-8"
              >
                <img
                  src="/dna.png"
                  alt="Synapse Abstract DNA Wireframe"
                  referrerPolicy="no-referrer"
                  className="w-full max-w-[280px] sm:max-w-xs h-[380px] sm:h-[460px] object-contain mx-auto"
                  style={{
                    filter: "drop-shadow(0 24px 48px rgba(17,19,18,0.2))",
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Bottom corner tag */}              <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 font-mono text-[8px] text-zinc-400 tracking-widest text-right">
              WALRUS_BLOB_GRID<br />
              <span className="text-zinc-300">ENCRYPTED · IMMUTABLE</span>
            </div>
          </div>

        </div>

        {/* ── BOTTOM CTA STRIP ── */}
        <div className="relative border-t border-[#111312]/15">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#111312]/10">

            {/* Left stat */}
            <div className="px-6 sm:px-12 py-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#111312] flex-shrink-0 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-px w-5 h-5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className={`w-full h-full ${[0,1,3,4,7].includes(i) ? "bg-white" : "bg-transparent"}`} />
                  ))}
                </div>
              </div>
              <div>
                <span className="font-mono text-[9px] text-[#111312] tracking-wider block font-black uppercase">
                  [ WALRUS STATUS INDEXED ]
                </span>
                <p className="text-[10px] text-zinc-500 font-mono tracking-tight mt-0.5 leading-relaxed">
                  BLOB_ID_ENCRYPTED_AESGCM<br />
                  Sovereign custody protocols online
                </p>
              </div>
            </div>

            {/* Centre CTA */}
            <div className="px-6 py-6 flex items-center justify-center">
              <button
                onClick={onEnter}
                className="group w-full max-w-[300px] bg-[#111312] hover:bg-white text-white hover:text-[#111312] border-2 border-[#111312] px-6 py-4 font-bold tracking-widest text-xs uppercase duration-300 shadow-md cursor-pointer flex items-center justify-between"
              >
                <span>Load Synapse Market Labs</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Right live status */}
            <div className="px-6 sm:px-12 py-6 flex items-center justify-end gap-3">
              <div className="text-right">
                <span className="font-mono text-[9px] text-zinc-500 tracking-widest uppercase block">network status</span>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  <span className="font-mono text-[10px] text-zinc-800 font-bold">SUI TESTNET LIVE</span>
                </div>
                <span className="font-mono text-[8px] text-zinc-400 tracking-wide">latency: 14ms · nodes: 94</span>
              </div>
            </div>

          </div>
        </div>

      </section>    

      {/* Corporate disclaimer & validation lines */}
      <footer className="mt-12 border-2 border-[#111312] bg-[#111312] text-[#D5DAD6] py-10 px-6 sm:px-12 relative z-10 text-center font-mono text-[10px] uppercase">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} SYNAPSE VANGUARD PROTOCOL. CLIENT-SIDE TRUST ASSURED CRYPTOGRAPHICALLY.</div>
          <div className="flex space-x-4">
            <span className="text-[#D8DDD9]">WALRUS BLOB GRID</span>
            <span>//</span>
            <span className="text-[#D8DDD9]">SUI WORKSPACE V3</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
