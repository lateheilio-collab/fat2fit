import { describe, it, expect, vi } from "vitest";
import { compileCoachingProfile } from "../src/lib/calculations/coaching";

describe("Coaching Profile Compiling Logic", () => {
  it("should compile a complete 7-part coaching profile from mock database queries", async () => {
    // Mock Supabase client
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain: any = {};
        
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        
        chain.single = vi.fn().mockImplementation(() => {
          if (table === "profiles") {
            return Promise.resolve({ data: { birth_year: 1990, height_cm: 180, gender: "male" } });
          }
          return Promise.resolve({ data: null });
        });
        
        chain.maybeSingle = vi.fn().mockImplementation(() => {
          if (table === "profiles") {
            return Promise.resolve({ data: { birth_year: 1990, height_cm: 180, gender: "male" } });
          }
          if (table === "goals") {
            return Promise.resolve({ data: { id: "g1", primary_objective: "weight_loss", primary_objective_label: "Painonpudotus", target_date: "2026-09-01" } });
          }
          if (table === "goal_versions") {
            return Promise.resolve({ data: { target_weight_kg: 80.0, weekly_exercise_count_target: 3 } });
          }
          return Promise.resolve({ data: null });
        });
        
        // Supporting Promise await directly
        chain.then = vi.fn().mockImplementation((resolve: any) => {
          if (table === "body_measurements") {
            return Promise.resolve(resolve({ data: [{ measured_at: "2026-07-06T00:00:00Z", value: 85.5 }] }));
          }
          return Promise.resolve(resolve({ data: [] }));
        });
        
        return chain;
      })
    };

    const profile = await compileCoachingProfile("user-1", mockSupabase as any);

    expect(profile).toBeDefined();
    // 1. Tavoiteprofiili
    expect(profile.target_profile.primary_objective).toBe("weight_loss");
    expect(profile.target_profile.target_weight).toBe(80.0);
    
    // 2. Kuntoprofiili
    expect(profile.fitness_profile.estimated_fitness_level).toBe("aloittelija");

    // 3. Kuormitusprofiili
    expect(profile.load_profile.load_7d).toBe(0);

    // 4. Ravintoprofiili
    expect(profile.nutrition_profile.estimated_bmr_kcal).toBeGreaterThan(1500);

    // 5. Palautumisprofiili
    expect(profile.recovery_profile.avg_sleep_hours_7d).toBe(7.2);

    // 6. Käyttäytymisprofiili
    expect(profile.behavior_profile.plan_precision_level).toBe("flexible");

    // 7. Rajoiteprofiili
    expect(profile.constraint_profile.available_days).toContain("Tiistai");
  });
});
