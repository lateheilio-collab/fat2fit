import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-zinc-900 to-black p-4">
      <div className="w-full max-w-md rounded-3xl glass-panel border border-red-500/20 p-8 shadow-2xl text-center flex flex-col items-center gap-6 relative overflow-hidden">
        {/* Warning Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center shadow-lg shadow-red-500/5">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-heading font-extrabold text-2xl tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            Pääsy evätty
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1 font-medium px-2">
            Sähköpostiosoitettasi ei ole lisätty tämän sovelluksen sallittujen käyttäjien listalle (`ALLOWED_USER_EMAIL`).
          </p>
        </div>

        <div className="text-xs text-muted-foreground/80 leading-relaxed bg-red-500/5 p-4 rounded-2xl border border-red-500/10 font-medium">
          Jos olet sovelluksen ylläpitäjä, varmista, että ympäristömuuttujat on asetettu oikein Vercelissä tai `.env.local` tiedostossa ja että sähköposti täsmää kirjautumisen kanssa.
        </div>

        <Link
          href="/login"
          className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Takaisin kirjautumiseen
        </Link>
      </div>
    </div>
  );
}
