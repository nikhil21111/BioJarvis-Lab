"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const rawMessage = error.message || "Login failed";
      if (/confirm|verified|email/i.test(rawMessage)) {
        setError(
          "Your email is not confirmed yet. Please click the verification link from your inbox, then sign in again.",
        );
      } else if (/invalid login credentials/i.test(rawMessage)) {
        setError("Incorrect email or password. Please try again.");
      } else {
        setError(rawMessage);
      }
      setLoading(false);
    } else {
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

  return (
    <form onSubmit={handleLogin} className="space-y-10">
      {error && (
        <div className="bg-red-500/10 text-red-400 p-3 text-xs mono-font border border-red-500/20">
          {error}
        </div>
      )}

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
          Password
        </label>
        <input
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          className="ultra-thin-input w-full text-sm tracking-widest text-white/80 placeholder:text-white/10 py-2"
        />
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
              Initiating...
            </>
          ) : (
            <>
              <span>Initiate Session</span>
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
            className="border border-white/5 hover:border-[#13ec92]/30 hover:bg-[#13ec92]/5 transition-all py-3 flex items-center justify-center gap-2 group"
          >
            <span className="text-[9px] mono-font text-white/40 group-hover:text-white uppercase tracking-widest transition-colors">
              Google
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleOAuthLogin("github")}
            disabled={loading}
            className="border border-white/5 hover:border-[#13ec92]/30 hover:bg-[#13ec92]/5 transition-all py-3 flex items-center justify-center gap-2 group"
          >
            <span className="text-[9px] mono-font text-white/40 group-hover:text-white uppercase tracking-widest transition-colors">
              GitHub
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
