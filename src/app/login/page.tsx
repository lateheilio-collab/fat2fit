"use client";

import { useState } from "react";
import { Mail, Lock, Activity, ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"magic" | "password">("magic");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = supabaseBrowser();
    
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message || "Tapahtui virhe linkkiä lähetettäessä.");
    } else {
      setMessage("Kirjautumislinkki on lähetetty sähköpostiisi! Voit sulkea tämän sivun.");
    }
    setLoading(false);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = supabaseBrowser();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (signInError) {
      setError(signInError.message || "Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.");
      setLoading(false);
    } else {
      // Success: redirect to dashboard
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-zinc-900 to-black p-4">
      <div className="w-full max-w-md rounded-3xl glass-panel border border-border/40 p-8 shadow-2xl relative overflow-hidden">
        {/* Glow decorative element */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Logo and Brand */}
        <div className="flex flex-col items-center gap-3 text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center shadow-lg shadow-primary/20">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight leading-none bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Fat2Fit
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium max-w-[280px]">
              Terveytesi, ravitsemuksesi ja harjoittelusi älykäs ohjauspaneeli
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        {!message && (
          <div className="grid grid-cols-2 gap-2 bg-secondary/20 p-1.5 rounded-xl border border-border/20 mb-6 text-xs font-semibold">
            <button
              onClick={() => { setLoginMode("magic"); setError(null); }}
              className={`py-2 px-3 rounded-lg transition-all cursor-pointer text-center ${
                loginMode === "magic" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kirjautumislinkki
            </button>
            <button
              onClick={() => { setLoginMode("password"); setError(null); }}
              className={`py-2 px-3 rounded-lg transition-all cursor-pointer text-center ${
                loginMode === "password" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Salasana
            </button>
          </div>
        )}

        {/* Status Messages */}
        {message && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Forms */}
        {!message && (
          loginMode === "magic" ? (
            <form onSubmit={handleMagicLinkLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                  Sähköpostiosoite
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-5 h-5 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="sinun.nimi@sähköposti.fi"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Lähetetään..." : "Lähetä kirjautumislinkki"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email-pw" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                    Sähköpostiosoite
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 w-5 h-5 text-muted-foreground" />
                    <input
                      id="email-pw"
                      type="email"
                      required
                      placeholder="sinun.nimi@sähköposti.fi"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                    Salasana
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 w-5 h-5 text-muted-foreground" />
                    <input
                      id="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 cursor-pointer disabled:opacity-50"
              >
                {loading ? "Kirjaudutaan..." : "Kirjaudu sisään"}
                {!loading && <KeyRound className="w-4 h-4" />}
              </button>
            </form>
          )
        )}

        {/* Whitelist disclaimer */}
        <div className="border-t border-border/30 mt-8 pt-5 text-center">
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed font-medium">
            Tämä on henkilökohtainen sovellus. Pääsy sallittu ainoastaan erikseen whitelisteillä määritellyille sähköpostiosoitteille.
          </p>
        </div>
      </div>
    </div>
  );
}
