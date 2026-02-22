import Link from 'next/link'
import { Dna } from 'lucide-react'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-[#050505] text-slate-200 blueprint-pattern" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Film Grain */}
      <div className="film-grain"></div>

      {/* Left Panel - DNA Helix Graphic */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-transparent to-transparent"></div>
        
        {/* DNA SVG */}
        <div className="relative z-10 flex flex-col items-center">
          <svg className="w-48 h-[500px] opacity-30" viewBox="0 0 100 400">
            <defs>
              <linearGradient id="dnaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: '#10b981', stopOpacity: 0.8}} />
                <stop offset="50%" style={{stopColor: '#10b981', stopOpacity: 0.3}} />
                <stop offset="100%" style={{stopColor: '#10b981', stopOpacity: 0.8}} />
              </linearGradient>
            </defs>
            {/* Double helix strands */}
            <path d="M20,0 Q80,50 20,100 Q-40,150 20,200 Q80,250 20,300 Q-40,350 20,400" fill="none" stroke="url(#dnaGrad)" strokeWidth="1.5" />
            <path d="M80,0 Q20,50 80,100 Q140,150 80,200 Q20,250 80,300 Q140,350 80,400" fill="none" stroke="url(#dnaGrad)" strokeWidth="1.5" />
            {/* Cross-links */}
            {[25, 75, 125, 175, 225, 275, 325, 375].map((y, i) => (
              <line key={i} x1={i % 2 === 0 ? 35 : 25} y1={y} x2={i % 2 === 0 ? 65 : 75} y2={y} stroke="#10b981" strokeWidth="0.5" opacity="0.4" />
            ))}
            {/* Connection nodes */}
            {[0, 50, 100, 150, 200, 250, 300, 350, 400].map((y, i) => (
              <circle key={i} cx={i % 2 === 0 ? 20 : 80} cy={y} r="3" fill="#10b981" opacity="0.6" />
            ))}
          </svg>

          <div className="mt-16 text-center">
            <p className="mono-font text-[10px] uppercase tracking-[0.3em] text-emerald-500/60 mb-3">Sequence Authenticated</p>
            <p className="serif-font text-2xl italic opacity-40">Double Helix Protocol</p>
          </div>
        </div>

        {/* Decorative corner elements */}
        <div className="absolute top-8 left-8 w-12 h-12 border-l border-t border-emerald-500/20"></div>
        <div className="absolute bottom-8 right-8 w-12 h-12 border-r border-b border-emerald-500/20"></div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-16 relative">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <Dna className="h-8 w-8 text-emerald-500" strokeWidth={1.6} />
            <span className="text-2xl font-medium tracking-tight serif-font italic">BioJarvis</span>
          </div>

          {/* Header */}
          <div className="mb-12">
            <div className="mono-font text-emerald-500 text-[10px] tracking-[0.4em] uppercase mb-4 flex items-center gap-4">
              <span className="editorial-line w-8"></span>
              Authentication Portal
            </div>
            <h1 className="text-4xl serif-font italic font-light">Welcome back,<br />Researcher.</h1>
          </div>

          {/* Login Form */}
          <LoginForm />

          {/* Footer link */}
          <p className="mt-10 text-center mono-font text-xs opacity-40">
            New to the lab?{' '}
            <Link href="/signup" className="text-emerald-500 hover:underline">
              Request Access
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
