"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Scale,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingDown,
  LineChart as LineIcon,
  HelpCircle,
  Loader2,
  FileText,
  Plus,
  Activity,
  Heart,
  Moon,
  Utensils,
  Dumbbell,
  CheckCircle,
  PlusCircle,
  FileDown,
  ChevronRight,
  Info,
  CalendarDays,
  Target
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar
} from "recharts";
import { supabaseBrowser } from "@/lib/supabase/client";

type Tab = "yhteenveto" | "kayrat" | "raportit" | "yhteydet" | "mittarit";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const pt = payload[0].payload;
    const hasWeight = pt.actualWeight !== null && pt.actualWeight !== undefined;
    
    // Calculate goal gap
    const targetLineVal = pt.linearGoal;
    const currentWeightVal = pt.actualWeight !== null && pt.actualWeight !== undefined ? pt.actualWeight : pt.ema7;
    const gap = (targetLineVal !== null && targetLineVal !== undefined && currentWeightVal !== null && currentWeightVal !== undefined)
      ? Number((currentWeightVal - targetLineVal).toFixed(2))
      : null;
      
    return (
      <div className="bg-[#18181b] border border-border/40 p-4 rounded-xl shadow-lg text-xs flex flex-col gap-1.5 text-left">
        <p className="font-bold text-muted-foreground mb-1">
          {new Date(pt.date).toLocaleDateString("fi-FI", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        </p>
        {hasWeight ? (
          <p className="text-foreground font-semibold flex items-center justify-between gap-4">
            <span>Punnitus:</span>
            <span className="text-primary font-black text-sm">{pt.actualWeight} kg</span>
          </p>
        ) : (
          <p className="text-muted-foreground italic">Ei punnitusta tältä päivältä</p>
        )}
        {pt.ema7 !== null && pt.ema7 !== undefined && (
          <p className="text-[#8b5cf6] flex items-center justify-between gap-4">
            <span>7 pv trendi:</span>
            <span className="font-semibold">{pt.ema7} kg</span>
          </p>
        )}
        {pt.ema28 !== null && pt.ema28 !== undefined && (
          <p className="text-[#6366f1] flex items-center justify-between gap-4">
            <span>28 pv trendi:</span>
            <span className="font-semibold">{pt.ema28} kg</span>
          </p>
        )}
        {targetLineVal !== null && targetLineVal !== undefined && (
          <p className="text-[#10b981] flex items-center justify-between gap-4">
            <span>Tavoitekäyrä:</span>
            <span className="font-semibold">{targetLineVal} kg</span>
          </p>
        )}
        {pt.targetWeight !== null && pt.targetWeight !== undefined && (
          <p className="text-emerald-400 flex items-center justify-between gap-4">
            <span>Tavoitepaino:</span>
            <span className="font-semibold">{pt.targetWeight} kg</span>
          </p>
        )}
        {gap !== null && (
          <p className={`flex items-center justify-between gap-4 font-semibold mt-0.5 pt-1 border-t border-border/10 ${gap <= 0.1 ? "text-emerald-400" : "text-amber-400"}`}>
            <span>Ero tavoitteeseen tänään:</span>
            <span>{gap >= 0 ? `+${gap.toFixed(1)}` : gap.toFixed(1)} kg</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function ProgressPage() {
  const supabase = supabaseBrowser();
  const [activeTab, setActiveTab] = useState<Tab>("yhteenveto");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Range filter for charts
  const [chartRange, setChartRange] = useState<number>(30); // 7, 30, 90, 180, 365
  
  // Custom metrics form states
  const [metricName, setMetricName] = useState("");
  const [metricType, setMetricType] = useState<"number" | "boolean" | "scale">("number");
  const [metricUnit, setMetricUnit] = useState("");
  const [metricTarget, setMetricTarget] = useState("");
  const [metricDirection, setMetricDirection] = useState(true); // true = higher is better
  
  // Logging form states
  const [selectedMetricId, setSelectedMetricId] = useState("");
  const [logValue, setLogValue] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);

  // Event tags states
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [eventTags, setEventTags] = useState<any[]>([
    { date: "2026-06-10", label: "Kaloritasomuutos (-200 kcal)" },
    { date: "2026-06-22", label: "Uusi treeniohjelma" }
  ]);

  // Reports
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/summary");
      const summaryData = await res.json();
      if (summaryData.error) throw new Error(summaryData.error);
      setData(summaryData);
      
      if (summaryData.customMetrics?.length > 0) {
        setSelectedMetricId(summaryData.customMetrics[0].id);
      }

      // Fetch weekly reports
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: dbReports } = await supabase
          .from("weekly_reports")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false });
        
        if (dbReports && dbReports.length > 0) {
          setWeeklyReports(dbReports);
        } else {
          // Add default fallback report
          setWeeklyReports([
            {
              id: "report-1",
              date: "2026-07-05",
              weight_average: summaryData.trends.latestWeight,
              calories_average: summaryData.recentAverages.calories || 2150,
              protein_average: summaryData.recentAverages.protein || 160,
              exercise_count: summaryData.recentAverages.exerciseCount || 3,
              highlights: "Upea kehitysviikko! Treenasit ahkerasti ja energiavaje toteutui suunnitelman mukaisesti. Painon trendiviiva osoittaa tasaiseen alaspäin suuntaan.",
              status_summary: "Etenee tavoitevauhdissa",
              successes: ["Proteiinitavoite täyttyi 6/7 päivänä.", "Liikuntakuorma oli erinomaisen nousujohteinen."],
              focus_area: "Pidä kiinni riittävästä unesta kuormituksen kasvaessa.",
              recommendations: ["Nuku vähintään 7.5h joka yö.", "Toteuta 3 suunniteltua treeniä."]
            }
          ]);
        }
      }
    } catch (err) {
      console.error("Error fetching analytics data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Handle adding a custom metric definition
  const handleAddMetricDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricName.trim()) return;

    try {
      const res = await fetch("/api/analytics/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_definition",
          name: metricName.trim(),
          type: metricType,
          unit: metricUnit.trim() || null,
          target_value: metricTarget ? Number(metricTarget) : null,
          higher_is_better: metricDirection
        })
      });
      const result = await res.json();
      if (result.success) {
        alert("Mittari luotu onnistuneesti!");
        setMetricName("");
        setMetricUnit("");
        setMetricTarget("");
        fetchSummary();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle logging a value
  const handleLogMetricValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMetricId || !logValue) return;

    try {
      const res = await fetch("/api/analytics/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_entry",
          metric_id: selectedMetricId,
          date: logDate,
          value: Number(logValue)
        })
      });
      const result = await res.json();
      if (result.success) {
        alert("Arvo kirjattu onnistuneesti!");
        setLogValue("");
        fetchSummary();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle generating a new report
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/analytics/generate-report", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        alert("Viikkoraportti luotu!");
        setWeeklyReports(prev => {
          // Remove duplicates if same date exists
          const filtered = prev.filter(r => r.date !== result.report.date);
          return [result.report, ...filtered];
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Add event marker on chart
  const handleAddEventTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setEventTags(prev => [...prev, { date: eventDate, label: eventTitle.trim() }]);
    setEventTitle("");
  };

  // Simulate PDF Download
  const handleDownloadPDF = (report: any) => {
    const reportText = `
FAT2FIT VIIKKORAPORTTI - ${new Date(report.date).toLocaleDateString("fi-FI")}
------------------------------------------------------------
Tila: ${report.status_summary}
Paino ka.: ${report.weight_average} kg
Kalorit ka.: ${report.calories_average} kcal/pv
Proteiini ka.: ${report.protein_average} g/pv
Harjoitukset: ${report.exercise_count} kpl

Katsaus:
"${report.highlights}"

Onnistumiset:
${report.successes?.map((s: string) => `- ${s}`).join("\n") || "Ei kirjattuja onnistumisia"}

Kehityskohde:
- ${report.focus_area || "Jatka samaan malliin."}

Suositukset ensi viikolle:
${report.recommendations?.map((r: string) => `- ${r}`).join("\n") || "Ei asetettuja suosituksia"}
    `;

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fat2fit-raportti-${report.date}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Compile Recharts line chart data based on active range using real weightHistory from API
  const rawPoints = data?.weightHistory || [];
  const actualWeighInCount = rawPoints.filter((pt: any) => pt.actualWeight !== null).length;

  const chartData = rawPoints
    .slice(-chartRange)
    .map((pt: any) => {
      return {
        dateStr: new Date(pt.date).toLocaleDateString("fi-FI", { day: "numeric", month: "short" }),
        weight: pt.actualWeight,
        ema7: pt.ema7,
        ema28: pt.ema28,
        linearGoal: pt.linearGoal,
        targetWeight: pt.targetWeight,
        ...pt
      };
    });

  return (
    <div className="flex flex-col gap-6 pb-12 text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Analytiikkapaneeli
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight font-heading">
            Kehitys & Tilastot
          </h2>
        </div>

        {data?.usingMockData && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Info className="w-3.5 h-3.5" />
            Käytetään paikallista tallennusta
          </span>
        )}
      </div>

      {/* Tabs list */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-secondary/10 border border-border/40 rounded-2xl shrink-0">
        {[
          { id: "yhteenveto", label: "Tänään & KPI", icon: Target },
          { id: "kayrat", label: "Kehityskäyrät", icon: LineIcon },
          { id: "raportit", label: "Viikkoraportit", icon: FileText },
          { id: "yhteydet", label: "Yhteydet & Havainnot", icon: Sparkles },
          { id: "mittarit", label: "Omat Mittarit", icon: Activity }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* --- TAB CONTENT: YHTEENVETO (TODAY Overview) --- */}
      {activeTab === "yhteenveto" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl glass-panel border border-border/40 p-5 bg-secondary/10 flex flex-col justify-between h-32 text-left">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-primary" /> Painon muutos ohjelman alusta
              </span>
              {(() => {
                const actualCount = data?.weightHistory?.filter((p: any) => p.actualWeight !== null && p.actualWeight !== undefined).length || 0;
                if (actualCount < 2) {
                  return (
                    <>
                      <div className="text-[10px] font-semibold text-amber-400 mt-1 leading-snug">
                        Painon muutos muodostuu, kun ohjelman aikana on vähintään kaksi punnitusta.
                      </div>
                      <div className="text-[9px] text-muted-foreground flex justify-between mt-1 border-t border-border/10 pt-1">
                        <span>Alku: {data?.goals?.startingWeight?.toFixed(1) || "0.0"} kg</span>
                        <span>Nykyinen: {data?.goals?.currentWeight?.toFixed(1) || "0.0"} kg</span>
                      </div>
                    </>
                  );
                }
                return (
                  <>
                    <div className="text-3xl font-black font-heading mt-2">
                      {data?.goals?.changeKg >= 0 ? `+${data.goals.changeKg.toFixed(1)}` : data?.goals?.changeKg?.toFixed(1) || "0.0"}
                      <span className="text-sm font-bold text-muted-foreground ml-1">kg</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground flex justify-between border-t border-border/10 pt-1">
                      <span>Alku: {data?.goals?.startingWeight?.toFixed(1)} kg</span>
                      <span>Muutos: {data?.goals?.changePct?.toFixed(1)}%</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="rounded-2xl glass-panel border border-border/40 p-5 bg-secondary/10 flex flex-col justify-between h-32">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-400" /> Tavoitteesta
              </span>
              <div className="text-3xl font-black font-heading mt-2">
                {data?.goals?.progressPercent || 0}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                Tavoitepaino: {data?.goals?.targetWeight} kg
              </span>
            </div>

            <div className="rounded-2xl glass-panel border border-border/40 p-5 bg-secondary/10 flex flex-col justify-between h-32">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400" /> Ennuste
              </span>
              <div className="text-lg font-bold leading-snug mt-2">
                {data?.trends?.projectedDays > 0 ? (
                  <>
                    Tavoite saavutetaan n.{" "}
                    <span className="text-primary font-black text-xl">{data.trends.projectedDays} pv</span> päästä
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">Kerätään painotietoja...</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Vauhti: {data?.trends?.weeklyRate || 0} kg/viikko
              </span>
            </div>

            <div className="rounded-2xl glass-panel border border-border/40 p-5 bg-secondary/10 flex flex-col justify-between h-32">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-rose-400" /> Kulutus (TDEE)
              </span>
              <div className="text-3xl font-black font-heading mt-2">
                {data?.metabolism?.tdee || 2400}
                <span className="text-sm font-bold text-muted-foreground ml-1">kcal</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Lepoaineenvaihdunta: {data?.metabolism?.bmr} kcal
              </span>
            </div>
          </div>

          {/* AI Insight Box */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex gap-3 items-start">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h4 className="text-xs font-bold text-foreground mb-1">Valmentajan päivittäinen analytiikkanosto</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {data?.trends?.plateau?.isPlateau 
                  ? data.trends.plateau.message 
                  : `Painosi laskee maltillisesti tavoitteeseesi nähden. Nykyisellä ${data?.trends?.weeklyRate} kg viikkovauhdilla olet matkalla saavuttamaan tavoitteesi arviolta ${data?.trends?.projectedDate ? new Date(data.trends.projectedDate).toLocaleDateString("fi-FI") : ""}.`
                }
              </p>
            </div>
          </div>

          {/* Two-Column detail view */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Toimintatavoitteiden (Behaviors) seuranta */}
            <div className="rounded-2xl glass-panel border border-border/40 p-6 flex flex-col gap-4">
              <h3 className="font-heading font-bold text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" /> Päivän toimintamittarit
              </h3>
              <p className="text-xs text-muted-foreground">Nämä ovat asioita, joihin voit vaikuttaa joka päivä suoraan.</p>

              <div className="flex flex-col gap-4 mt-2">
                {/* Calories Progress */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Ravinnon kalorit</span>
                    <span>{data?.recentAverages?.calories} / 2100 kcal</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all" 
                      style={{ width: `${Math.min((data?.recentAverages?.calories / 2100) * 100, 100)}%` }} 
                    />
                  </div>
                </div>

                {/* Protein progress */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Proteiinitavoite</span>
                    <span>{data?.recentAverages?.protein} / 170 g</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-violet-400 rounded-full transition-all" 
                      style={{ width: `${Math.min((data?.recentAverages?.protein / 170) * 100, 100)}%` }} 
                    />
                  </div>
                </div>

                {/* Sleep hours */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Unen kesto (ka.)</span>
                    <span>{data?.recentAverages?.sleepHours} / 7.5 h</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-400 rounded-full transition-all" 
                      style={{ width: `${Math.min((data?.recentAverages?.sleepHours / 7.5) * 100, 100)}%` }} 
                    />
                  </div>
                </div>

                {/* Exercises completed */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Harjoitukset (viikko)</span>
                    <span>{data?.recentAverages?.exerciseCount} / {data?.goals?.weeklyExerciseTarget} kpl</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-400 rounded-full transition-all" 
                      style={{ width: `${Math.min((data?.recentAverages?.exerciseCount / data?.goals?.weeklyExerciseTarget) * 100, 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Terveys & Palautuminen (Averages) */}
            <div className="rounded-2xl glass-panel border border-border/40 p-6 flex flex-col gap-4">
              <h3 className="font-heading font-bold text-base flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-400" /> Terveys & Palautumisen tilanne
              </h3>
              <p className="text-xs text-muted-foreground">Viimeisen 7 päivän palautumisen ja hyvinvoinnin keskiarvot.</p>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="p-3 bg-secondary/15 rounded-xl border border-border/20 text-center">
                  <Moon className="w-4 h-4 text-indigo-400 mx-auto mb-1.5" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Unen laatu</span>
                  <p className="text-lg font-black mt-0.5">{data?.recentAverages?.sleepQuality} / 5</p>
                </div>
                
                <div className="p-3 bg-secondary/15 rounded-xl border border-border/20 text-center">
                  <Activity className="w-4 h-4 text-amber-400 mx-auto mb-1.5" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Energiataso</span>
                  <p className="text-lg font-black mt-0.5">{data?.recentAverages?.energyLevel} / 5</p>
                </div>

                <div className="p-3 bg-secondary/15 rounded-xl border border-border/20 text-center">
                  <Scale className="w-4 h-4 text-primary mx-auto mb-1.5" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Vaje (TDEE)</span>
                  <p className="text-lg font-black mt-0.5 text-emerald-400">{data?.recentAverages?.caloriesDeficit} kcal</p>
                </div>

                <div className="p-3 bg-secondary/15 rounded-xl border border-border/20 text-center">
                  <Activity className="w-4 h-4 text-red-400 mx-auto mb-1.5" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Stressitaso</span>
                  <p className="text-lg font-black mt-0.5">{data?.recentAverages?.stressLevel} / 5</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: KEHITYSKÄYRÄT (Progress Charts) --- */}
      {activeTab === "kayrat" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Tavoite-eron KPI / Tilakortti */}
          {(() => {
            const hasGoal = data?.goals?.hasGoalConfigured;
            if (!hasGoal) {
              return (
                <div className="rounded-2xl glass-panel border border-border/40 p-5 bg-secondary/10 text-left">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Target className="w-4 h-4 text-muted-foreground" /> Tavoitekäyrän tilanne
                  </span>
                  <div className="text-xs text-amber-400 font-medium leading-relaxed">
                    Lineaarinen tavoitekäyrä näkyy, kun painotavoite ja tavoitepäivä on määritetty.
                  </div>
                </div>
              );
            }

            const points = data?.weightHistory || [];
            let lastValidPoint = null;
            for (let i = points.length - 1; i >= 0; i--) {
              const pt = points[i];
              if ((pt.actualWeight !== null || pt.ema7 !== null) && pt.linearGoal !== null) {
                lastValidPoint = pt;
                break;
              }
            }

            if (!lastValidPoint) return null;

            const targetVal = lastValidPoint.linearGoal;
            const currentVal = lastValidPoint.actualWeight !== null ? lastValidPoint.actualWeight : lastValidPoint.ema7;
            const gap = Number((currentVal - targetVal).toFixed(2));

            let statusColor = "text-emerald-400";
            let statusText = "Tavoitevauhdissa";
            if (gap > 0.1) {
              statusColor = "text-amber-400";
              statusText = `${gap.toFixed(1)} kg tavoitekäyrän jäljessä`;
            } else if (gap < -0.1) {
              statusText = `${Math.abs(gap).toFixed(1)} kg edellä tavoitekäyrää`;
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <div className="rounded-2xl glass-panel border border-border/40 p-4 bg-secondary/10 text-left flex flex-col justify-between min-h-20">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Aloituspaino</span>
                  <div className="text-lg font-black mt-1">{data?.goals?.startingWeight?.toFixed(1)} kg</div>
                </div>
                <div className="rounded-2xl glass-panel border border-border/40 p-4 bg-secondary/10 text-left flex flex-col justify-between min-h-20">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Nykyinen paino</span>
                  <div className="text-lg font-black mt-1">{data?.goals?.currentWeight?.toFixed(1)} kg</div>
                </div>
                <div className="rounded-2xl glass-panel border border-border/40 p-4 bg-secondary/10 text-left flex flex-col justify-between min-h-20">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Tavoitepaino</span>
                  <div className="text-lg font-black mt-1">{data?.goals?.targetWeight?.toFixed(1)} kg</div>
                </div>
                <div className="rounded-2xl glass-panel border border-border/40 p-4 bg-secondary/10 text-left flex flex-col justify-between min-h-20">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Tämän päivän tavoite</span>
                  <div className="text-lg font-black mt-1">{targetVal?.toFixed(1)} kg</div>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left flex flex-col justify-between min-h-20 md:col-span-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary animate-pulse" /> Tilan yhteenveto
                  </span>
                  <div className={`text-xs font-bold mt-1 ${statusColor}`}>
                    {statusText}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Chart Card */}
          <div className="rounded-2xl glass-panel border border-border/40 p-6 flex flex-col gap-6 bg-secondary/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <LineIcon className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-muted-foreground">Painokehitys vs. Tavoite</h3>
              </div>

              {/* Range Selector */}
              <div className="flex bg-secondary/30 rounded-lg p-0.5 border border-border/40">
                {[
                  { label: "7 pv", value: 7 },
                  { label: "30 pv", value: 30 },
                  { label: "90 pv", value: 90 },
                  { label: "180 pv", value: 180 },
                  { label: "Kaikki", value: 365 }
                ].map(r => (
                  <button
                    key={r.value}
                    onClick={() => setChartRange(r.value)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      chartRange === r.value 
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Chart */}
            {actualWeighInCount === 0 ? (
              <div className="w-full h-80 flex flex-col items-center justify-center border border-dashed border-border/40 rounded-xl bg-secondary/5 text-center p-6">
                <Scale className="w-12 h-12 text-muted-foreground mb-3 animate-pulse" />
                <h4 className="font-bold text-sm text-foreground mb-1">Ei painotietoja saatavilla</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Lisää vähintään yksi punnitus aloittaaksesi painonseurannan. Voit kirjata painon sovelluksen aamutarkistuksessa tai chatissa.
                </p>
              </div>
            ) : (
              <>
                {actualWeighInCount > 0 && actualWeighInCount < 3 && (
                  <div className="flex gap-2 items-center p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Painotrendi tarkentuu, kun punnituksia on vähintään kolme (nyt: {actualWeighInCount}/3).</span>
                  </div>
                )}
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="dateStr" stroke="#71717a" fontSize={11} />
                      <YAxis domain={["dataMin - 1", "dataMax + 1"]} stroke="#71717a" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 1.5, fill: "#f59e0b", stroke: "#18181b" }}
                        activeDot={{ r: 6, strokeWidth: 2, fill: "#ffffff", stroke: "#f59e0b" }}
                        connectNulls={true}
                        name="Toteutunut paino"
                      />
                      <Line
                        type="monotone"
                        dataKey="linearGoal"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        name="Lineaarinen tavoitekäyrä"
                      />
                      <Line
                        type="monotone"
                        dataKey="ema7"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        name="7 pv trendi"
                      />
                      <Line
                        type="monotone"
                        dataKey="ema28"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                        name="28 pv trendi"
                      />
                      <ReferenceLine y={data?.goals?.targetWeight || 80} stroke="#34d399" strokeWidth={1} strokeDasharray="5 5" label={{ value: 'Tavoitepaino', fill: '#34d399', fontSize: 10, position: 'top' }} />
                      
                      {/* Event markers overlays */}
                      {eventTags.map((ev, i) => (
                        <ReferenceLine
                          key={i}
                          x={new Date(ev.date).toLocaleDateString("fi-FI", { day: "numeric", month: "short" })}
                          stroke="#ef4444"
                          strokeWidth={0.75}
                          strokeDasharray="4 4"
                          label={{ value: ev.label, fill: "#ef4444", fontSize: 9, position: "insideTopLeft" }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-[10px] font-bold justify-center border-t border-border/20 pt-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />Toteutunut paino</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />Lineaarinen tavoitekäyrä</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />7 pv trendi</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />28 pv trendi</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" />Tavoitepaino</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />Tapahtumamerkintä</span>
            </div>
          </div>

          {/* Event tags adder */}
          <div className="rounded-2xl glass-panel border border-border/40 p-5 bg-secondary/10 flex flex-col gap-4">
            <h4 className="font-heading font-bold text-sm">Lisää tapahtumamerkintä kuvaajaan</h4>
            <p className="text-xs text-muted-foreground">Voit lisätä kuvaajaan huomioita (esim. sairastuminen tai loma) ymmärtääksesi painon vaihtelun syitä.</p>
            <form onSubmit={handleAddEventTag} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Tapahtuman kuvaus (esim. Loma alkoi, Sairastuminen)..."
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                className="flex-1 bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary"
              />
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer"
              >
                Lisää merkintä
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: VIIKKORAPORTIT (Weekly Reports) --- */}
      {activeTab === "raportit" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Action Row */}
          <div className="flex justify-between items-center bg-secondary/10 border border-border/30 p-4 rounded-2xl">
            <div className="text-left">
              <h4 className="text-xs font-bold">Luo uusi viikkoraportti</h4>
              <p className="text-[10px] text-muted-foreground">Kerää ja analysoi viimeisen 7 päivän toteutuneet ravinto-, liikunta- ja unitiedot.</p>
            </div>
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {generatingReport ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Luodaan...
                </>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  Analysoi viikko
                </>
              )}
            </button>
          </div>

          {/* Reports list */}
          <div className="flex flex-col gap-4">
            {weeklyReports.map((report) => (
              <div key={report.id} className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-5">
                <div className="flex justify-between items-center border-b border-border/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider">
                      Viikkoraportti
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Kaari päättyi {new Date(report.date).toLocaleDateString("fi-FI")}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleDownloadPDF(report)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    <FileDown className="w-3 h-3" />
                    Lataa teksti
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 flex flex-col gap-4">
                    {/* Highlights */}
                    <div className="bg-secondary/15 rounded-xl p-4 border border-border/10">
                      <h4 className="text-xs font-bold text-primary flex items-center gap-1 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Valmentajan analyysi
                      </h4>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        "{report.highlights}"
                      </p>
                    </div>

                    {/* Successes and Recommendations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="flex flex-col gap-2">
                        <h5 className="font-bold text-emerald-400 uppercase tracking-wide text-[9px]">Tärkeimmät onnistumiset</h5>
                        <ul className="list-disc pl-4 text-muted-foreground leading-relaxed flex flex-col gap-1">
                          {report.successes?.map((s: string, idx: number) => (
                            <li key={idx}>{s}</li>
                          )) || <li>Treenit ja ateriat tehty säännöllisesti.</li>}
                        </ul>
                      </div>

                      <div className="flex flex-col gap-2">
                        <h5 className="font-bold text-amber-400 uppercase tracking-wide text-[9px]">Ensi viikon konkreettiset tavoitteet</h5>
                        <ul className="list-decimal pl-4 text-muted-foreground leading-relaxed flex flex-col gap-1">
                          {report.recommendations?.map((r: string, idx: number) => (
                            <li key={idx}>{r}</li>
                          )) || <li>Jatka nykyisen kalorivajeen noudattamista.</li>}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar stats panel */}
                  <div className="lg:col-span-4 rounded-xl border border-border/30 bg-secondary/5 p-4 flex flex-col gap-4">
                    <div className="text-center pb-2 border-b border-border/20">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Viikon Tila</span>
                      <p className="text-xs font-bold text-emerald-400 mt-0.5">{report.status_summary || "Etenee tavoitteessa"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-secondary/20 p-2.5 rounded-lg border border-border/10">
                        <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-wide">Paino ka.</span>
                        <p className="text-sm font-black mt-0.5">{report.weight_average} kg</p>
                      </div>
                      <div className="bg-secondary/20 p-2.5 rounded-lg border border-border/10">
                        <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-wide">Treenit</span>
                        <p className="text-sm font-black mt-0.5">{report.exercise_count} kpl</p>
                      </div>
                      <div className="bg-secondary/20 p-2.5 rounded-lg border border-border/10 col-span-2">
                        <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-wide">Kalorit ka.</span>
                        <p className="text-sm font-black mt-0.5">{report.calories_average} kcal</p>
                      </div>
                    </div>

                    <div className="text-center pt-2 border-t border-border/20">
                      <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-wider">Kehityskohde</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-relaxed">
                        {report.focus_area || "Säännöllinen ravintoseuranta."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: YHTEYDET & HAVAINNOT (Connections) --- */}
      {activeTab === "yhteydet" && (
        <div className="flex flex-col gap-6 animate-fade-in text-left">
          {/* Introduction */}
          <div className="rounded-2xl bg-secondary/10 border border-border/30 p-5 flex gap-3.5 items-start">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h4 className="text-xs font-bold text-foreground">Miten analytiikka löytää yhteydet?</h4>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Järjestelmä vertaa kirjaamiasi arvoja (kuten uni, nälkä, leposyke ja alkoholi) keskenään ja laskee Pearsonin korrelaatiokertoimen. Luotettavuustaso nousee, kun kirjaat enemmän vertailukelpoisia päiviä.
              </p>
            </div>
          </div>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data?.insights?.map((ins: any, idx: number) => (
              <div key={idx} className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col justify-between gap-5">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-heading font-bold text-sm text-foreground">{ins.title}</h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      ins.reliability === "high" 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {ins.reliability === "high" ? "Korkea luotettavuus" : "Kohtalainen luotettavuus"}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    "{ins.content}"
                  </p>
                </div>

                {/* Small comparative graphic depending on insight type */}
                <div className="w-full h-32 mt-2 bg-secondary/15 rounded-xl border border-border/10 p-2 flex items-center justify-center">
                  {ins.insight_type === "sleep_vs_hunger" ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { tila: "Uni < 6.5h", nalka: 4.2 },
                        { tila: "Uni 6.5-7.5h", nalka: 3.1 },
                        { tila: "Uni > 7.5h", nalka: 2.1 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="tila" stroke="#71717a" fontSize={9} />
                        <YAxis domain={[0, 5]} stroke="#71717a" fontSize={9} label={{ value: "Nälkä 1-5", angle: -90, position: "insideLeft", fontSize: 8 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181b" }} />
                        <Bar dataKey="nalka" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { tila: "Alkoholi", uni: 2.8 },
                        { tila: "Alkoholiton", uni: 4.4 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="tila" stroke="#71717a" fontSize={9} />
                        <YAxis domain={[0, 5]} stroke="#71717a" fontSize={9} label={{ value: "Unilaatu 1-5", angle: -90, position: "insideLeft", fontSize: 8 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181b" }} />
                        <Bar dataKey="uni" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 border-t border-border/20 pt-4">
                  <span className="text-[9px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                    <Info className="w-3 h-3 text-primary" /> Valmentajan suositus
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {ins.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: OMAT MITTARIT (Custom Metrics Manager) --- */}
      {activeTab === "mittarit" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-left">
          {/* Left panel: Log value input & Active metrics list */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Logging Form */}
            <div className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-4">
              <h3 className="font-heading font-bold text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary" /> Kirjaa omien mittareiden arvo
              </h3>
              <p className="text-xs text-muted-foreground">Valitse luomasi mittari alta ja kirjaa tämän päivän arvo.</p>

              <form onSubmit={handleLogMetricValue} className="flex flex-col gap-4 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valitse mittari</label>
                    <select
                      value={selectedMetricId}
                      onChange={e => setSelectedMetricId(e.target.value)}
                      className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary text-muted-foreground"
                    >
                      {data?.customMetrics?.map((m: any) => (
                        <option key={m.id} value={m.id} className="bg-slate-900 text-foreground">{m.name} ({m.type})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Päivämäärä</label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={e => setLogDate(e.target.value)}
                      className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Arvo / Tulos</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Arvo (esim. 8 tai 1 kyllä/ei -mittarissa)..."
                    value={logValue}
                    onChange={e => setLogValue(e.target.value)}
                    className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="submit"
                  className="py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer w-fit"
                >
                  Tallenna kirjaus
                </button>
              </form>
            </div>

            {/* List of custom metrics */}
            <div className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-4">
              <h3 className="font-heading font-bold text-base">Aktiiviset mittarisi</h3>
              <div className="flex flex-col gap-4">
                {data?.customMetrics?.map((m: any) => {
                  const getSourceStyle = (src: string) => {
                    switch(src) {
                      case "goal_created":
                        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                      case "user_created":
                        return "bg-violet-500/10 text-violet-400 border border-violet-500/20";
                      case "integration":
                        return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
                      case "ai_suggested":
                        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
                      default:
                        return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
                    }
                  };
                  
                  const getSourceLabel = (src: string) => {
                    switch(src) {
                      case "goal_created": return "Tavoitteesta luotu";
                      case "user_created": return "Käyttäjän luoma";
                      case "integration": return "Integraatio";
                      case "ai_suggested": return "AI:n ehdottama";
                      default: return "Järjestelmän oletus";
                    }
                  };

                  return (
                    <div key={m.id} className="flex flex-col gap-3 p-4 bg-secondary/15 rounded-xl border border-border/20 text-xs">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2 items-center">
                            <span className="font-bold text-foreground text-sm">{m.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${getSourceStyle(m.source_type)}`}>
                              {getSourceLabel(m.source_type)}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-semibold capitalize">{m.type} {m.unit ? `(${m.unit})` : ""}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground">Tavoite:</span>
                          <p className="font-bold text-primary mt-0.5">{m.target_value !== null ? `${m.target_value} ${m.unit || ""}` : "Ei asetettu"}</p>
                        </div>
                      </div>
                      
                      <div className="border-t border-border/10 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                          {m.metric_start_date ? (
                            <span>Seuranta alkanut: <strong className="text-foreground">{new Date(m.metric_start_date).toLocaleDateString("fi-FI")}</strong></span>
                          ) : (
                            <span className="text-amber-400/90 font-semibold flex items-center gap-1">
                              <Info className="w-3 h-3 shrink-0" />
                              Ei dataa vielä — Seuranta käynnistyy ensimmäisestä kirjauksesta
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {m.last_value !== null ? (
                            <span className="text-[10px] text-muted-foreground">
                              Viimeisin: <strong className="text-foreground text-xs font-black">{m.last_value} {m.unit || ""}</strong> ({m.last_data_at ? new Date(m.last_data_at).toLocaleDateString("fi-FI") : ""})
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Ei kirjauksia</span>
                          )}
                        </div>
                      </div>

                      {/* Display warning/instruction helper if empty */}
                      {m.last_value === null && (
                        <div className="mt-1 p-2.5 rounded-lg bg-amber-500/5 text-[10px] text-amber-300/80 leading-relaxed border border-amber-500/10">
                          {m.metric_key === "weight" && "Painotavoite on aktiivinen. Kirjaa ensimmäinen painosi, niin painokehitys ja tavoitekäyrä alkavat."}
                          {m.metric_key === "waist_cm" && "Vyötärötavoite on asetettu, mutta vyötärömittauksia ei ole vielä lisätty. Lisää ensimmäinen mittaus, niin seuranta alkaa tästä päivästä."}
                          {m.metric_key === "sleep_hours" && "Unitavoitteen seuranta alkaa, kun kirjaat aamun check-inin."}
                          {m.metric_key === "protein_g" && "Proteiinitavoitteen seuranta alkaa, kun kirjaat ensimmäisen ruokapäivän."}
                          {!["weight", "waist_cm", "sleep_hours", "protein_g"].includes(m.metric_key) && "Aloita mittarin seuranta ja trendin kertyminen tallentamalla ensimmäinen kirjaus yllä olevalla lomakkeella."}
                        </div>
                      )}
                    </div>
                  );
                })}
                {data?.customMetrics?.length === 0 && (
                  <p className="text-xs text-muted-foreground">Ei vielä omia mittareita. Luo ensimmäinen oikeasta sivupaneelista!</p>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Custom metric definition creator */}
          <div className="lg:col-span-5 rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-4">
            <h3 className="font-heading font-bold text-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Luo uusi mittari
            </h3>
            <p className="text-xs text-muted-foreground">Määritä täysin uusi seurattava asia hyvinvointisi tai elintapojesi tueksi.</p>

            <form onSubmit={handleAddMetricDefinition} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mittarin nimi</label>
                <input
                  type="text"
                  placeholder="Esim. Kiputaso, Vedenjuonti, Mieliala..."
                  value={metricName}
                  onChange={e => setMetricName(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mittauksen tyyppi</label>
                <select
                  value={metricType}
                  onChange={e => setMetricType(e.target.value as "number" | "boolean" | "scale")}
                  className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary text-muted-foreground"
                >
                  <option value="number" className="bg-slate-900 text-foreground">Numero (esim. vyötärö cm, verenpaine)</option>
                  <option value="boolean" className="bg-slate-900 text-foreground">Kyllä / Ei (esim. Söinkö aamiaisen)</option>
                  <option value="scale" className="bg-slate-900 text-foreground">Asteikko 1-5 (esim. Stressi, Motivaatio)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Yksikkö (Valinnainen)</label>
                  <input
                    type="text"
                    placeholder="Esim. cm, mmHg, kpl..."
                    value={metricUnit}
                    onChange={e => setMetricUnit(e.target.value)}
                    className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tavoitearvo</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Esim. 85 tai 1"
                    value={metricTarget}
                    onChange={e => setMetricTarget(e.target.value)}
                    className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tavoiteltava suunta</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetricDirection(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      metricDirection
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-secondary/20 border-border/40 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    Suurempi on parempi
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricDirection(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      !metricDirection
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-secondary/20 border-border/40 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    Pienempi on parempi
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="mt-2 w-full py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer shadow-lg shadow-primary/25"
              >
                Luo uusi mittari
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
