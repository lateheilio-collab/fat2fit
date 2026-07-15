"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Utensils,
  Dumbbell,
  TrendingUp,
  Settings,
  LogOut,
  Activity,
  Plus,
  X,
  ChevronLeft,
  Scale,
  Moon,
  Smile,
  Camera,
  PlusCircle,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Tänään", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/meals", label: "Ateriat", icon: Activity },
  { href: "/nutrition-plan", label: "Ravinto-ohjelma", icon: Utensils },
  { href: "/plan", label: "Suunnitelma", icon: Dumbbell },
  { href: "/progress", label: "Kehitys", icon: TrendingUp },
];

const mobileNavItems = [
  { href: "/", label: "Tänään", icon: LayoutDashboard },
  { href: "/nutrition-plan", label: "Ravinto", icon: Utensils },
  { href: "/plan", label: "Treeni", icon: Dumbbell },
  { href: "/progress", label: "Kehitys", icon: TrendingUp },
  { href: "/chat", label: "Valmentaja", icon: MessageSquare },
];

type LogType = "menu" | "weight" | "sleep" | "feelings";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [isOpen, setIsOpen] = useState(false);
  const [logType, setLogType] = useState<LogType>("menu");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Weight form states
  const [weightVal, setWeightVal] = useState("80.0");
  const [waistVal, setWaistVal] = useState("");
  const [weightDate, setWeightDate] = useState("");

  // Sleep form states
  const [sleepHours, setSleepHours] = useState(8);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [sleepDate, setSleepDate] = useState("");

  // Feelings form states
  const [energyLevel, setEnergyLevel] = useState(3);
  const [stressLevel, setStressLevel] = useState(3);
  const [hungerLevel, setHungerLevel] = useState(3);
  const [sorenessLevel, setSorenessLevel] = useState(3);
  const [feelingDate, setFeelingDate] = useState("");

  useEffect(() => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
    setWeightDate(today);
    setSleepDate(today);
    setFeelingDate(today);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const closeBottomSheet = () => {
    setIsOpen(false);
    setLogType("menu");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleLogWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Käyttäjää ei löydy. Kirjaudu sisään.");

      const value = parseFloat(weightVal);
      if (isNaN(value) || value <= 0) throw new Error("Syötä kelvollinen paino.");

      const offset = new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("GMT+3") || new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("EEST") ? "+03:00" : "+02:00";
      const measuredAt = new Date(`${weightDate}T08:00:00${offset}`).toISOString();

      // Log weight
      const { error: weightError } = await supabase.from("body_measurements").insert({
        user_id: user.id,
        metric: "weight",
        value,
        measured_at: measuredAt,
        source: "manual",
      });
      if (weightError) throw weightError;

      // Log waist if provided
      if (waistVal.trim()) {
        const waistValue = parseFloat(waistVal);
        if (!isNaN(waistValue) && waistValue > 0) {
          const { error: waistError } = await supabase.from("body_measurements").insert({
            user_id: user.id,
            metric: "waist_cm",
            value: waistValue,
            measured_at: measuredAt,
            source: "manual",
          });
          if (waistError) throw waistError;
        }
      }

      setSuccessMsg("Punnitus tallennettu!");
      setTimeout(() => {
        closeBottomSheet();
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Tallennus epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Käyttäjää ei löydy. Kirjaudu sisään.");

      // Check-in dates are stored as date type in Helsinki time
      const { error } = await supabase.from("daily_check_ins").upsert({
        user_id: user.id,
        date: sleepDate,
        sleep_hours: sleepHours,
        sleep_quality: sleepQuality,
      }, { onConflict: "user_id,date" });

      if (error) throw error;

      setSuccessMsg("Uni tallennettu!");
      setTimeout(() => {
        closeBottomSheet();
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Tallennus epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogFeelings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Käyttäjää ei löydy. Kirjaudu sisään.");

      const { error } = await supabase.from("daily_check_ins").upsert({
        user_id: user.id,
        date: feelingDate,
        energy_level: energyLevel,
        stress_level: stressLevel,
        hunger_level: hungerLevel,
        soreness_level: sorenessLevel,
      }, { onConflict: "user_id,date" });

      if (error) throw error;

      setSuccessMsg("Fiilis tallennettu!");
      setTimeout(() => {
        closeBottomSheet();
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Tallennus epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 glass-panel border-r border-border p-6 justify-between z-30">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl tracking-tight leading-none bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Fat2Fit
              </h1>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                Valmentajasi
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/settings"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
              pathname.startsWith("/settings")
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Settings className="w-5 h-5" />
            Asetukset
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            Kirjaudu ulos
          </button>
        </div>
      </aside>

      {/* Mobile Floating Plus Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setLogType("menu");
        }}
        className="md:hidden fixed bottom-20 right-4 z-40 bg-gradient-to-tr from-primary to-violet-500 text-white w-14 h-14 rounded-full shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label="Pikakirjaus"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Mobile Bottom Bar (Hidden on Desktop) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-border px-2 py-1 flex justify-around items-center z-40 pb-safe">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-200 min-w-16 ${
                isActive
                  ? "text-primary scale-110"
                  : "text-muted-foreground active:scale-95"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Quick Log Bottom Sheet overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={closeBottomSheet}
          />

          {/* Bottom Sheet Window */}
          <div className="relative w-full max-h-[85vh] bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 z-10 overflow-y-auto transform transition-transform duration-300 animate-slide-up pb-safe-bottom">
            {/* Grab Handle */}
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              {logType !== "menu" ? (
                <button
                  onClick={() => setLogType("menu")}
                  className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Takaisin
                </button>
              ) : (
                <h3 className="font-heading font-bold text-xl">Uusi kirjaus</h3>
              )}
              <button
                onClick={closeBottomSheet}
                className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl font-medium">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl font-medium">
                {successMsg}
              </div>
            )}

            {/* MAIN MENU */}
            {logType === "menu" && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    closeBottomSheet();
                    router.push("/meals?action=camera");
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800/60 transition-colors text-center gap-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Camera className="w-5.5 h-5.5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">Kuvaa ateria</span>
                    <span className="text-[10px] text-muted-foreground">Kameralla / kuvalla</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    closeBottomSheet();
                    router.push("/meals?action=manual");
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800/60 transition-colors text-center gap-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                    <PlusCircle className="w-5.5 h-5.5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">Ateria käsin</span>
                    <span className="text-[10px] text-muted-foreground">Lisää tietokannasta</span>
                  </div>
                </button>

                <button
                  onClick={() => setLogType("weight")}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800/60 transition-colors text-center gap-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Scale className="w-5.5 h-5.5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">Punnitus</span>
                    <span className="text-[10px] text-muted-foreground">Paino ja vyötärö</span>
                  </div>
                </button>

                <button
                  onClick={() => setLogType("sleep")}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800/60 transition-colors text-center gap-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Moon className="w-5.5 h-5.5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">Loggaa uni</span>
                    <span className="text-[10px] text-muted-foreground">Tunnit ja laatu</span>
                  </div>
                </button>

                <button
                  onClick={() => setLogType("feelings")}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800/60 transition-colors text-center gap-3 col-span-2"
                >
                  <div className="w-11 h-11 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                    <Smile className="w-5.5 h-5.5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">Aamukirjaus / Fiilis</span>
                    <span className="text-[10px] text-muted-foreground">Energia, stressi, hunger</span>
                  </div>
                </button>
              </div>
            )}

            {/* WEIGHT FORM */}
            {logType === "weight" && (
              <form onSubmit={handleLogWeight} className="flex flex-col gap-5 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Paino (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={weightVal}
                    onChange={(e) => setWeightVal(e.target.value)}
                    className="w-full bg-secondary border border-border/40 py-3 px-4 rounded-xl font-heading text-lg font-bold focus:outline-none focus:border-primary"
                    placeholder="Esim. 78.5"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Vyötärönympärys (cm, valinnainen)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={waistVal}
                    onChange={(e) => setWaistVal(e.target.value)}
                    className="w-full bg-secondary border border-border/40 py-3 px-4 rounded-xl font-heading text-lg font-bold focus:outline-none focus:border-primary"
                    placeholder="Esim. 88.0"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Päivämäärä
                  </label>
                  <input
                    type="date"
                    required
                    value={weightDate}
                    onChange={(e) => setWeightDate(e.target.value)}
                    className="w-full bg-secondary border border-border/40 py-3 px-4 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  {loading ? "Tallennetaan..." : "Tallenna punnitus"}
                </button>
              </form>
            )}

            {/* SLEEP FORM */}
            {logType === "sleep" && (
              <form onSubmit={handleLogSleep} className="flex flex-col gap-5 text-left">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Unen pituus: {sleepHours} tuntia
                    </label>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="14"
                    step="0.5"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                    className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>3 t</span>
                    <span>8 t</span>
                    <span>14 t</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Unen laatu: {["Erittäin huono", "Huono", "Keskinkertainen", "Hyvä", "Erittäin hyvä"][sleepQuality - 1]}
                  </label>
                  <div className="flex gap-2.5 justify-between mt-1">
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <button
                        key={stars}
                        type="button"
                        onClick={() => setSleepQuality(stars)}
                        className={`flex-1 py-3 text-center rounded-xl font-bold border transition-all ${
                          sleepQuality === stars
                            ? "bg-primary border-primary text-primary-foreground scale-105"
                            : "bg-secondary border-border/30 text-muted-foreground"
                        }`}
                      >
                        {stars} ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Yö (Heräämispäivä)
                  </label>
                  <input
                    type="date"
                    required
                    value={sleepDate}
                    onChange={(e) => setSleepDate(e.target.value)}
                    className="w-full bg-secondary border border-border/40 py-3 px-4 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  {loading ? "Tallennetaan..." : "Tallenna uni"}
                </button>
              </form>
            )}

            {/* FEELINGS FORM */}
            {logType === "feelings" && (
              <form onSubmit={handleLogFeelings} className="flex flex-col gap-5 text-left">
                {/* Energy */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Energiataso: {["Uupunut", "Väsynyt", "Normaali", "Hyvä", "Loistava"][energyLevel - 1]}
                  </label>
                  <div className="flex gap-1.5 justify-between">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEnergyLevel(lvl)}
                        className={`flex-1 py-2 text-sm rounded-lg font-bold border ${
                          energyLevel === lvl
                            ? "bg-violet-500 border-violet-500 text-white"
                            : "bg-secondary border-border/30 text-muted-foreground"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stress */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Stressitaso: {["Ei lainkaan", "Vähäinen", "Keskinkertainen", "Korkea", "Erittäin korkea"][stressLevel - 1]}
                  </label>
                  <div className="flex gap-1.5 justify-between">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setStressLevel(lvl)}
                        className={`flex-1 py-2 text-sm rounded-lg font-bold border ${
                          stressLevel === lvl
                            ? "bg-violet-500 border-violet-500 text-white"
                            : "bg-secondary border-border/30 text-muted-foreground"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hunger */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Näläntunne: {["Kylläinen", "Kevyt nälkä", "Normaali", "Kova nälkä", "Jatkuva nälkä"][hungerLevel - 1]}
                  </label>
                  <div className="flex gap-1.5 justify-between">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setHungerLevel(lvl)}
                        className={`flex-1 py-2 text-sm rounded-lg font-bold border ${
                          hungerLevel === lvl
                            ? "bg-violet-500 border-violet-500 text-white"
                            : "bg-secondary border-border/30 text-muted-foreground"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Soreness */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Lihasarkuus: {["Ei lainkaan", "Lievä", "Normaali", "Kipeä", "Erittäin kipeä"][sorenessLevel - 1]}
                  </label>
                  <div className="flex gap-1.5 justify-between">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSorenessLevel(lvl)}
                        className={`flex-1 py-2 text-sm rounded-lg font-bold border ${
                          sorenessLevel === lvl
                            ? "bg-violet-500 border-violet-500 text-white"
                            : "bg-secondary border-border/30 text-muted-foreground"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Päivämäärä
                  </label>
                  <input
                    type="date"
                    required
                    value={feelingDate}
                    onChange={(e) => setFeelingDate(e.target.value)}
                    className="w-full bg-secondary border border-border/40 py-3 px-4 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  {loading ? "Tallennetaan..." : "Tallenna aamukirjaus"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
