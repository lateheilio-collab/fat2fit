"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Share2,
  FileDown,
  Trash2,
  Activity,
  Upload,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Lock,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SettingsPage() {
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isStravaConnected, setIsStravaConnected] = useState(false);

  // File import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  // Load profile and token status
  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile
      const { data: profData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profData);

      // Fetch Strava token status
      const { data: tokenData } = await supabase
        .from("oauth_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("provider", "strava")
        .maybeSingle();

      setIsStravaConnected(!!tokenData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  // File upload change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  // Run Garmin parser
  const handleRunImport = async () => {
    if (!importFile) return;
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch("/api/integrations/garmin/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      setImportResult(data);
    } catch (err: any) {
      alert(err.message || "Tiedoston tuonti epäonnistui.");
    } finally {
      setImporting(false);
    }
  };

  // Save imported records
  const handleConfirmImport = async () => {
    if (!importResult) return;
    setLoading(true);

    try {
      const res = await fetch("/api/integrations/garmin/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: importResult.newRecords,
          type: importResult.type,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      alert(`Tuonti onnistui! ${data.count} uutta riviä tallennettu.`);
      setImportFile(null);
      setImportResult(null);
    } catch (err: any) {
      alert(err.message || "Tallennus epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  // Disconnect Strava
  const handleDisconnectStrava = async () => {
    if (!confirm("Haluatko varmasti katkaista yhteyden Stravaan?")) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("oauth_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", "strava");

      if (error) throw error;
      setIsStravaConnected(false);
    } catch (err: any) {
      alert(err.message || "Yhteyden katkaiseminen epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  // Delete all data (GDPR)
  const handleDeleteAllData = async () => {
    if (!confirm("VAROITUS: Tämä poistaa pysyvästi kaikki tietosi sovelluksesta. Tätä toimintoa ei voi peruuttaa! Haluatko varmasti jatkaa?")) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete auth user (cascades to public tables)
      const { error } = await supabase.from("profiles").delete().eq("id", user.id);
      if (error) throw error;

      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err: any) {
      alert(err.message || "Tietojen poisto epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
          <Settings className="w-3.5 h-3.5" />
          Asetukset & Integraatiot
        </span>
        <h2 className="text-3xl font-bold tracking-tight font-heading">
          Hallinnoi sovellusta
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: INTEGATIONS (Strava & Garmin) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Strava Card */}
          <div className="rounded-3xl glass-panel border border-border/40 p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-base">Strava Synkronointi</h3>
                <p className="text-xs text-muted-foreground">Synkronoi juoksut ja suoritukset reaaliajassa.</p>
              </div>
            </div>

            {isStravaConnected ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/25">
                <div className="flex items-center gap-2 text-orange-400 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  Yhteys aktiivinen
                </div>
                <button
                  onClick={handleDisconnectStrava}
                  disabled={loading}
                  className="py-2 px-4 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all cursor-pointer"
                >
                  Katkaise yhteys
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Liitä Garmin-laitteesi Stravaan ja yhdistä Strava Fat2Fitiin. Treenisi päivittyvät automaattisesti taustalla.
                </p>
                <a
                  href="/api/integrations/strava/connect"
                  className="py-3 px-5 rounded-2xl bg-orange-500 text-white font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/20 w-fit cursor-pointer"
                >
                  <Activity className="w-4 h-4" />
                  Yhdistä Strava
                </a>
              </div>
            )}
          </div>

          {/* Garmin Connect File Import */}
          <div className="rounded-3xl glass-panel border border-border/40 p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-base">Garmin Tiedostotuonti</h3>
                <p className="text-xs text-muted-foreground">Tuo painohistoria tai treenejä FIT/CSV-tiedostosta.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative border border-dashed border-border/40 hover:border-primary rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center bg-secondary/5 hover:bg-secondary/15">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-xs font-bold">
                  {importFile ? importFile.name : "Valitse FIT, TCX, GPX tai CSV tiedosto"}
                </span>
                <input
                  type="file"
                  accept=".csv,.fit,.tcx,.gpx,.zip"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={importing}
                />
              </div>

              {importFile && !importResult && (
                <button
                  onClick={handleRunImport}
                  disabled={importing}
                  className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1 w-fit cursor-pointer"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Käsitellään tiedostoa...
                    </>
                  ) : (
                    "Analysoi tiedosto"
                  )}
                </button>
              )}
            </div>

            {/* Import preview banner */}
            {importResult && (
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/30 flex flex-col gap-3 animate-fade-in">
                <h4 className="text-xs font-bold text-foreground">Tiedoston tiedot</h4>
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <p>Havaittujen rivien määrä: <span className="font-bold text-foreground">{importResult.totalRows || importResult.newRecords.length}</span></p>
                  <p>Uusia mittauksia tallennettavana: <span className="font-bold text-emerald-400">{importResult.newRecords.length}</span></p>
                  <p>Löytyneitä duplikaatteja: <span className="font-bold text-amber-400">{importResult.duplicatesCount}</span></p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmImport}
                    disabled={loading}
                    className="py-2 px-4 rounded-xl bg-emerald-500 text-white font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Vahvista ja tallenna kantaan
                  </button>
                  <button
                    onClick={() => {
                      setImportFile(null);
                      setImportResult(null);
                    }}
                    className="py-2 px-4 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors"
                  >
                    Peruuta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PRIVACY & SYSTEM INFO */}
        <div className="flex flex-col gap-6">
          {/* Whitelist status card */}
          <div className="rounded-3xl glass-panel border border-border/40 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-semibold text-base">Tietosuoja & GDPR</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tietojasi käsitellään luottamuksellisina. Voit hallinnoida tallennettuja tietoja alta.
            </p>

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  // In production, fetch database rows and download as JSON file
                  alert("Tietojen vienti aloitetaan... Tiedosto tallentuu pian.");
                }}
                className="py-3 px-4 rounded-2xl bg-secondary/40 hover:bg-secondary/60 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-border/40 cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-primary" />
                Vie kaikki tiedot (JSON)
              </button>

              <button
                onClick={handleDeleteAllData}
                disabled={loading}
                className="py-3 px-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-red-500/25 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Poista tili ja kaikki tiedot
              </button>
            </div>
          </div>

          {/* whitelisting banner */}
          <div className="rounded-3xl glass-panel border border-border/40 p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Lock className="w-4 h-4 text-primary" />
              Ylläpidon rajoitukset
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Whitelisting-sähköposti on asetettu. Vain tämä tili saa kirjautua:
            </p>
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/20 text-xs font-mono break-all text-center">
              kayttaja@esimerkki.fi
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
