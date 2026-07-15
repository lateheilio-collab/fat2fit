"use client";

import { useState, useEffect } from "react";
import {
  CalendarRange,
  Dumbbell,
  Clock,
  Sparkles,
  Undo2,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Loader2,
  Info,
  Timer,
  Check,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

type PlannedWorkout = {
  id: string;
  date: string;
  activityType: string;
  title: string;
  durationMinutes: number;
  intensity: string;
  status: string;
  description?: string;
};

export function estimateWorkoutCalories(
  activityType: string,
  durationMinutes: number,
  intensity: string,
  weightKg: number
): number {
  let met = 7.0; // default
  const act = activityType.toLowerCase();

  if (act.includes("juoksu") || act.includes("run")) {
    met = intensity === "easy" || intensity === "recovery" ? 6.0 : intensity === "moderate" ? 9.8 : 11.5;
  } else if (act.includes("sali") || act.includes("kuntosali") || act.includes("gym") || act.includes("voima")) {
    met = intensity === "easy" || intensity === "recovery" ? 3.5 : intensity === "moderate" ? 5.0 : 6.0;
  } else if (act.includes("pyörä") || act.includes("cycling") || act.includes("pyöräily")) {
    met = intensity === "easy" || intensity === "recovery" ? 5.0 : intensity === "moderate" ? 7.5 : 9.5;
  } else if (act.includes("uinti") || act.includes("swim")) {
    met = intensity === "easy" || intensity === "recovery" ? 5.0 : intensity === "moderate" ? 7.0 : 9.5;
  } else if (act.includes("kävely") || act.includes("walk")) {
    met = intensity === "easy" || intensity === "recovery" ? 3.0 : intensity === "moderate" ? 3.8 : 4.5;
  } else {
    met = intensity === "easy" || intensity === "recovery" ? 5.0 : intensity === "moderate" ? 7.5 : 10.0;
  }

  return Math.round(met * weightKg * (durationMinutes / 60));
}

export default function PlanPage() {
  const supabase = supabaseBrowser();
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout | null>(null);
  const [loading, setLoading] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form states to add new workout
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("Juoksu");
  const [newDuration, setNewDuration] = useState(45);
  const [newIntensity, setNewIntensity] = useState("moderate");

  // Calorie & Heart Rate completion states
  const [userWeight, setUserWeight] = useState<number>(86.3); // Default to reported weight
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeDuration, setCompleteDuration] = useState("");
  const [completeHR, setCompleteHR] = useState("130");
  const [completeCalories, setCompleteCalories] = useState("");

  // Strength tracking states
  const [isTrackingStrength, setIsTrackingStrength] = useState(false);
  const [strengthWorkoutData, setStrengthWorkoutData] = useState<any | null>(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [expandedEditExerciseId, setExpandedEditExerciseId] = useState<string | null>(null);
  const [infoExerciseId, setInfoExerciseId] = useState<string | null>(null);
  const [activeExerciseIdx, setActiveExerciseIdx] = useState<number>(0);

  useEffect(() => {
    setActiveExerciseIdx(0);
  }, [isTrackingStrength]);

  useEffect(() => {
    if (selectedWorkout && selectedWorkout.description) {
      const desc = selectedWorkout.description.trim();
      if (desc.startsWith("{")) {
        try {
          const parsed = JSON.parse(desc);
          if (parsed.isStrength) {
            setStrengthWorkoutData(parsed);
            return;
          }
        } catch (e) {}
      }
    }
    setStrengthWorkoutData(null);
    setIsTrackingStrength(false);
    setRestSeconds(0);
    setExpandedEditExerciseId(null);
    setInfoExerciseId(null);
  }, [selectedWorkout]);

  useEffect(() => {
    let interval: any = null;
    if (restSeconds > 0) {
      interval = setInterval(() => {
        setRestSeconds((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [restSeconds]);

  // Load upcoming 7 days planned workouts
  const loadWeekPlan = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's latest weight for MET calorie estimation
      const { data: weightData } = await supabase
        .from("body_measurements")
        .select("value")
        .eq("user_id", user.id)
        .eq("metric", "weight")
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (weightData?.value) {
        setUserWeight(Number(weightData.value));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      let queryResult = await supabase
        .from("planned_workouts")
        .select("id, date, activity_type, title, duration_minutes, intensity, status, description")
        .eq("user_id", user.id)
        .gte("date", today.toISOString().split("T")[0])
        .lte("date", nextWeek.toISOString().split("T")[0])
        .order("date", { ascending: true });

      let data: any[] | null = queryResult.data;
      let error = queryResult.error;

      // Fallback if description column doesn't exist yet
      if (error && error.message.includes("column planned_workouts.description does not exist")) {
        const fallbackResult = await supabase
          .from("planned_workouts")
          .select("id, date, activity_type, title, duration_minutes, intensity, status")
          .eq("user_id", user.id)
          .gte("date", today.toISOString().split("T")[0])
          .lte("date", nextWeek.toISOString().split("T")[0])
          .order("date", { ascending: true });
        
        if (fallbackResult.error) throw fallbackResult.error;
        data = fallbackResult.data;
        error = null;
      } else if (error) {
        throw error;
      }

      const formatted = (data || []).map((w: any) => ({
        id: w.id,
        date: w.date,
        activityType: w.activity_type,
        title: w.title,
        durationMinutes: Number(w.duration_minutes),
        intensity: w.intensity,
        status: w.status,
        description: w.description || "",
      }));
      setWorkouts(formatted);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeekPlan();
  }, []);

  // Trigger adaptive planning engine
  const handleAdaptPlan = async () => {
    setAdapting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/planning/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      if (data.proposals && data.proposals.length > 0) {
        setMessage(`Suunnitelmaa mukautettu: ${data.proposals.map((p: any) => p.workoutTitle).join(", ")} kevennetty.`);
        loadWeekPlan();
      } else {
        setMessage("Tämänhetkinen palautumistilasi on hyvä. Harjoitussuunnitelma pidetään ennallaan.");
      }
    } catch (err: any) {
      alert(err.message || "Mukautus epäonnistui.");
    } finally {
      setAdapting(false);
    }
  };

  // Add a new workout
  const handleAddWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("planned_workouts")
        .insert({
          user_id: user.id,
          date: newDate,
          activity_type: newType,
          title: newTitle,
          duration_minutes: newDuration,
          intensity: newIntensity,
          status: "planned",
        });

      if (error) throw error;

      // Reset form
      setNewTitle("");
      setNewDate("");
      setShowAddForm(false);
      loadWeekPlan();
    } catch (err: any) {
      alert(err.message || "Lisääminen epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  // Delete planned workout
  const handleDeleteWorkout = async (id: string) => {
    if (!confirm("Haluatko poistaa tämän harjoituksen?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("planned_workouts").delete().eq("id", id);
      if (error) throw error;
      loadWeekPlan();
    } catch (err: any) {
      alert(err.message || "Poisto epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  // Get week date objects
  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        dateStr: d.toISOString().split("T")[0],
        dayName: d.toLocaleDateString("fi-FI", { weekday: "short" }),
        dayNum: d.getDate(),
        monthStr: d.toLocaleDateString("fi-FI", { month: "short" }),
      });
    }
    return dates;
  };

  const weekDates = getWeekDates();

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <CalendarRange className="w-3.5 h-3.5" />
            Treenisuunnitelma
          </span>
          <h2 className="text-3xl font-bold tracking-tight font-heading">
            Tulevat harjoitukset
          </h2>
        </div>

        {/* Adaptive action trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAdaptPlan}
            disabled={adapting}
            className="py-3 px-5 rounded-2xl bg-gradient-to-r from-primary to-indigo-500 text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center gap-1.5 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            {adapting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mukautetaan...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Mukauta suunnitelma
              </>
            )}
          </button>
        </div>
      </div>

      {/* Adaptive proposal status message */}
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{message}</span>
          <button
            onClick={() => {
              setMessage(null);
              // In later phase we will call undo API
            }}
            className="flex items-center gap-1 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
            Kumoa
          </button>
        </div>
      )}

      {/* Grid: 7 days calendar cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {weekDates.map((day) => {
          // Find workouts matching this date
          const dayWorkouts = workouts.filter((w) => w.date === day.dateStr);

          return (
            <div
              key={day.dateStr}
              className={`rounded-2xl border p-5 flex flex-col gap-4 min-h-[160px] ${
                day.dayNum === new Date().getDate()
                  ? "glass-panel border-primary/50 relative shadow-lg shadow-primary/5"
                  : "glass-panel border-border/40"
              }`}
            >
              {/* Day info header */}
              <div className="flex items-baseline justify-between border-b border-border/20 pb-2">
                <span className="capitalize font-bold text-sm tracking-wide text-foreground">
                  {day.dayName}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {day.dayNum} {day.monthStr}
                </span>
              </div>

              {/* Day workouts body */}
              <div className="flex-1 flex flex-col gap-3 justify-center">
                {dayWorkouts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center italic py-4">Lepopäivä</p>
                ) : (
                  dayWorkouts.map((workout) => (
                    <div
                      key={workout.id}
                      onClick={() => setSelectedWorkout(workout)}
                      className={`p-3 rounded-xl border flex flex-col gap-2 relative group cursor-pointer transition-all text-left ${
                        workout.status === "completed"
                          ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                          : (workout.status === "cancelled" || workout.status === "skipped"
                            ? "bg-red-500/5 border-red-500/10 opacity-60 hover:opacity-90 hover:bg-red-500/10"
                            : "bg-secondary/30 border-border/20 hover:bg-secondary/50 hover:border-primary/40")
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkout(workout.id);
                        }}
                        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-1 z-10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className={`flex items-center gap-1.5 ${
                        workout.status === "completed" 
                          ? "text-emerald-400" 
                          : (workout.status === "cancelled" || workout.status === "skipped" ? "text-red-400/80" : "text-primary")
                      }`}>
                        <Dumbbell className="w-4 h-4 shrink-0" />
                        <span className={`font-semibold text-xs line-clamp-1 ${
                          workout.status === "completed" 
                            ? "line-through decoration-emerald-500/30" 
                            : (workout.status === "cancelled" || workout.status === "skipped" ? "line-through decoration-red-500/30 text-muted-foreground" : "")
                        }`}>{workout.title}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {workout.durationMinutes} min
                        </span>
                        <span className={`capitalize ${
                          workout.status === "completed" 
                            ? "text-emerald-500/80" 
                            : (workout.status === "cancelled" || workout.status === "skipped" ? "text-red-500/80" : "text-indigo-400")
                        }`}>
                          {workout.status === "cancelled" ? "Peruttu" : (workout.status === "skipped" ? "Ohitettu" : workout.intensity)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add workout floating builder */}
      <div className="mt-4">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="py-3 px-5 rounded-2xl glass-panel hover:bg-secondary/40 border border-border/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4 text-primary" />
          Suunnittele uusi harjoitus
        </button>

        {showAddForm && (
          <form onSubmit={handleAddWorkout} className="mt-4 p-6 rounded-3xl glass-panel border border-border/40 max-w-lg flex flex-col gap-4 animate-fade-in">
            <h3 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground">Uusi harjoitus</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nimi</label>
                <input
                  type="text"
                  required
                  placeholder="Esim. Peruskestävyysjuoksu"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl p-2.5 text-sm outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Päivämäärä</label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl p-2.5 text-sm outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Laji</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl p-2.5 text-sm outline-none"
                >
                  <option value="Juoksu">Juoksu</option>
                  <option value="Kuntosali">Kuntosali</option>
                  <option value="Pyöräily">Pyöräily</option>
                  <option value="Uinti">Uinti</option>
                  <option value="Kävely">Kävely</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Kesto (min)</label>
                <input
                  type="number"
                  min="5"
                  max="400"
                  value={newDuration}
                  onChange={(e) => setNewDuration(parseInt(e.target.value) || 45)}
                  className="bg-secondary/40 border border-border/40 rounded-xl p-2.5 text-sm outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Tehotaso</label>
                <select
                  value={newIntensity}
                  onChange={(e) => setNewIntensity(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl p-2.5 text-sm outline-none"
                >
                  <option value="recovery">Palauttava (Recovery)</option>
                  <option value="easy">Kevyt (Easy)</option>
                  <option value="moderate">Peruskestävyys (Moderate)</option>
                  <option value="hard">Vauhtikestävyys (Hard)</option>
                  <option value="very_hard">Maksimaalinen (Very Hard)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground font-semibold">Arvioitu kulutus</label>
                <div className="bg-primary/10 border border-primary/20 text-primary font-bold text-sm rounded-xl p-3 text-center">
                  {estimateWorkoutCalories(newType, newDuration, newIntensity, userWeight)} kcal
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
            >
              Lisää kalenteriin
            </button>
          </form>
        )}
      </div>

      {/* Workout Detail Modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl glass-panel border border-border/40 p-6 shadow-2xl relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary">
                  {selectedWorkout.activityType} &bull; {selectedWorkout.intensity}
                </span>
                <h3 className="font-heading font-bold text-xl text-foreground mt-1">
                  {selectedWorkout.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedWorkout(null);
                  setIsCompleting(false);
                  setIsTrackingStrength(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 bg-secondary/30 rounded-lg cursor-pointer"
              >
                Sulje
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-3 gap-4 bg-secondary/20 p-4 rounded-2xl border border-border/20 text-xs text-left">
              <div>
                <span className="text-muted-foreground block mb-0.5">Päivämäärä</span>
                <span className="font-bold text-foreground">
                  {new Date(selectedWorkout.date).toLocaleDateString("fi-FI", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Kesto</span>
                <span className="font-bold text-foreground">{selectedWorkout.durationMinutes} min</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Arvioitu kulutus</span>
                <span className="font-bold text-primary">
                  {estimateWorkoutCalories(
                    selectedWorkout.activityType,
                    selectedWorkout.durationMinutes,
                    selectedWorkout.intensity,
                    userWeight
                  )} kcal
                </span>
              </div>
            </div>

            {/* AITOFIT STYLE STRENGTH WORKOUT VIEW */}
            {strengthWorkoutData ? (
              <div className="flex flex-col gap-4 text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Treeniohjelma</h4>
                
                {/* Desktop view: scroll list of all exercises */}
                <div className="hidden md:flex flex-col gap-4 max-h-[45vh] overflow-y-auto pr-1">
                  {/* WARMUP SECTION */}
                  {strengthWorkoutData.warmup && (
                    <div className="bg-secondary/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-2.5 relative text-left">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                        <h5 className="font-heading font-black text-sm text-foreground">
                          {strengthWorkoutData.warmup.name || "Alkulämmittely"}
                        </h5>
                        <span className="text-[10px] text-muted-foreground font-semibold">({strengthWorkoutData.warmup.durationMinutes || 10} min)</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                        {strengthWorkoutData.warmup.purpose || "Valmistelee kehon ja kohdelihakset tulevaan treeniin."}
                      </p>
                      
                      <div className="flex flex-col gap-2 mt-1">
                        {strengthWorkoutData.warmup.exercises?.map((we: any, weIdx: number) => (
                          <div key={weIdx} className="flex gap-2.5 items-start p-2.5 bg-secondary/15 rounded-xl border border-border/10 text-xs">
                            <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {weIdx + 1}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-foreground">
                                {we.name} {we.sets && we.reps ? `— ${we.sets} x ${we.reps}` : ""}
                              </span>
                              <span className="text-[10px] text-muted-foreground leading-relaxed">{we.instructions}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {strengthWorkoutData.exercises.map((ex: any, exIdx: number) => (
                    <div key={exIdx} className="bg-secondary/15 border border-border/20 rounded-2xl p-4 flex flex-col gap-2 relative">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold">
                            {exIdx + 1}
                          </div>
                          <h5 className="font-bold text-sm text-foreground">{ex.name}</h5>
                          <button
                            onClick={() => setInfoExerciseId(infoExerciseId === ex.name ? null : ex.name)}
                            className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {isTrackingStrength && (
                          <button
                            onClick={() => setExpandedEditExerciseId(expandedEditExerciseId === ex.name ? null : ex.name)}
                            className="text-[10px] text-muted-foreground hover:text-foreground font-semibold px-2 py-0.5 bg-secondary/35 rounded cursor-pointer transition-colors"
                          >
                            {expandedEditExerciseId === ex.name ? "Sulje" : "Muokkaa"}
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-muted-foreground font-semibold">
                        {ex.targetSets} sarjaa x {ex.targetReps} toistoa
                      </p>

                      {/* Info Text */}
                      {infoExerciseId === ex.name && (
                        <div className="p-3 bg-primary/10 border border-primary/20 text-[11px] leading-relaxed text-primary rounded-xl mt-1 animate-fade-in font-medium">
                          {ex.instruction || "Suorita liike hallitulla tekniikalla ja hyvällä lihastuntumalla."}
                        </div>
                      )}

                      {/* AITOFIT PILL ROWS */}
                      <div className="flex gap-2 overflow-x-auto pb-1 mt-1 no-scrollbar">
                        {ex.sets.map((s: any, sIdx: number) => {
                          const hasWeight = s.suggestedWeight !== null && s.suggestedWeight !== undefined;
                          const displayWeight = s.actualWeight !== null ? s.actualWeight : s.suggestedWeight;
                          const displayReps = s.actualReps !== null ? s.actualReps : ex.targetReps;
                          const isDone = s.completed;

                          return (
                            <button
                              key={sIdx}
                              disabled={!isTrackingStrength}
                              onClick={() => {
                                const updated = { ...strengthWorkoutData };
                                const setObj = updated.exercises[exIdx].sets[sIdx];
                                if (setObj.completed) {
                                  setObj.completed = false;
                                  setObj.actualReps = null;
                                  setObj.actualWeight = null;
                                } else {
                                  setObj.completed = true;
                                  setObj.actualWeight = s.suggestedWeight !== undefined ? s.suggestedWeight : null;
                                  const repsStr = String(ex.targetReps);
                                  const parts = repsStr.split("-");
                                  setObj.actualReps = parseInt(parts[parts.length - 1]) || 10;
                                  setRestSeconds(60); // 60s Rest timer starts!
                                }
                                setStrengthWorkoutData(updated);
                              }}
                              className={`flex flex-col items-center justify-center w-12 h-14 rounded-2xl shrink-0 transition-all font-bold text-xs border cursor-pointer ${
                                isDone
                                  ? "bg-emerald-500 text-white border-emerald-600 font-extrabold scale-105 shadow-md shadow-emerald-500/20"
                                  : isTrackingStrength
                                  ? "bg-zinc-800 text-zinc-100 border-zinc-700/40 hover:bg-zinc-700"
                                  : "bg-zinc-800/80 text-zinc-400 border-zinc-700/20"
                              }`}
                            >
                              {hasWeight ? (
                                <>
                                  <span className="text-[10px] opacity-80">{displayWeight}kg</span>
                                  <span className="text-[13px] mt-0.5">{displayReps}</span>
                                </>
                              ) : (
                                <span className="text-[13px]">{displayReps}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* INLINE EDIT INPUTS */}
                      {isTrackingStrength && expandedEditExerciseId === ex.name && (
                        <div className="flex flex-col gap-2 mt-2 p-3 bg-secondary/35 border border-border/20 rounded-xl animate-fade-in text-[11px] text-left">
                          <div className="grid grid-cols-3 gap-2 font-bold text-muted-foreground mb-1">
                            <span>Sarja</span>
                            <span>Paino (kg)</span>
                            <span>Toistot</span>
                          </div>
                          {ex.sets.map((s: any, sIdx: number) => (
                            <div key={sIdx} className="grid grid-cols-3 gap-2 items-center">
                              <span className="font-semibold text-muted-foreground">Sarja {s.setNum}</span>
                              <input
                                type="number"
                                step="0.5"
                                placeholder={String(s.suggestedWeight || 0)}
                                value={s.actualWeight !== null ? s.actualWeight : ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                  const updated = { ...strengthWorkoutData };
                                  updated.exercises[exIdx].sets[sIdx].actualWeight = val;
                                  if (val !== null && !updated.exercises[exIdx].sets[sIdx].completed) {
                                    updated.exercises[exIdx].sets[sIdx].completed = true;
                                    const repsStr = String(ex.targetReps);
                                    const parts = repsStr.split("-");
                                    updated.exercises[exIdx].sets[sIdx].actualReps = parseInt(parts[parts.length - 1]) || 10;
                                  }
                                  setStrengthWorkoutData(updated);
                                }}
                                className="bg-secondary/40 border border-border/40 rounded-lg p-1 text-center text-foreground outline-none font-bold"
                              />
                              <input
                                type="number"
                                placeholder={String(ex.targetReps)}
                                value={s.actualReps !== null ? s.actualReps : ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value);
                                  const updated = { ...strengthWorkoutData };
                                  updated.exercises[exIdx].sets[sIdx].actualReps = val;
                                  if (val !== null && !updated.exercises[exIdx].sets[sIdx].completed) {
                                    updated.exercises[exIdx].sets[sIdx].completed = true;
                                  }
                                  setStrengthWorkoutData(updated);
                                }}
                                className="bg-secondary/40 border border-border/40 rounded-lg p-1 text-center text-foreground outline-none font-bold"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Mobile Stepper view: show one active exercise at a time */}
                {isTrackingStrength ? (
                  <div className="md:hidden flex flex-col gap-4 max-h-[52vh] overflow-y-auto pr-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground bg-secondary/20 p-2.5 rounded-xl border border-border/10">
                      <span>LIIKE {activeExerciseIdx + 1} / {strengthWorkoutData.exercises.length}</span>
                      <span className="text-primary truncate max-w-[60%]">{strengthWorkoutData.exercises[activeExerciseIdx]?.name}</span>
                    </div>

                    {strengthWorkoutData.exercises[activeExerciseIdx] && (() => {
                      const ex = strengthWorkoutData.exercises[activeExerciseIdx];
                      const exIdx = activeExerciseIdx;
                      return (
                        <div className="bg-secondary/15 border border-border/20 rounded-2xl p-4 flex flex-col gap-3 relative animate-fade-in text-left">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5 pr-6">
                              <h5 className="font-bold text-sm text-foreground">{ex.name}</h5>
                              <button
                                type="button"
                                onClick={() => setInfoExerciseId(infoExerciseId === ex.name ? null : ex.name)}
                                className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedEditExerciseId(expandedEditExerciseId === ex.name ? null : ex.name)}
                              className="text-[10px] text-muted-foreground hover:text-foreground font-semibold px-2 py-0.5 bg-secondary/35 rounded cursor-pointer transition-colors"
                            >
                              {expandedEditExerciseId === ex.name ? "Sulje" : "Muokkaa"}
                            </button>
                          </div>

                          <p className="text-[10px] text-muted-foreground font-semibold">
                            Tavoite: {ex.targetSets} sarjaa x {ex.targetReps} toistoa
                          </p>

                          {infoExerciseId === ex.name && (
                            <div className="p-3 bg-primary/10 border border-primary/20 text-[11px] leading-relaxed text-primary rounded-xl mt-1 animate-fade-in font-medium">
                              {ex.instruction || "Suorita liike hallitulla tekniikalla ja hyvällä lihastuntumalla."}
                            </div>
                          )}

                          {/* Set pills */}
                          <div className="flex gap-2 overflow-x-auto pb-1 mt-1 no-scrollbar">
                            {ex.sets.map((s: any, sIdx: number) => {
                              const hasWeight = s.suggestedWeight !== null && s.suggestedWeight !== undefined;
                              const displayWeight = s.actualWeight !== null ? s.actualWeight : s.suggestedWeight;
                              const displayReps = s.actualReps !== null ? s.actualReps : ex.targetReps;
                              const isDone = s.completed;

                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...strengthWorkoutData };
                                    const setObj = updated.exercises[exIdx].sets[sIdx];
                                    if (setObj.completed) {
                                      setObj.completed = false;
                                      setObj.actualReps = null;
                                      setObj.actualWeight = null;
                                    } else {
                                      setObj.completed = true;
                                      setObj.actualWeight = s.suggestedWeight !== undefined ? s.suggestedWeight : null;
                                      const repsStr = String(ex.targetReps);
                                      const parts = repsStr.split("-");
                                      setObj.actualReps = parseInt(parts[parts.length - 1]) || 10;
                                      setRestSeconds(60);
                                    }
                                    setStrengthWorkoutData(updated);
                                  }}
                                  className={`flex flex-col items-center justify-center w-12 h-14 rounded-2xl shrink-0 transition-all font-bold text-xs border cursor-pointer ${
                                    isDone
                                      ? "bg-emerald-500 text-white border-emerald-600 font-extrabold scale-105 shadow-md shadow-emerald-500/20"
                                      : "bg-zinc-800 text-zinc-100 border-zinc-700/40 hover:bg-zinc-700"
                                  }`}
                                >
                                  {hasWeight ? (
                                    <>
                                      <span className="text-[10px] opacity-80">{displayWeight}kg</span>
                                      <span className="text-[13px] mt-0.5">{displayReps}</span>
                                    </>
                                  ) : (
                                    <span className="text-[13px]">{displayReps}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {expandedEditExerciseId === ex.name && (
                            <div className="flex flex-col gap-2 mt-2 p-3 bg-secondary/35 border border-border/20 rounded-xl animate-fade-in text-[11px] text-left">
                              <div className="grid grid-cols-3 gap-2 font-bold text-muted-foreground mb-1">
                                <span>Sarja</span>
                                <span>Paino (kg)</span>
                                <span>Toistot</span>
                              </div>
                              {ex.sets.map((s: any, sIdx: number) => (
                                <div key={sIdx} className="grid grid-cols-3 gap-2 items-center">
                                  <span className="font-semibold text-muted-foreground">Sarja {s.setNum}</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    placeholder={String(s.suggestedWeight || 0)}
                                    value={s.actualWeight !== null ? s.actualWeight : ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                      const updated = { ...strengthWorkoutData };
                                      updated.exercises[exIdx].sets[sIdx].actualWeight = val;
                                      if (val !== null && !updated.exercises[exIdx].sets[sIdx].completed) {
                                        updated.exercises[exIdx].sets[sIdx].completed = true;
                                        const repsStr = String(ex.targetReps);
                                        const parts = repsStr.split("-");
                                        updated.exercises[exIdx].sets[sIdx].actualReps = parseInt(parts[parts.length - 1]) || 10;
                                      }
                                      setStrengthWorkoutData(updated);
                                    }}
                                    className="bg-secondary/40 border border-border/40 rounded-lg p-1 text-center text-foreground outline-none font-bold"
                                  />
                                  <input
                                    type="number"
                                    placeholder={String(ex.targetReps)}
                                    value={s.actualReps !== null ? s.actualReps : ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? null : parseInt(e.target.value);
                                      const updated = { ...strengthWorkoutData };
                                      updated.exercises[exIdx].sets[sIdx].actualReps = val;
                                      if (val !== null && !updated.exercises[exIdx].sets[sIdx].completed) {
                                        updated.exercises[exIdx].sets[sIdx].completed = true;
                                      }
                                      setStrengthWorkoutData(updated);
                                    }}
                                    className="bg-secondary/40 border border-border/40 rounded-lg p-1 text-center text-foreground outline-none font-bold"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Stepper controls */}
                    <div className="flex gap-3 justify-between mt-1">
                      <button
                        type="button"
                        disabled={activeExerciseIdx === 0}
                        onClick={() => setActiveExerciseIdx(prev => prev - 1)}
                        className="flex-1 py-3 bg-secondary hover:bg-secondary/80 text-muted-foreground font-semibold rounded-xl text-xs disabled:opacity-30"
                      >
                        &larr; Edellinen liike
                      </button>
                      <button
                        type="button"
                        disabled={activeExerciseIdx === strengthWorkoutData.exercises.length - 1}
                        onClick={() => setActiveExerciseIdx(prev => prev + 1)}
                        className="flex-1 py-3 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded-xl text-xs disabled:opacity-30"
                      >
                        Seuraava liike &rarr;
                      </button>
                    </div>
                  </div>
                ) : (
                  // If not tracking strength yet but on mobile, show standard warmup + brief overview
                  <div className="md:hidden flex flex-col gap-4 max-h-[45vh] overflow-y-auto pr-1">
                    {/* WARMUP SECTION */}
                    {strengthWorkoutData.warmup && (
                      <div className="bg-secondary/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-2.5 relative text-left">
                        <div className="flex items-center gap-2">
                          <Timer className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                          <h5 className="font-heading font-black text-sm text-foreground">
                            {strengthWorkoutData.warmup.name || "Alkulämmittely"}
                          </h5>
                          <span className="text-[10px] text-muted-foreground font-semibold">({strengthWorkoutData.warmup.durationMinutes || 10} min)</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                          {strengthWorkoutData.warmup.purpose || "Valmistelee kehon ja kohdelihakset tulevaan treeniin."}
                        </p>
                      </div>
                    )}
                    <div className="p-4 bg-secondary/15 rounded-xl border border-border/20 text-center">
                      <p className="text-xs text-muted-foreground font-bold">Harjoituksessa on {strengthWorkoutData.exercises.length} kuntosaliliikettä.</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Aloita harjoitus seurataksesi ja kuitataksesi liikkeet vaiheittain.</p>
                    </div>
                  </div>
                )}

                {/* Rest Timer Floating Bar */}
                {restSeconds > 0 && (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/25 rounded-2xl p-3 text-xs text-primary font-bold animate-pulse mt-2">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 animate-spin-slow" />
                      <span>Lepoaika: {Math.floor(restSeconds / 60)}:{(restSeconds % 60).toString().padStart(2, "0")}</span>
                    </div>
                    <button
                      onClick={() => setRestSeconds(0)}
                      className="text-[10px] bg-primary/20 hover:bg-primary/30 px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      Ohita
                    </button>
                  </div>
                )}

                {/* Actions */}
                {selectedWorkout.status === "completed" ? (
                  <div className="flex items-center justify-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold text-xs mt-2 w-full">
                    <CheckCircle className="w-4.5 h-4.5" />
                    <span>Harjoitus on suoritettu!</span>
                  </div>
                ) : !isTrackingStrength ? (
                  <div className="flex gap-3 justify-end border-t border-border/20 pt-4">
                    <button
                      onClick={() => setIsTrackingStrength(true)}
                      className="w-full py-3 rounded-xl bg-white text-black font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-white/10"
                    >
                      Aloita treeni &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-end border-t border-border/20 pt-4">
                    <button
                      onClick={() => setIsTrackingStrength(false)}
                      className="py-2.5 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Peruuta
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) throw new Error("Käyttäjä ei ole kirjautunut sisään.");

                          // Mark as completed in strength workout data JSON
                          const finalData = { ...strengthWorkoutData };
                          
                          // 1. Mark planned workout as completed and save JSON description
                          const { error: updateError } = await supabase
                            .from("planned_workouts")
                            .update({ 
                              status: "completed",
                              description: JSON.stringify(finalData)
                            })
                            .eq("id", selectedWorkout.id);
                          if (updateError) throw updateError;

                          // 2. Estimate calories
                          const caloriesBurned = estimateWorkoutCalories(
                            selectedWorkout.activityType,
                            selectedWorkout.durationMinutes,
                            selectedWorkout.intensity,
                            userWeight
                          );

                          // 3. Insert manual activity
                          const { error: activityError } = await supabase
                            .from("activities")
                            .insert({
                              user_id: user.id,
                              provider: "manual",
                              activity_type: selectedWorkout.activityType,
                              started_at: new Date(selectedWorkout.date + 'T17:30:00Z').toISOString(),
                              duration_seconds: selectedWorkout.durationMinutes * 60,
                              calories_kcal: caloriesBurned,
                              average_heart_rate: 130,
                              perceived_exertion: 6,
                            });
                          
                          if (activityError) throw activityError;

                          setSelectedWorkout(null);
                          setIsTrackingStrength(false);
                          loadWeekPlan();
                        } catch (err: any) {
                          alert("Tallenus epäonnistui: " + err.message);
                        }
                      }}
                      className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Tallenna treeni
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // STANDARD CARDIO WORKOUT INSTRUCTIONS VIEW
              <>
                {/* Instructions */}
                <div className="flex flex-col gap-2 text-left">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Treeniohje & Sisältö</h4>
                  <div className="p-4 rounded-2xl bg-secondary/30 border border-border/30 text-xs leading-relaxed text-foreground whitespace-pre-line min-h-[120px]">
                    {selectedWorkout.description ? (
                      selectedWorkout.description
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-4 gap-3">
                        <p className="text-muted-foreground font-medium">Tälle harjoitukselle ei ole vielä luotu yksityiskohtaista suoritusohjetta.</p>
                        <button
                          onClick={async () => {
                            try {
                              setSelectedWorkout(prev => prev ? { ...prev, description: "Generoidaan ohjeita..." } : null);
                              const res = await fetch("/api/planning/generate-instructions", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ workoutId: selectedWorkout.id }),
                              });
                              const data = await res.json();
                              if (data.description) {
                                setSelectedWorkout(prev => prev ? { ...prev, description: data.description } : null);
                                loadWeekPlan();
                              } else {
                                throw new Error(data.error);
                              }
                            } catch (err: any) {
                              alert("Ohjeiden luonti epäonnistui: " + err.message);
                            }
                          }}
                          className="py-2 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-[11px] hover:opacity-90 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Luo ohjeet tekoälyllä
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Complete action */}
                {selectedWorkout.status === "completed" ? (
                  <div className="flex items-center justify-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold text-xs mt-2 w-full animate-fade-in">
                    <CheckCircle className="w-4.5 h-4.5" />
                    <span>Harjoitus on suoritettu!</span>
                  </div>
                ) : isCompleting ? (
                  <div className="flex flex-col gap-4 border-t border-border/20 pt-4 text-left animate-fade-in">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kirjaa treenin suoritustiedot</h4>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="text-muted-foreground">Kesto (min)</label>
                        <input
                          type="number"
                          value={completeDuration}
                          onChange={(e) => {
                            const newDur = parseInt(e.target.value) || 0;
                            setCompleteDuration(e.target.value);
                            const newKcal = estimateWorkoutCalories(
                              selectedWorkout.activityType,
                              newDur,
                              selectedWorkout.intensity,
                              userWeight
                            );
                            setCompleteCalories(String(newKcal));
                          }}
                          className="bg-secondary/40 border border-border/40 rounded-xl p-2 text-center text-foreground font-semibold outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-muted-foreground">Keskisyke (bpm)</label>
                        <input
                          type="number"
                          value={completeHR}
                          onChange={(e) => setCompleteHR(e.target.value)}
                          className="bg-secondary/40 border border-border/40 rounded-xl p-2 text-center text-foreground font-semibold outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-muted-foreground">Kulutus (kcal)</label>
                        <input
                          type="number"
                          value={completeCalories}
                          onChange={(e) => setCompleteCalories(e.target.value)}
                          className="bg-secondary/40 border border-border/40 rounded-xl p-2 text-center text-foreground font-semibold outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setIsCompleting(false)}
                        className="py-2 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Peruuta
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const durationMin = parseInt(completeDuration) || selectedWorkout.durationMinutes;
                            const caloriesBurned = parseInt(completeCalories) || 0;
                            const avgHR = parseInt(completeHR) || 130;
                            
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) throw new Error("Käyttäjä ei ole kirjautunut sisään.");

                            // 1. Mark planned workout as completed
                            const { error: updateError } = await supabase
                              .from("planned_workouts")
                              .update({ status: "completed" })
                              .eq("id", selectedWorkout.id);
                            if (updateError) throw updateError;

                            // 2. Insert manual activity
                            const { error: activityError } = await supabase
                              .from("activities")
                              .insert({
                                user_id: user.id,
                                provider: "manual",
                                activity_type: selectedWorkout.activityType,
                                started_at: new Date(selectedWorkout.date + 'T17:30:00Z').toISOString(),
                                duration_seconds: durationMin * 60,
                                calories_kcal: caloriesBurned,
                                average_heart_rate: avgHR,
                                perceived_exertion: selectedWorkout.intensity === "easy" || selectedWorkout.intensity === "recovery" ? 3 : selectedWorkout.intensity === "moderate" ? 5 : 7,
                              });
                            
                            if (activityError) throw activityError;

                            setSelectedWorkout(null);
                            setIsCompleting(false);
                            loadWeekPlan();
                          } catch (err: any) {
                            alert("Tallennus epäonnistui: " + err.message);
                          }
                        }}
                        className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Tallenna suoritus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 justify-end border-t border-border/20 pt-4">
                    <button
                      onClick={() => {
                        setCompleteDuration(String(selectedWorkout.durationMinutes));
                        setCompleteHR("130");
                        const estimatedKcal = estimateWorkoutCalories(
                          selectedWorkout.activityType,
                          selectedWorkout.durationMinutes,
                          selectedWorkout.intensity,
                          userWeight
                        );
                        setCompleteCalories(String(estimatedKcal));
                        setIsCompleting(true);
                      }}
                      className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Merkitse tehdyksi
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
