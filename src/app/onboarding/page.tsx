"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  User,
  Scale,
  Calendar,
  Settings,
  Flame,
  CheckCircle,
  HelpCircle,
  Clock,
  Dumbbell,
  Send,
  Check,
  BrainCircuit,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

type ChatMessage = {
  role: "user" | "model";
  content: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // --- PROFILE / GOAL STATE ---
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState<number>(1990);
  const [heightCm, setHeightCm] = useState<number>(180);
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(85);
  const [gender, setGender] = useState<"male" | "female" | "other">("male");

  const [targetWeightKg, setTargetWeightKg] = useState<number>(80);
  const [targetDate, setTargetDate] = useState<string>("");
  const [weeklyExerciseCount, setWeeklyExerciseCount] = useState<number>(3);
  
  const [wakeUpTime, setWakeUpTime] = useState("07:00");
  const [bedTime, setBedTime] = useState("22:30");
  const [coachingStyle, setCoachingStyle] = useState<string[]>(["lempeä"]);
  const [nutritionStyle, setNutritionStyle] = useState<"joustava" | "tarkka">("joustava");
  const [primaryObjective, setPrimaryObjective] = useState<string>("weight_loss");

  // --- CHAT STATE ---
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content: "Hei! Minä olen Fat2Fit Coach, henkilökohtainen tekoälyvalmentajasi. Aloitetaan yhteinen matkamme! Jotta voin luoda sinulle tehokkaan, juuri sinun arkeesi sopivan treeni- ja ravintosuunnitelman, jutellaan hetki lähtötilanteestasi. Kertoisitko ensin nimesi ja millaisia tavoitteita sinulla on mielessäsi?",
    },
  ]);
  const [inputVal, setInputVal] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Set default target date to 3 months from now
  useEffect(() => {
    if (!targetDate) {
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 3);
      setTargetDate(defaultDate.toISOString().split("T")[0]);
    }
  }, [targetDate]);

  // --- CHAT INTERACTION ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || loading) return;

    const userMsg = inputVal.trim();
    setInputVal("");

    const updatedMessages = [...messages, { role: "user", content: userMsg } as ChatMessage];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Add coach's reply to the chat
      setMessages((prev) => [...prev, { role: "model", content: data.reply }]);

      // Update baseline card states with parsed variables in real-time
      const info = data.parsedInfo;
      if (info) {
        if (info.displayName) setDisplayName(info.displayName);
        if (info.birthYear) setBirthYear(info.birthYear);
        if (info.heightCm) setHeightCm(info.heightCm);
        if (info.currentWeightKg) setCurrentWeightKg(info.currentWeightKg);
        if (info.gender) setGender(info.gender);
        if (info.targetWeightKg) setTargetWeightKg(info.targetWeightKg);
        if (info.weeklyExerciseCount) setWeeklyExerciseCount(info.weeklyExerciseCount);
        if (info.wakeUpTime) setWakeUpTime(info.wakeUpTime);
        if (info.bedTime) setBedTime(info.bedTime);
        if (info.coachingStyle) setCoachingStyle(info.coachingStyle);
        if (info.primaryObjective) setPrimaryObjective(info.primaryObjective);
        if (info.targetDate) setTargetDate(info.targetDate);
      }
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: "Pahoittelut, yhteys katkesi hetkeksi. Voit jatkaa kirjoittamista tai täyttää puuttuvat tiedot suoraan sivupaneelista.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // --- SAVE ACTION ---
  const handleSaveOnboarding = async () => {
    if (!displayName.trim()) {
      alert("Valmentaja tarvitsee nimesi tallennusta varten!");
      return;
    }

    setSaveLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Käyttäjä ei ole kirjautunut sisään.");

      // 1. Update Profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          display_name: displayName,
          birth_year: birthYear,
          height_cm: heightCm,
          gender,
          timezone: "Europe/Helsinki",
        });
      if (profileError) throw profileError;

      // 2. Update Preferences
      const { error: prefError } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          wake_up_time: wakeUpTime.includes(":") && wakeUpTime.split(":").length === 2 ? `${wakeUpTime}:00` : wakeUpTime,
          bed_time: bedTime.includes(":") && bedTime.split(":").length === 2 ? `${bedTime}:00` : bedTime,
          coaching_style: coachingStyle,
          nutrition_style: nutritionStyle,
        });
      if (prefError) throw prefError;

      // 3. Create Goal & Goal Version
      const goalLabelMap: Record<string, string> = {
        weight_loss: "Painonpudotus",
        weight_maintenance: "Painon ylläpito",
        muscle_gain: "Lihasmassan kasvatus",
        fitness_improvement: "Yleiskunnon kohottaminen",
      };

      const primaryLabel = goalLabelMap[primaryObjective] || "Painonpudotus";

      const { data: goalData, error: goalError } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          primary_objective: primaryObjective,
          primary_objective_label: primaryLabel,
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
          target_date: targetDate,
        })
        .select()
        .single();
      if (goalError) throw goalError;

      // Create goal version
      const { error: versionError } = await supabase
        .from("goal_versions")
        .insert({
          goal_id: goalData.id,
          version: 1,
          target_weight_kg: targetWeightKg,
          weekly_exercise_count_target: weeklyExerciseCount,
          change_reason: "Onboarding-tavoitteen asetus chatin kautta",
        });
      if (versionError) throw versionError;

      // 4. Create starting weight measurement
      const { error: measureError } = await supabase
        .from("body_measurements")
        .insert({
          user_id: user.id,
          metric: "weight",
          value: currentWeightKg,
          source: "manual",
          user_confirmed: true,
        });
      if (measureError) throw measureError;

      router.push("/");
    } catch (err: any) {
      alert(err.message || "Tietojen tallennus epäonnistui.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Check which categories of data have been gathered
  const hasProfile = displayName.trim().length > 0;
  const hasDemographics = heightCm > 0 && currentWeightKg > 0 && birthYear > 1900;
  const hasGoals = targetWeightKg > 0 && targetDate.length > 0;
  const hasLifestyle = wakeUpTime.length > 0 && bedTime.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-foreground flex items-center justify-center p-4 md:p-8">
      {/* Background glow animations */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative">
        {/* LEFT COLUMN: LIVE PROFILE AND TARGET SUMMARY */}
        <div className="lg:col-span-5 rounded-3xl glass-panel border border-border/40 p-6 flex flex-col justify-between gap-6 shadow-2xl bg-secondary/15">
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-heading font-extrabold text-xl tracking-tight">Lähtötiedot & Tavoitteet</h2>
                <p className="text-xs text-muted-foreground">Tiedot päivittyvät reaaliajassa jutellessasi tekoälylle.</p>
              </div>
            </div>

            {/* Checklist of collected states */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                hasProfile ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-secondary/20 border-border/20 text-muted-foreground"
              }`}>
                <Check className={`w-3.5 h-3.5 ${hasProfile ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                Profiili luotu
              </div>
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                hasDemographics ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-secondary/20 border-border/20 text-muted-foreground"
              }`}>
                <Check className={`w-3.5 h-3.5 ${hasDemographics ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                Perustiedot
              </div>
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                hasGoals ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-secondary/20 border-border/20 text-muted-foreground"
              }`}>
                <Check className={`w-3.5 h-3.5 ${hasGoals ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                Tavoitteet
              </div>
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                hasLifestyle ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-secondary/20 border-border/20 text-muted-foreground"
              }`}>
                <Check className={`w-3.5 h-3.5 ${hasLifestyle ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                Arjen rutiinit
              </div>
            </div>

            <hr className="border-border/30" />

            {/* Editable Profile Inputs */}
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[50vh] pr-1">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kutsumanimi</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Kerro nimesi..."
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Syntymävuosi</label>
                  <input
                    type="number"
                    value={birthYear}
                    onChange={(e) => setBirthYear(parseInt(e.target.value) || 1990)}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pituus (cm)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(parseInt(e.target.value) || 180)}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nykyinen paino (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentWeightKg}
                    onChange={(e) => setCurrentWeightKg(parseFloat(e.target.value) || 85)}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sukupuoli / Profiili</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["male", "female", "other"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize cursor-pointer transition-all ${
                        gender === g
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-secondary/20 border-border/40 text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      {g === "male" ? "Mies" : g === "female" ? "Nainen" : "Muu"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tavoitepaino (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={targetWeightKg}
                    onChange={(e) => setTargetWeightKg(parseFloat(e.target.value) || 80)}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tavoitepäivämäärä</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Heräämisaika</label>
                  <input
                    type="time"
                    value={wakeUpTime}
                    onChange={(e) => setWakeUpTime(e.target.value)}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Menoaika nukkumaan</label>
                  <input
                    type="time"
                    value={bedTime}
                    onChange={(e) => setBedTime(e.target.value)}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Viikkotreenit (kpl)</label>
                  <input
                    type="number"
                    value={weeklyExerciseCount}
                    onChange={(e) => setWeeklyExerciseCount(parseInt(e.target.value) || 3)}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ravintotapa</label>
                  <select
                    value={nutritionStyle}
                    onChange={(e) => setNutritionStyle(e.target.value as "joustava" | "tarkka")}
                    className="bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-xs font-semibold outline-none text-muted-foreground"
                  >
                    <option value="joustava" className="bg-slate-900 text-foreground">Joustava</option>
                    <option value="tarkka" className="bg-slate-900 text-foreground">Tarkka</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveOnboarding}
            disabled={!hasProfile || saveLoading}
            className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/25 disabled:opacity-50 disabled:pointer-events-none"
          >
            {saveLoading ? "Luodaan profiilia..." : "Luo profiili ja aloita valmennus"}
            {!saveLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

        {/* RIGHT COLUMN: AI COACH ONBOARDING CHAT */}
        <div className="lg:col-span-7 rounded-3xl glass-panel border border-border/40 flex flex-col h-[75vh] lg:h-auto shadow-2xl relative bg-secondary/5 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border/40 flex items-center gap-3 bg-secondary/10 shrink-0 text-left">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-heading font-extrabold shadow-lg shadow-primary/20">
                F
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary animate-pulse" /> Live Onboarding
              </span>
              <h3 className="font-heading font-bold text-sm text-foreground">Fat2Fit Coach</h3>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 text-left">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all duration-300 ${
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground rounded-tr-none shadow-md shadow-primary/10"
                    : "mr-auto bg-secondary/40 border border-border/20 text-foreground rounded-tl-none"
                }`}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div className="mr-auto items-start max-w-[80%] flex items-center gap-2 text-[10px] text-muted-foreground font-medium bg-secondary/20 border border-border/10 px-4 py-3 rounded-2xl rounded-tl-none animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                Valmentaja analysoi tietoja ja päivittää profiiliasi...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-border/40 bg-secondary/10 flex gap-2 shrink-0">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Kirjoita valmentajalle..."
              disabled={loading}
              className="flex-1 bg-secondary/30 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-xs outline-none transition-all placeholder:text-muted-foreground/60"
            />
            <button
              type="submit"
              disabled={loading || !inputVal.trim()}
              className="p-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-98 transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
