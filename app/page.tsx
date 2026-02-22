import Image from "next/image";
import Link from "next/link";

const stats = [
  { label: "Publications Scanned", value: "42.8M+" },
  { label: "Accuracy Delta", value: "±0.002" },
  { label: "Active Institutions", value: "1,200+" },
  { label: "Processing Power", value: "14.2 TFLOPS" },
];

const dataSources = [
  { name: "PDB", description: "Protein structures" },
  { name: "ChEMBL", description: "Drug targets" },
  { name: "UniProt", description: "Protein info" },
  { name: "PubMed", description: "Research papers" },
  { name: "AlphaFold", description: "AI predictions" },
];

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-300"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Film Grain */}
      <div className="film-grain"></div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-12">
              <div className="flex items-center gap-3">
                <Image
                  src="/biojarvis-logo.svg"
                  alt="BioJarvis logo"
                  width={42}
                  height={42}
                  className="h-10 w-10 rounded-md object-cover"
                />
                <span className="text-2xl font-medium tracking-tight serif-font italic">
                  BioJarvis
                </span>
              </div>
              <div className="hidden md:flex items-center space-x-8 text-xs uppercase tracking-[0.2em] mono-font opacity-60">
                <a
                  className="hover:text-emerald-500 transition-colors"
                  href="#theory"
                >
                  Theory
                </a>
                <a
                  className="hover:text-emerald-500 transition-colors"
                  href="#mechanics"
                >
                  Mechanics
                </a>
                <a
                  className="hover:text-emerald-500 transition-colors"
                  href="#access"
                >
                  Access
                </a>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <Link
                className="text-xs uppercase tracking-[0.2em] mono-font hover:text-emerald-500 transition-colors"
                href="/login"
              >
                Journal Login
              </Link>
              <Link
                className="px-6 py-2 border border-white/10 hover:border-emerald-500/50 transition-all text-xs uppercase tracking-[0.2em] mono-font bg-white/5"
                href="/signup"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 min-h-screen flex items-center overflow-hidden">
        <div className="max-w-screen-2xl mx-auto px-8 w-full grid grid-cols-12 gap-8 items-start relative z-10">
          <div className="col-span-12 lg:col-span-7 pt-12">
            <div className="mono-font text-emerald-500 text-xs tracking-[0.4em] uppercase mb-8 flex items-center gap-4">
              <span className="editorial-line w-12"></span>
              Issue No. 04 // Next-Gen Bioinformatics
            </div>
            <h1 className="text-7xl lg:text-[10rem] font-light leading-[0.85] tracking-tight mb-12 serif-font">
              The <span className="italic text-emerald-500/80">Molecular</span>
              <br />
              Intelligence.
            </h1>
            <div className="grid grid-cols-6 gap-8">
              <div className="col-span-6 lg:col-span-4">
                <p className="text-xl text-slate-400 serif-font italic leading-relaxed mb-12">
                  Bridging the abyss between raw sequence data and actionable
                  clinical mechanisms. BioJarvis is the high-fidelity assistant
                  for the modern laboratory, blending deep LLM integration with
                  real-time structural visualization.
                </p>
                <div className="flex items-center gap-8">
                  <Link href="/signup">
                    <button className="bg-emerald-500 text-[#050505] px-10 py-5 font-bold uppercase tracking-widest text-xs mono-font hover:bg-white transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      Initiate Research
                    </button>
                  </Link>
                  <div className="flex flex-col">
                    <span className="mono-font text-[10px] uppercase tracking-tighter opacity-40">
                      Active Nodes
                    </span>
                    <span className="mono-font text-sm text-emerald-500 tracking-widest">
                      1,248.02_Hz
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 relative mt-20 lg:mt-0">
            <div className="glass-microscope rounded-full aspect-square flex items-center justify-center p-8 relative">
              <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-3xl"></div>
              {/* Abstract DNA/molecular visualization */}
              <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-900/20 via-transparent to-emerald-950/30 flex items-center justify-center">
                <svg className="w-3/4 h-3/4 opacity-40" viewBox="0 0 200 200">
                  <defs>
                    <linearGradient
                      id="meshGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop
                        offset="0%"
                        style={{ stopColor: "rgba(16, 185, 129, 0.6)" }}
                      />
                      <stop
                        offset="100%"
                        style={{ stopColor: "rgba(16, 185, 129, 0.1)" }}
                      />
                    </linearGradient>
                  </defs>
                  {/* Hexagonal mesh pattern */}
                  <path
                    d="M100 20 L160 60 L160 140 L100 180 L40 140 L40 60 Z"
                    fill="none"
                    stroke="url(#meshGrad)"
                    strokeWidth="0.5"
                  />
                  <path
                    d="M100 40 L140 65 L140 135 L100 160 L60 135 L60 65 Z"
                    fill="none"
                    stroke="url(#meshGrad)"
                    strokeWidth="0.3"
                  />
                  <path
                    d="M100 60 L125 75 L125 125 L100 140 L75 125 L75 75 Z"
                    fill="none"
                    stroke="url(#meshGrad)"
                    strokeWidth="0.5"
                  />
                  <circle cx="100" cy="20" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="160" cy="60" r="2" fill="#10b981" opacity="0.6" />
                  <circle
                    cx="160"
                    cy="140"
                    r="2"
                    fill="#10b981"
                    opacity="0.6"
                  />
                  <circle
                    cx="100"
                    cy="180"
                    r="3"
                    fill="#10b981"
                    opacity="0.8"
                  />
                  <circle cx="40" cy="140" r="2" fill="#10b981" opacity="0.6" />
                  <circle cx="40" cy="60" r="2" fill="#10b981" opacity="0.6" />
                  <circle cx="100" cy="100" r="4" fill="#10b981" opacity="1" />
                  {/* Connection lines */}
                  <line
                    x1="100"
                    y1="20"
                    x2="100"
                    y2="100"
                    stroke="#10b981"
                    strokeWidth="0.3"
                    opacity="0.4"
                  />
                  <line
                    x1="160"
                    y1="60"
                    x2="100"
                    y2="100"
                    stroke="#10b981"
                    strokeWidth="0.3"
                    opacity="0.4"
                  />
                  <line
                    x1="40"
                    y1="60"
                    x2="100"
                    y2="100"
                    stroke="#10b981"
                    strokeWidth="0.3"
                    opacity="0.4"
                  />
                  <line
                    x1="160"
                    y1="140"
                    x2="100"
                    y2="100"
                    stroke="#10b981"
                    strokeWidth="0.3"
                    opacity="0.4"
                  />
                  <line
                    x1="40"
                    y1="140"
                    x2="100"
                    y2="100"
                    stroke="#10b981"
                    strokeWidth="0.3"
                    opacity="0.4"
                  />
                  <line
                    x1="100"
                    y1="180"
                    x2="100"
                    y2="100"
                    stroke="#10b981"
                    strokeWidth="0.3"
                    opacity="0.4"
                  />
                </svg>
              </div>
              <div className="absolute top-1/4 -right-12 glass-microscope px-6 py-4 rounded-none border-l-4 border-l-emerald-500">
                <div className="mono-font text-[10px] text-emerald-500 mb-1">
                  PDB_ID: 6M0J
                </div>
                <div className="mono-font text-xs opacity-80 uppercase">
                  Spike Glycoprotein
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-900/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px]"></div>
        </div>
      </header>

      {/* Capabilities Section */}
      <section className="py-32 relative" id="theory">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row justify-between items-end mb-24 gap-8">
            <div className="max-w-2xl">
              <div className="mono-font text-emerald-500 text-xs tracking-[0.4em] uppercase mb-4 italic">
                Capabilities
              </div>
              <h2 className="text-5xl lg:text-7xl font-light serif-font">
                An Ecosystem of <br />
                <span className="italic">Clinical Precision.</span>
              </h2>
            </div>
            <div className="text-right">
              <span className="mono-font text-4xl text-emerald-500">
                01 — 03
              </span>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-8">
            {/* Module 01 - Large */}
            <div className="col-span-12 lg:col-span-8 glass-microscope p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                <span className="material-symbols-outlined text-emerald-500/50 text-6xl opacity-20 transition-opacity">
                  psychology
                </span>
              </div>
              <div className="max-w-md">
                <span className="mono-font text-[10px] text-emerald-500 uppercase tracking-widest block mb-6">
                  [ Module_01 ]
                </span>
                <h3 className="text-4xl serif-font mb-6 italic">
                  Synthetic Hypothesis Generation
                </h3>
                <p className="text-slate-400 leading-relaxed mb-8">
                  BioJarvis doesn&apos;t just search; it synthesizes. Leveraging
                  a closed-loop neural network trained on millions of ChEMBL
                  papers, it proposes drug mechanisms with referenced
                  provenance.
                </p>
                <div className="mono-font text-xs flex gap-6 opacity-60">
                  <span>RECALL: 98.4%</span>
                  <span>LATENCY: 14ms</span>
                </div>
              </div>
            </div>
            {/* Module 02 */}
            <div className="col-span-12 lg:col-span-4 glass-microscope p-12 border-t-4 border-t-emerald-500 flex flex-col justify-between">
              <div>
                <span className="mono-font text-[10px] text-emerald-500 uppercase tracking-widest block mb-6">
                  [ Module_02 ]
                </span>
                <h3 className="text-3xl serif-font mb-4">
                  Real-time <br />
                  Structure Render
                </h3>
              </div>
              <div className="mt-8">
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  High-fidelity protein-ligand interaction rendering directly in
                  the workspace. Native support for .pdb and .sdf file formats
                  with GPU acceleration.
                </p>
                <span className="material-symbols-outlined text-emerald-500">
                  view_in_ar
                </span>
              </div>
            </div>
            {/* Module 03 */}
            <div className="col-span-12 lg:col-span-4 glass-microscope p-12 bg-white/5">
              <span className="mono-font text-[10px] text-emerald-500 uppercase tracking-widest block mb-6">
                [ Module_03 ]
              </span>
              <h3 className="text-3xl serif-font mb-4 italic">
                MCP Protocol Server
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Seamlessly interface with global databanks. Our Model Context
                Protocol ensures your AI models have a direct, live wire to the
                latest genomic sequences.
              </p>
            </div>
            {/* Decorative panel */}
            <div className="col-span-12 lg:col-span-8 relative min-h-[300px] flex items-center justify-center border border-white/5 bg-gradient-to-br from-[#050505] to-emerald-950/20">
              <div className="text-center">
                <div className="mono-font text-7xl text-white/5 font-bold uppercase tracking-[0.2em] select-none">
                  Laboratory Chic
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1/2 editorial-line opacity-20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-screen-2xl mx-auto px-8 grid grid-cols-2 lg:grid-cols-4 gap-12">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col border-l border-white/10 pl-6"
            >
              <span className="mono-font text-[10px] uppercase tracking-widest opacity-40 mb-2">
                {stat.label}
              </span>
              <span className="mono-font text-3xl text-emerald-500 font-light">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Data Sources */}
      <section
        className="py-16 border-b border-white/5 bg-white/[0.01]"
        id="mechanics"
      >
        <div className="max-w-screen-2xl mx-auto px-8">
          <p className="text-center text-xs mono-font uppercase tracking-[0.3em] opacity-40 mb-8">
            Connected Data Sources
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
            {dataSources.map((source) => (
              <div key={source.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-white font-medium mono-font text-sm">
                  {source.name}
                </span>
                <span className="text-slate-500 text-xs hidden sm:inline">
                  {source.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / Access Section */}
      <section className="py-32" id="access">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="text-center mb-24">
            <h2 className="text-5xl serif-font mb-4">Laboratory Access</h2>
            <p className="mono-font text-xs uppercase tracking-[0.3em] opacity-40">
              Choose your research environment
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-white/10">
            {/* Academic */}
            <div className="p-12 hover:bg-white/[0.02] transition-colors border-r border-white/10 flex flex-col justify-between h-full">
              <div>
                <span className="mono-font text-xs text-emerald-500 uppercase tracking-widest block mb-8">
                  Academic_License
                </span>
                <div className="serif-font text-5xl mb-6 italic">
                  $0 <span className="text-lg opacity-30 not-italic">/mo</span>
                </div>
                <p className="text-slate-400 text-sm mb-12 italic">
                  For individual investigators and open-science pioneers.
                </p>
                <ul className="space-y-4 mono-font text-[11px] uppercase tracking-wider opacity-60">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    5 Active Projects
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    Standard LLM Node
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    Community Journal Access
                  </li>
                </ul>
              </div>
              <Link href="/signup">
                <button className="w-full mt-12 py-4 border border-white/10 mono-font text-xs tracking-widest uppercase hover:bg-white hover:text-[#050505] transition-all">
                  Select Tier
                </button>
              </Link>
            </div>
            {/* Professional */}
            <div className="p-12 bg-emerald-500/5 border-r border-white/10 relative overflow-hidden flex flex-col justify-between h-full">
              <div className="absolute top-0 right-0 bg-emerald-500 text-[#050505] px-4 py-1 mono-font text-[10px] uppercase font-bold tracking-tighter">
                Recommended
              </div>
              <div>
                <span className="mono-font text-xs text-emerald-500 uppercase tracking-widest block mb-8">
                  Professional_Node
                </span>
                <div className="serif-font text-5xl mb-6 italic">
                  $49 <span className="text-lg opacity-30 not-italic">/mo</span>
                </div>
                <p className="text-slate-400 text-sm mb-12 italic">
                  The standard for professional bioinformaticians and
                  researchers.
                </p>
                <ul className="space-y-4 mono-font text-[11px] uppercase tracking-wider">
                  <li className="flex items-center gap-3 text-white">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    Unlimited Clusters
                  </li>
                  <li className="flex items-center gap-3 text-white">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    High-Res Structure Export
                  </li>
                  <li className="flex items-center gap-3 text-white">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    Priority MCP Access
                  </li>
                </ul>
              </div>
              <Link href="/signup">
                <button className="w-full mt-12 py-4 bg-emerald-500 text-[#050505] mono-font text-xs tracking-widest uppercase font-bold hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all">
                  Activate Now
                </button>
              </Link>
            </div>
            {/* Enterprise */}
            <div className="p-12 hover:bg-white/[0.02] transition-colors flex flex-col justify-between h-full">
              <div>
                <span className="mono-font text-xs text-emerald-500 uppercase tracking-widest block mb-8">
                  Enterprise_Cluster
                </span>
                <div className="serif-font text-5xl mb-6 italic">Custom</div>
                <p className="text-slate-400 text-sm mb-12 italic">
                  Bespoke infrastructure for biotechnology firms and
                  pharmaceutical laboratories.
                </p>
                <ul className="space-y-4 mono-font text-[11px] uppercase tracking-wider opacity-60">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    Dedicated GPU Clusters
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    Private MCP Hosting
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                    On-Site Implementation
                  </li>
                </ul>
              </div>
              <button className="w-full mt-12 py-4 border border-white/10 mono-font text-xs tracking-widest uppercase hover:bg-white hover:text-[#050505] transition-all">
                Contact Liaison
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 bg-white/[0.02] relative overflow-hidden border-t border-white/5">
        <div className="max-w-4xl mx-auto px-8 text-center relative z-10">
          <h2 className="text-6xl lg:text-8xl serif-font italic mb-12 leading-tight">
            Ready to Decode the{" "}
            <span className="text-emerald-500">Future?</span>
          </h2>
          <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
            <Link href="/signup">
              <button className="px-12 py-6 bg-emerald-500 text-[#050505] mono-font text-xs font-bold uppercase tracking-widest hover:bg-white transition-all shadow-2xl">
                Create Research Workspace
              </button>
            </Link>
            <Link
              className="mono-font text-xs uppercase tracking-widest border-b border-emerald-500 pb-1 hover:text-emerald-500 transition-colors"
              href="/login"
            >
              Request Lab Documentation
            </Link>
          </div>
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-5">
          <div className="absolute left-1/4 top-0 h-full w-px bg-white"></div>
          <div className="absolute left-2/4 top-0 h-full w-px bg-white"></div>
          <div className="absolute left-3/4 top-0 h-full w-px bg-white"></div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-20">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-8">
                <Image
                  src="/biojarvis-logo.svg"
                  alt="BioJarvis logo"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-md object-cover"
                />
                <span className="text-xl font-medium tracking-tight serif-font italic">
                  BioJarvis
                </span>
              </div>
              <p className="text-slate-500 text-sm serif-font italic leading-relaxed max-w-xs mb-8">
                The premiere assistant for molecular discovery. Merging
                classical biological rigor with computational intelligence.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:col-span-4 gap-12">
              <div>
                <h4 className="mono-font text-[10px] uppercase tracking-[0.3em] text-emerald-500 mb-8 italic">
                  Research
                </h4>
                <ul className="space-y-4 text-xs mono-font opacity-40">
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      Analytic Node
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      3D Workspace
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      Literature Synthesis
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      PDB Explorer
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mono-font text-[10px] uppercase tracking-[0.3em] text-emerald-500 mb-8 italic">
                  Infrastructure
                </h4>
                <ul className="space-y-4 text-xs mono-font opacity-40">
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      MCP Documentation
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      Security Protocols
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      API Reference
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      Status Console
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mono-font text-[10px] uppercase tracking-[0.3em] text-emerald-500 mb-8 italic">
                  Journal
                </h4>
                <ul className="space-y-4 text-xs mono-font opacity-40">
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      Case Studies
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      Lab Reports
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      Ethics Board
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-white transition-colors" href="#">
                      Whitepapers
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] mono-font opacity-30 uppercase tracking-[0.2em]">
            <p>© 2024 BioJarvis Cognitive Research Labs</p>
            <div className="flex gap-12">
              <a className="hover:text-white transition-colors" href="#">
                Privacy Cipher
              </a>
              <a className="hover:text-white transition-colors" href="#">
                Terms of Access
              </a>
              <a className="hover:text-white transition-colors" href="#">
                Cookie Schema
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
