"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  Undo2,
  CheckCircle,
  Camera,
  X,
  FileSpreadsheet,
  Paperclip,
  Dumbbell,
  TrendingUp,
  Utensils,
} from "lucide-react";
import React from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Message = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: any;
  imageBase64?: string;
  csvFileName?: string;
  csvContent?: string;
};

// Safe regex-based markdown parser
export const MarkdownText = ({ text }: { text: string }) => {
  if (!text) return null;
  const paragraphs = text.split("\n\n");
  return (
    <div className="flex flex-col gap-2">
      {paragraphs.map((p, pIdx) => {
        let cleanText = p.trim();
        if (!cleanText) return null;
        if (cleanText.startsWith("## ")) {
          return (
            <h4 key={pIdx} className="font-heading font-black text-sm text-foreground mt-3 mb-1 border-b border-border/10 pb-0.5">
              {cleanText.replace("## ", "")}
            </h4>
          );
        }
        if (cleanText.startsWith("# ")) {
          return (
            <h3 key={pIdx} className="font-heading font-black text-base text-foreground mt-4 mb-2">
              {cleanText.replace("# ", "")}
            </h3>
          );
        }
        if (cleanText.startsWith("- ") || cleanText.startsWith("* ")) {
          const items = cleanText.split(/\n[-*]\s+/);
          if (items[0].startsWith("- ") || items[0].startsWith("* ")) {
            items[0] = items[0].substring(2);
          }
          return (
            <ul key={pIdx} className="list-disc pl-5 flex flex-col gap-1.5 text-xs text-muted-foreground my-1">
              {items.map((item, iIdx) => (
                <li key={iIdx}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        if (/^\d+\.\s+/.test(cleanText)) {
          const items = cleanText.split(/\n\d+\.\s+/);
          if (/^\d+\.\s+/.test(items[0])) {
            items[0] = items[0].replace(/^\d+\.\s+/, "");
          }
          return (
            <ol key={pIdx} className="list-decimal pl-5 flex flex-col gap-1.5 text-xs text-muted-foreground my-1">
              {items.map((item, iIdx) => (
                <li key={iIdx}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }
        const lines = cleanText.split("\n");
        return (
          <p key={pIdx} className="text-xs text-muted-foreground leading-relaxed my-0.5">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInlineMarkdown(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

function renderInlineMarkdown(line: string) {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let keyCounter = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^([^\*]*)\*\*([^\*]+)\*\*(.*)$/);
    if (boldMatch) {
      const [_, before, boldText, after] = boldMatch;
      if (before) parts.push(<span key={keyCounter++}>{before}</span>);
      parts.push(<strong key={keyCounter++} className="font-bold text-foreground">{boldText}</strong>);
      remaining = after;
      continue;
    }
    const codeMatch = remaining.match(/^([^`]*)`([^`]+)`(.*)$/);
    if (codeMatch) {
      const [_, before, codeText, after] = codeMatch;
      if (before) parts.push(<span key={keyCounter++}>{before}</span>);
      parts.push(
        <code key={keyCounter++} className="bg-secondary/40 border border-border/20 px-1 py-0.5 rounded text-[10px] font-mono text-primary">
          {codeText}
        </code>
      );
      remaining = after;
      continue;
    }
    parts.push(<span key={keyCounter++}>{remaining}</span>);
    break;
  }
  return parts;
}

// Clean and parse structured JSON message
const parseJsonMessage = (content: string) => {
  let clean = content.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(json)?\n/, "");
    clean = clean.replace(/\n```$/, "");
    clean = clean.trim();
  }
  try {
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === "object" && parsed.type) {
      return parsed;
    }
  } catch (e) {}
  return null;
};

// Database action handlers
const handleAddToShoppingList = async (recipe: any, servings: number, supabase: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Kirjaudu sisään lisätäksesi kauppalistalle.");
      return;
    }
    const now = new Date();
    const distanceToMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now.getTime() - distanceToMonday * 24 * 60 * 60 * 1000);
    const start = monday.toISOString().split("T")[0];
    const end = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    const { data: existingList } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("user_id", user.id)
      .eq("start_date", start)
      .eq("end_date", end)
      .maybeSingle();
      
    let items: any[] = [];
    if (existingList && Array.isArray(existingList.items)) {
      items = [...existingList.items];
    }
    
    const servingsRatio = servings / (recipe.servings?.default || 1);
    const recipeIngredients = recipe.ingredients || [];
    recipeIngredients.forEach((group: any) => {
      const groupItems = group.items || [];
      groupItems.forEach((item: any) => {
        const key = item.name.toLowerCase().trim();
        const scaledAmt = item.amount ? item.amount * servingsRatio : 0;
        const existing = items.find(i => i.name.toLowerCase().trim() === key);
        if (existing) {
          existing.amount = Number((existing.amount + scaledAmt).toFixed(1));
        } else {
          items.push({
            name: item.name,
            amount: Number(scaledAmt.toFixed(1)),
            unit: item.unit || "g",
            category: group.group || "Muut"
          });
        }
      });
    });
    
    const { error } = await supabase
      .from("shopping_lists")
      .upsert({
        user_id: user.id,
        start_date: start,
        end_date: end,
        items,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,start_date,end_date" });
      
    if (error) throw error;
    alert("Reseptin ainekset lisätty kauppalistalle!");
  } catch (err: any) {
    console.error(err);
    alert("Kauppalistalle lisääminen epäonnistui: " + err.message);
  }
};

const handleSaveFavorite = async (recipe: any, supabase: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Kirjaudu sisään tallentaaksesi suosikin.");
      return;
    }
    const { error } = await supabase
      .from("recipe_interactions")
      .upsert({
        user_id: user.id,
        recipe_id: recipe.id || recipe.title,
        is_favorite: true,
        favorite_frequency: "weekly",
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,recipe_id" });
      
    if (error) throw error;
    alert("Resepti tallennettu suosikiksi!");
  } catch (err: any) {
    console.error(err);
    alert("Suosikin tallentaminen epäonnistui: " + err.message);
  }
};

const handleAddToMealPlan = async (recipe: any, servings: number, supabase: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: dbPlan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", user.id)
      .lte("start_date", todayStr)
      .gte("end_date", todayStr)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (!dbPlan) {
      alert("Aktiivista ruoka-ohjelmaa ei löytynyt tälle päivälle.");
      return;
    }
    const { data: day } = await supabase
      .from("meal_plan_days")
      .select("id")
      .eq("plan_id", dbPlan.id)
      .eq("date", todayStr)
      .maybeSingle();
      
    if (!day) {
      alert("Tämän päivän suunnitelmapohjaa ei löytynyt.");
      return;
    }
    const nutrients = recipe.nutrition_per_user_serving || {};
    const servingsRatio = servings / (recipe.servings?.default || 1);
    const snapshotIngredients: any[] = [];
    const recipeIngredients = recipe.ingredients || [];
    recipeIngredients.forEach((group: any) => {
      const groupItems = group.items || [];
      groupItems.forEach((item: any) => {
        snapshotIngredients.push({
          name: item.name,
          amount: item.amount ? item.amount * servingsRatio : 0,
          unit: item.unit || "g",
          category: group.group || "Muut"
        });
      });
    });
    
    const { error } = await supabase
      .from("planned_meals")
      .insert({
        day_id: day.id,
        meal_type: recipe.meal_type || "dinner",
        recipe_name: recipe.title,
        is_locked: true,
        portion_size_factor: servingsRatio,
        household_servings: servings,
        calories: Math.round((nutrients.calories || 400) * servingsRatio),
        protein: Math.round((nutrients.protein_g || 20) * servingsRatio),
        carbs: Math.round((nutrients.carbs_g || 40) * servingsRatio),
        fat: Math.round((nutrients.fat_g || 10) * servingsRatio),
        ingredients_snapshot: snapshotIngredients,
        created_at: new Date().toISOString()
      });
      
    if (error) throw error;
    alert("Resepti lisätty tämän päivän ruoka-ohjelmaan!");
  } catch (err: any) {
    console.error(err);
    alert("Ruoka-ohjelmaan lisääminen epäonnistui: " + err.message);
  }
};

// Component Views
const WorkoutPlanCard = ({ plan }: { plan: any }) => {
  return (
    <div className="rounded-2xl border border-primary/20 bg-secondary/5 p-4 flex flex-col gap-3 text-left w-full max-w-md my-1.5">
      <div className="flex items-center gap-2 border-b border-border/20 pb-2">
        <Dumbbell className="w-4 h-4 text-primary" />
        <div>
          <h4 className="font-heading font-black text-xs text-foreground">{plan.title}</h4>
          {plan.description && <p className="text-[9px] text-muted-foreground">{plan.description}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {plan.exercises?.map((ex: any, idx: number) => (
          <div key={idx} className="flex flex-col p-2.5 bg-secondary/15 rounded-xl border border-border/10 text-[11px] gap-0.5">
            <div className="flex justify-between font-semibold">
              <span className="text-foreground">{ex.name}</span>
              <span className="text-primary">{ex.sets} x {ex.reps} {ex.weight ? `(${ex.weight})` : ""}</span>
            </div>
            {ex.instructions && <p className="text-[9px] text-muted-foreground leading-normal mt-0.5">{ex.instructions}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsSummaryCard = ({ summary }: { summary: any }) => {
  return (
    <div className="rounded-2xl border border-primary/20 bg-secondary/5 p-4 flex flex-col gap-3 text-left w-full max-w-md my-1.5">
      <div className="flex items-center gap-2 border-b border-border/20 pb-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h4 className="font-heading font-black text-xs text-foreground">{summary.title || "Analytiikan yhteenveto"}</h4>
      </div>
      {summary.summary && <p className="text-[11px] text-muted-foreground leading-normal">{summary.summary}</p>}
      <div className="grid grid-cols-2 gap-2 mt-1">
        {summary.kpis?.map((kpi: any, idx: number) => (
          <div key={idx} className="p-2 bg-secondary/15 rounded-xl border border-border/10 text-center text-[11px]">
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
            <p className="text-xs font-black mt-0.5 text-primary">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const StructuredAdviceCard = ({ advice }: { advice: any }) => {
  return (
    <div className="rounded-2xl border border-primary/20 bg-secondary/5 p-4 flex flex-col gap-3 text-left w-full max-w-md my-1.5">
      <div className="flex items-center gap-2 border-b border-border/20 pb-2">
        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
        <h4 className="font-heading font-black text-xs text-foreground">Suositukset</h4>
      </div>
      {advice.summary && <div className="text-[11px] text-foreground font-semibold leading-normal">{advice.summary}</div>}
      {advice.meaning && (
        <div className="flex flex-col gap-0.5 text-[11px]">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Mitä tämä tarkoittaa</span>
          <p className="text-muted-foreground leading-normal">{advice.meaning}</p>
        </div>
      )}
      {advice.recommendation && (
        <div className="flex flex-col gap-0.5 text-[11px]">
          <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">Suositus</span>
          <p className="text-muted-foreground leading-normal">{advice.recommendation}</p>
        </div>
      )}
      {advice.next_step && (
        <div className="flex flex-col gap-0.5 text-[11px] border-t border-border/10 pt-1.5 mt-0.5">
          <span className="text-[8px] font-bold text-primary uppercase tracking-wider">Seuraava askel</span>
          <p className="text-muted-foreground leading-normal font-medium">{advice.next_step}</p>
        </div>
      )}
    </div>
  );
};

const RecipeCard = ({
  recipe,
  index,
  servingsMap,
  setServingsMap,
  supabase,
  onActionClick
}: {
  recipe: any;
  index: number;
  servingsMap: any;
  setServingsMap: any;
  supabase: any;
  onActionClick: (text: string) => void;
}) => {
  const [showModifications, setShowModifications] = useState(false);
  const servings = servingsMap[index] || recipe.servings?.default || 1;
  const defaultServings = recipe.servings?.default || 1;
  const ratio = servings / defaultServings;
  const nutrients = recipe.nutrition_per_user_serving || {};

  const handleAddShopping = () => {
    handleAddToShoppingList(recipe, servings, supabase);
  };
  const handleSaveFav = () => {
    handleSaveFavorite(recipe, supabase);
  };
  const handleAddPlan = () => {
    handleAddToMealPlan(recipe, servings, supabase);
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-secondary/5 p-4 flex flex-col gap-3 text-left w-full max-w-md my-1.5 shadow-md">
      <div className="flex flex-col gap-1 border-b border-border/20 pb-2">
        <div className="flex items-center justify-between">
          <h4 className="font-heading font-black text-sm text-foreground flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-primary" />
            {recipe.title}
          </h4>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
            Resepti
          </span>
        </div>
        {recipe.description && <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">{recipe.description}</p>}
        {recipe.why_it_fits && (
          <div className="flex gap-1.5 items-start bg-primary/5 border border-primary/10 rounded-lg p-2 mt-1">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <p className="text-[9px] text-muted-foreground leading-normal">{recipe.why_it_fits}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between bg-secondary/15 rounded-lg p-2 border border-border/10">
        <span className="text-[11px] font-semibold text-foreground">Annokset:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setServingsMap((prev: any) => ({ ...prev, [index]: Math.max(1, servings - 1) }))}
            className="w-6 h-6 rounded bg-secondary/40 border border-border/20 flex items-center justify-center font-bold text-xs hover:bg-secondary active:scale-95 transition-all cursor-pointer"
          >
            -
          </button>
          <span className="text-[11px] font-bold text-foreground">{servings} kpl</span>
          <button
            onClick={() => setServingsMap((prev: any) => ({ ...prev, [index]: servings + 1 }))}
            className="w-6 h-6 rounded bg-secondary/40 border border-border/20 flex items-center justify-center font-bold text-xs hover:bg-secondary active:scale-95 transition-all cursor-pointer"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
        <div className="p-1.5 bg-secondary/15 rounded-lg border border-border/10">
          <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Kcal</span>
          <p className="text-[11px] font-black mt-0.5 text-primary">
            {nutrients.calories ? Math.round(nutrients.calories * ratio) : "-"}
          </p>
        </div>
        <div className="p-1.5 bg-secondary/15 rounded-lg border border-border/10">
          <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Prot</span>
          <p className="text-[11px] font-black mt-0.5 text-violet-400">
            {nutrients.protein_g ? Math.round(nutrients.protein_g * ratio) : "-"}
          </p>
        </div>
        <div className="p-1.5 bg-secondary/15 rounded-lg border border-border/10">
          <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Hiil</span>
          <p className="text-[11px] font-black mt-0.5 text-indigo-400">
            {nutrients.carbs_g ? Math.round(nutrients.carbs_g * ratio) : "-"}
          </p>
        </div>
        <div className="p-1.5 bg-secondary/15 rounded-lg border border-border/10">
          <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Rasv</span>
          <p className="text-[11px] font-black mt-0.5 text-amber-400">
            {nutrients.fat_g ? Math.round(nutrients.fat_g * ratio) : "-"}
          </p>
        </div>
        <div className="p-1.5 bg-secondary/15 rounded-lg border border-border/10">
          <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Kuit</span>
          <p className="text-[11px] font-black mt-0.5 text-emerald-400">
            {nutrients.fiber_g ? Math.round(nutrients.fiber_g * ratio) : "-"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[11px]">
        <span className="font-bold text-muted-foreground uppercase tracking-wider text-[9px] border-b border-border/10 pb-0.5">
          Ainesosat
        </span>
        <div className="flex flex-col gap-2">
          {recipe.ingredients?.map((group: any, gIdx: number) => (
            <div key={gIdx} className="flex flex-col gap-0.5">
              {group.group && <span className="text-[9px] font-bold text-primary">{group.group}</span>}
              <div className="flex flex-col gap-0.5">
                {group.items?.map((item: any, iIdx: number) => {
                  const scaledAmount = item.amount ? Number((item.amount * ratio).toFixed(1)) : null;
                  return (
                    <div key={iIdx} className="flex justify-between items-center text-[10px] py-1 px-1.5 bg-secondary/10 rounded border border-border/5">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-bold text-foreground">
                        {scaledAmount} {item.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-[11px]">
        <span className="font-bold text-muted-foreground uppercase tracking-wider text-[9px] border-b border-border/10 pb-0.5">
          Valmistusohjeet
        </span>
        <ol className="list-decimal pl-4 flex flex-col gap-1 text-muted-foreground text-[10px]">
          {recipe.instructions?.map((inst: string, idx: number) => (
            <li key={idx} className="leading-normal pl-0.5">{inst}</li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => setShowModifications(prev => !prev)}
          className="text-left text-[10px] font-bold text-primary flex items-center gap-1 py-0.5 hover:bg-secondary/40 w-fit cursor-pointer"
        >
          {showModifications ? "Piilota muunnokset & perheohjeet" : "Näytä muunnokset & perheohjeet..."}
        </button>
        {showModifications && (
          <div className="flex flex-col gap-2 p-2 bg-secondary/10 border border-border/10 rounded-lg text-[10px] animate-fade-in">
            {recipe.family_notes && (
              <div className="flex flex-col">
                <span className="font-bold text-muted-foreground text-[8px] uppercase tracking-wide">Perheohjeet</span>
                <p className="text-muted-foreground leading-normal">{recipe.family_notes}</p>
              </div>
            )}
            {recipe.lighter_modification && (
              <div className="flex flex-col">
                <span className="font-bold text-emerald-400 text-[8px] uppercase tracking-wide">Kevyempi versio</span>
                <p className="text-muted-foreground leading-normal">{recipe.lighter_modification}</p>
              </div>
            )}
            {recipe.higher_energy_modification && (
              <div className="flex flex-col">
                <span className="font-bold text-amber-400 text-[8px] uppercase tracking-wide">Energiapitoisempi versio</span>
                <p className="text-muted-foreground leading-normal">{recipe.higher_energy_modification}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/15">
        <button
          onClick={handleAddShopping}
          className="flex-1 py-1.5 px-2 rounded-lg bg-primary text-primary-foreground font-bold text-[10px] hover:opacity-90 active:scale-97 transition-all cursor-pointer text-center"
        >
          Lisää kauppalistalle
        </button>
        <button
          onClick={handleSaveFav}
          className="flex-1 py-1.5 px-2 rounded-lg border border-border/30 hover:bg-secondary/40 text-muted-foreground hover:text-foreground font-bold text-[10px] transition-all cursor-pointer text-center"
        >
          Suosikiksi
        </button>
        <button
          onClick={handleAddPlan}
          className="flex-1 py-1.5 px-2 rounded-lg border border-border/30 hover:bg-secondary/40 text-muted-foreground hover:text-foreground font-bold text-[10px] transition-all cursor-pointer text-center"
        >
          Viikkosuunnitelmaan
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 mt-0.5 border-t border-border/10 pt-1.5">
        <button
          onClick={() => onActionClick("Tee kevyempi versio reseptistä: " + recipe.title)}
          className="py-1 px-1 rounded border border-border/10 bg-secondary/5 text-[8px] text-center text-muted-foreground hover:text-foreground cursor-pointer hover:bg-secondary/20 transition-all"
        >
          Kevyempi muunnos
        </button>
        <button
          onClick={() => onActionClick("Tee runsasenergisempi versio reseptistä: " + recipe.title)}
          className="py-1 px-1 rounded border border-border/10 bg-secondary/5 text-[8px] text-center text-muted-foreground hover:text-foreground cursor-pointer hover:bg-secondary/20 transition-all"
        >
          Energiapitoisempi muunnos
        </button>
        <button
          onClick={() => onActionClick("Ehdotatko toista vastaavaa reseptiä tälle: " + recipe.title)}
          className="py-1 px-1 rounded border border-border/10 bg-secondary/5 text-[8px] text-center text-muted-foreground hover:text-foreground cursor-pointer hover:bg-secondary/20 transition-all"
        >
          Vaihda resepti
        </button>
      </div>
    </div>
  );
};

export default function ChatPage() {
  const supabase = supabaseBrowser();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [imagePreviewBase64, setImagePreviewBase64] = useState<string | null>(null);
  const [csvPreviewContent, setCsvPreviewContent] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [servingsMap, setServingsMap] = useState<Record<number, number>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper to parse stored image and CSV contents
  const parseStoredContent = (content: string) => {
    if (content && content.startsWith("IMAGE:")) {
      const splitIdx = content.indexOf("||");
      if (splitIdx !== -1) {
        return {
          image: content.slice(6, splitIdx),
          csvFileName: null,
          csvContent: null,
          text: content.slice(splitIdx + 2)
        };
      }
    }
    if (content && content.startsWith("CSV:")) {
      const firstSplit = content.indexOf("||");
      if (firstSplit !== -1) {
        const fileName = content.slice(4, firstSplit);
        const rest = content.slice(firstSplit + 2);
        const secondSplit = rest.indexOf("||");
        if (secondSplit !== -1) {
          return {
            image: null,
            csvFileName: fileName,
            csvContent: rest.slice(0, secondSplit),
            text: rest.slice(secondSplit + 2)
          };
        }
      }
    }
    return { image: null, csvFileName: null, csvContent: null, text: content };
  };

  // Load or create a default chat thread
  const initChatThread = async () => {
    setInitializing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Look for existing active thread
      const { data: threadData, error: threadError } = await supabase
        .from("chat_threads")
        .select("id, title")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (threadError) throw threadError;

      let activeThreadId = threadData?.id;

      // 2. Create one if not found
      if (!activeThreadId) {
        const { data: newThread, error: createError } = await supabase
          .from("chat_threads")
          .insert({
            user_id: user.id,
            title: "AI Valmentaja keskustelu",
          })
          .select()
          .single();

        if (createError) throw createError;
        activeThreadId = newThread.id;
      }

      setThreadId(activeThreadId);

      // 3. Load thread messages
      const { data: messagesData, error: msgsError } = await supabase
        .from("chat_messages")
        .select("id, role, content, tool_calls")
        .eq("thread_id", activeThreadId)
        .order("created_at", { ascending: true });

      if (msgsError) throw msgsError;

      if (messagesData && messagesData.length > 0) {
        setMessages(
          messagesData.map((m: any) => {
            const parsed = parseStoredContent(m.content);
            return {
              id: m.id,
              role: m.role,
              content: parsed.text,
              toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : null,
              imageBase64: parsed.image || undefined,
              csvFileName: parsed.csvFileName || undefined,
              csvContent: parsed.csvContent || undefined,
            };
          })
        );
      } else {
        // Feed initial coach greeting
        setMessages([
          {
            role: "assistant",
            content: "Moi! Minä olen Fat2Fit AI-valmentaja. Miten voin auttaa sinua tänään? Voit kirjata painosi, kertoa aamun check-inistä tai kysyä ruokailusuosituksia.",
          },
        ]);
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    initChatThread();
  }, []);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !imagePreviewBase64 && !csvPreviewContent) || loading || !threadId) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue.trim(),
      ...(imagePreviewBase64 ? { imageBase64: imagePreviewBase64 } : {}),
      ...(csvPreviewContent ? { csvFileName: csvFileName || "file.csv", csvContent: csvPreviewContent } : {})
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setImagePreviewBase64(null);
    setCsvPreviewContent(null);
    setCsvFileName(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          threadId,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          toolCalls: data.functionCalls,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Pahoittelut, viestin lähetys epäonnistui: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Revert/Undo action triggered in chat
  const handleUndoAction = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages,
            { role: "user", content: "kumoa viimeisin kirjaus" },
          ],
          threadId,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        { role: "user", content: "kumoa viimeisin kirjaus" },
        { role: "assistant", content: data.reply },
      ]);
    } catch (err: any) {
      alert(err.message || "Kumous epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] gap-4 pb-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg">Valmentaja Chat</h2>
            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Aktiivinen seuranta</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto glass-panel border border-border/40 rounded-3xl p-4 md:p-6 flex flex-col gap-4">
        {initializing ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const imageToShow = msg.imageBase64;
            const text = msg.content;
            const structured = isUser ? null : parseJsonMessage(text);

            return (
              <div
                key={index}
                className={`flex flex-col gap-1.5 max-w-[85%] ${
                  isUser ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed flex flex-col gap-2 ${
                    isUser
                      ? "bg-primary text-primary-foreground font-medium rounded-tr-none shadow-md shadow-primary/15"
                      : "glass-panel border-border/40 text-foreground rounded-tl-none"
                  }`}
                >
                  {imageToShow && (
                    <div className="rounded-xl overflow-hidden max-h-48 border border-border/20 bg-black/20 flex items-center justify-center">
                      <img src={imageToShow} alt="Attachment" className="object-contain max-h-44 rounded-lg" />
                    </div>
                  )}
                  {msg.csvFileName && (
                    <div className={`flex items-center gap-2.5 p-3 rounded-xl border max-w-sm ${
                      isUser
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-secondary/40 border-border/30 text-foreground"
                    }`}>
                      <FileSpreadsheet className={`w-5 h-5 shrink-0 ${isUser ? "text-white" : "text-indigo-400"}`} />
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-xs font-semibold truncate ${isUser ? "text-white" : "text-foreground"}`}>
                          {msg.csvFileName}
                        </p>
                        <p className={`text-[9px] ${isUser ? "text-white/80" : "text-muted-foreground"}`}>
                          Liitetty CSV-tiedosto
                        </p>
                      </div>
                    </div>
                  )}
                  {text && (
                    <div>
                      {structured ? (
                        <div className="flex flex-col gap-2">
                          {structured.type === "recipe" && (
                            <RecipeCard
                              recipe={structured}
                              index={index}
                              servingsMap={servingsMap}
                              setServingsMap={setServingsMap}
                              supabase={supabase}
                              onActionClick={(actionText) => {
                                setInputValue(actionText);
                              }}
                            />
                          )}
                          {structured.type === "workout_plan" && (
                            <WorkoutPlanCard plan={structured} />
                          )}
                          {structured.type === "analytics_summary" && (
                            <AnalyticsSummaryCard summary={structured} />
                          )}
                          {structured.type === "structured_advice" && (
                            <StructuredAdviceCard advice={structured} />
                          )}
                        </div>
                      ) : (
                        <MarkdownText text={text} />
                      )}
                    </div>
                  )}
                </div>

                {/* Show tool calling badges if available */}
                {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    {msg.toolCalls.map((call: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>
                          {call.name === "logBodyMeasurement" && `Kirjattu: ${call.args.metric} ${call.args.value}`}
                          {call.name === "logMorningCheckIn" && `Tallennettu aamukirjaus`}
                          {call.name === "undoLastUserAction" && `Peruutus suoritettu`}
                          {call.name === "updateNutritionTargets" && `Päivitetty suositustavoitteet`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading typing indicator */}
        {loading && (
          <div className="mr-auto items-start max-w-[80%] flex items-center gap-2 text-xs text-muted-foreground font-medium glass-panel border-border/40 px-4 py-3 rounded-2xl rounded-tl-none animate-pulse">
            <Sparkles className="w-4 h-4 text-primary animate-spin" />
            AI Coach käsittelee tietoja ja suorittaa kirjauksia...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Preview Block */}
      {imagePreviewBase64 && (
        <div className="px-4 py-2 bg-secondary/25 border border-border/30 rounded-2xl flex items-center justify-between gap-3 w-fit animate-fade-in relative shrink-0">
          <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-border/40 bg-black flex items-center justify-center">
            <img src={imagePreviewBase64} alt="Preview" className="object-cover w-full h-full" />
            <button
              type="button"
              onClick={() => setImagePreviewBase64(null)}
              className="absolute top-1 right-1 p-0.5 rounded bg-black/60 hover:bg-black text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold">Kuva liitetty</span>
        </div>
      )}
      {csvFileName && (
        <div className="px-4 py-2 bg-secondary/25 border border-border/30 rounded-2xl flex items-center justify-between gap-3 w-fit animate-fade-in relative shrink-0">
          <div className="relative w-12 h-12 rounded-lg border border-border/40 bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 animate-pulse" />
            <button
              type="button"
              onClick={() => {
                setCsvPreviewContent(null);
                setCsvFileName(null);
              }}
              className="absolute -top-1 -right-1 p-0.5 rounded bg-black/60 hover:bg-black text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-foreground max-w-[150px] truncate">{csvFileName}</span>
            <span className="text-[9px] text-muted-foreground font-semibold">CSV valmis analysoitavaksi</span>
          </div>
        </div>
      )}

      {/* Typing bar */}
      <form onSubmit={handleSendMessage} className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={handleUndoAction}
          disabled={loading}
          className="p-3 rounded-xl border border-border/40 glass-panel hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          title="Kumoa viimeisin kirjaus"
        >
          <Undo2 className="w-5 h-5" />
        </button>

        {/* Attachment upload button */}
        <div className="relative flex items-center">
          <button
            type="button"
            disabled={loading}
            className="p-3 rounded-xl border border-border/40 glass-panel hover:bg-secondary/40 text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
            title="Liitä kuva tai CSV-tiedosto"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="file"
            accept="image/*,.csv"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              if (file.name.toLowerCase().endsWith(".csv")) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  setCsvPreviewContent(event.target?.result as string);
                  setCsvFileName(file.name);
                };
                reader.readAsText(file);
              } else {
                const reader = new FileReader();
                reader.onloadend = () => {
                  setImagePreviewBase64(reader.result as string);
                };
                reader.readAsDataURL(file);
              }
              // Reset input so upload can trigger again for same file
              e.target.value = "";
            }}
            className="absolute inset-0 opacity-0 cursor-pointer disabled:pointer-events-none"
          />
        </div>
        
        <input
          type="text"
          placeholder="Liitä kuva/CSV tai kirjoita valmentajalle..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 bg-secondary/40 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60"
          disabled={loading}
        />
        
        <button
          type="submit"
          disabled={loading || (!inputValue.trim() && !imagePreviewBase64 && !csvPreviewContent)}
          className="p-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 active:scale-98 transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
