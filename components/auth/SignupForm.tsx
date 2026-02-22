"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.user && !data.session) {
      // Email confirmation required
      setSuccess(true);
      setLoading(false);
    } else {
      // Auto-confirmed (e.g., local development)
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleOAuthLogin(provider: "google" | "github") {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="bg-[#13ec92]/10 text-[#13ec92] p-6 border border-[#13ec92]/20">
          <h3 className="mono-font text-xs uppercase tracking-[0.2em] font-bold mb-2">
            Sequence Verification Required
          </h3>
          <p className="text-sm mt-1 text-white/60">
            Confirmation link sent to{" "}
            <strong className="text-white">{email}</strong>. Activate your
            research node before signing in.
          </p>
        </div>
        <button
          onClick={() => {
            setSuccess(false);
            setEmail("");
            setPassword("");
            setFullName("");
          }}
          className="border border-white/10 hover:border-[#13ec92]/30 px-6 py-3 mono-font text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-all"
        >
          Try different credentials
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignup} className="space-y-8">
      {error && (
        <div className="bg-red-500/10 text-red-400 p-3 text-xs mono-font border border-red-500/20">
          {error}
        </div>
      )}

      <div className="space-y-1 relative group">
        <label className="block text-[10px] mono-font uppercase tracking-[0.2em] text-white/40 group-focus-within:text-[#13ec92] transition-colors">
          Researcher Name
        </label>
        <input
          type="text"
          placeholder="Dr. Jane Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={loading}
          className="ultra-thin-input w-full text-sm tracking-widest text-white/80 placeholder:text-white/10 py-2"
        />
      </div>

      <div className="space-y-1 relative group">
        <label className="block text-[10px] mono-font uppercase tracking-[0.2em] text-white/40 group-focus-within:text-[#13ec92] transition-colors">
          Email Address
        </label>
        <input
          type="email"
          placeholder="researcher@institution.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="ultra-thin-input w-full text-sm tracking-widest text-white/80 placeholder:text-white/10 py-2"
        />
      </div>

      <div className="space-y-1 relative group">
        <label className="block text-[10px] mono-font uppercase tracking-[0.2em] text-white/40 group-focus-within:text-[#13ec92] transition-colors">
          Access Key
        </label>
        <input
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          minLength={6}
          className="ultra-thin-input w-full text-sm tracking-widest text-white/80 placeholder:text-white/10 py-2"
        />
        <span className="text-[9px] mono-font text-white/20 mt-1 block">
          MIN_LENGTH: 6 CHARS
        </span>
      </div>

      <div className="pt-4 flex flex-col items-center space-y-6">
        <button
          type="submit"
          disabled={loading}
          className="pill-button w-full py-4 rounded-full mono-font text-xs font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Access...
            </>
          ) : (
            <>
              <span>Register Node</span>
              <span className="material-symbols-outlined text-sm">
                arrow_right_alt
              </span>
            </>
          )}
        </button>

        <div className="flex items-center space-x-4 w-full">
          <div className="h-[1px] flex-grow bg-white/5"></div>
          <span className="text-[9px] mono-font text-white/20 tracking-[0.2em]">
            OR PROVIDER
          </span>
          <div className="h-[1px] flex-grow bg-white/5"></div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            disabled={loading}
            className="border border-white/5 hover:border-[#13ec92]/30 hover:bg-[#13ec92]/5 transition-all py-3 flex items-center justify-center group"
          >
            <span className="text-[9px] mono-font text-white/40 group-hover:text-white uppercase tracking-widest transition-colors">
              Google
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleOAuthLogin("github")}
            disabled={loading}
            className="border border-white/5 hover:border-[#13ec92]/30 hover:bg-[#13ec92]/5 transition-all py-3 flex items-center justify-center group"
          >
            <span className="text-[9px] mono-font text-white/40 group-hover:text-white uppercase tracking-widest transition-colors">
              GitHub
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center space-x-2 pt-4">
        <div className="w-1 h-1 bg-[#13ec92] rounded-full"></div>
        <span className="text-[8px] mono-font text-[#13ec92]/60 tracking-[0.5em] uppercase">
          Privacy Protocol Active
        </span>
      </div>
    </form>
  );
}
