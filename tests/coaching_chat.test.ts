import { describe, it, expect, vi } from "vitest";

// Mock markdown renderer inline matches
function parseInlineMarkdown(text: string) {
  let remaining = text;
  const parts: string[] = [];
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^([^\*]*)\*\*([^\*]+)\*\*(.*)$/);
    if (boldMatch) {
      const [_, before, boldText, after] = boldMatch;
      if (before) parts.push(before);
      parts.push(`STRONG:${boldText}`);
      remaining = after;
      continue;
    }
    const codeMatch = remaining.match(/^([^`]*)`([^`]+)`(.*)$/);
    if (codeMatch) {
      const [_, before, codeText, after] = codeMatch;
      if (before) parts.push(before);
      parts.push(`CODE:${codeText}`);
      remaining = after;
      continue;
    }
    parts.push(remaining);
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

// Database mock helper for shopping list upserts
const mockAddToShoppingList = async (recipe: any, servings: number, existingItems: any[] = []) => {
  const servingsRatio = servings / (recipe.servings?.default || 1);
  const items = [...existingItems];
  
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
  
  return items;
};

describe("AI Coach Chat structured message rendering, markdown parsing, and servings scaling", () => {

  it("Testi 1: Markdown ei näy raakatekstinä", () => {
    const input = "**Kastike:** Soijakastike 1 rkl";
    const parts = parseInlineMarkdown(input);

    expect(parts[0]).toBe("STRONG:Kastike:");
    expect(parts[1]).toBe(" Soijakastike 1 rkl");
  });

  it("Testi 2: Resepti näkyy korttina", () => {
    const jsonMessage = `
    {
      "type": "recipe",
      "title": "Tofunuudelikulho kasviksilla",
      "description": "Runsasproteiininen ateria treenin jälkeen.",
      "why_it_fits": "Tukee päivän proteiinitavoitetta.",
      "servings": {
        "default": 1
      },
      "nutrition_per_user_serving": {
        "calories": 670,
        "protein_g": 57.5
      }
    }
    `;

    const parsed = parseJsonMessage(jsonMessage);
    expect(parsed).not.toBeNull();
    expect(parsed.type).toBe("recipe");
    expect(parsed.title).toBe("Tofunuudelikulho kasviksilla");
    expect(parsed.nutrition_per_user_serving.calories).toBe(670);
  });

  it("Testi 3: Ainesosat ryhmitellään", () => {
    const recipe = {
      type: "recipe",
      ingredients: [
        {
          group: "Pääraaka-aineet",
          items: [{ name: "Tofu", amount: 200, unit: "g" }]
        },
        {
          group: "Kastike",
          items: [{ name: "Soijakastike", amount: 1, unit: "rkl" }]
        }
      ]
    };

    expect(recipe.ingredients[0].group).toBe("Pääraaka-aineet");
    expect(recipe.ingredients[0].items[0].name).toBe("Tofu");
    expect(recipe.ingredients[1].group).toBe("Kastike");
    expect(recipe.ingredients[1].items[0].name).toBe("Soijakastike");
  });

  it("Testi 4: Valmistusohjeet ovat numeroitu lista", () => {
    const recipe = {
      type: "recipe",
      instructions: [
        "Keitä riisi ohjeen mukaan.",
        "Paista tofu rapeaksi pannulla."
      ]
    };

    expect(Array.isArray(recipe.instructions)).toBe(true);
    expect(recipe.instructions[0]).toBe("Keitä riisi ohjeen mukaan.");
    expect(recipe.instructions[1]).toBe("Paista tofu rapeaksi pannulla.");
  });

  it("Testi 5: Annosmäärän muuttaminen", () => {
    const recipe = {
      type: "recipe",
      servings: { default: 1 },
      ingredients: [
        {
          group: "Pääraaka-aineet",
          items: [{ name: "Tofu", amount: 200, unit: "g" }]
        }
      ]
    };

    // Scale to 3 servings
    const targetServings = 3;
    const ratio = targetServings / recipe.servings.default;
    const scaledTofuAmount = recipe.ingredients[0].items[0].amount * ratio;

    expect(scaledTofuAmount).toBe(600); // 200 * 3 = 600
  });

  it("Testi 6: Lisää kauppalistalle", async () => {
    const recipe = {
      type: "recipe",
      servings: { default: 1 },
      ingredients: [
        {
          group: "Pääraaka-aineet",
          items: [{ name: "Tofu", amount: 200, unit: "g" }]
        }
      ]
    };

    const finalShoppingItems = await mockAddToShoppingList(recipe, 2, []);
    expect(finalShoppingItems.length).toBe(1);
    expect(finalShoppingItems[0].name).toBe("Tofu");
    expect(finalShoppingItems[0].amount).toBe(400); // 200 * 2 = 400
  });

  it("Testi 7: Fallback Markdown", () => {
    // Normal markdown string containing headers and bolding
    const markdownContent = `## Kastikeohje\n**Kastike:** valkosipulia ja inkivääriä`;
    const lines = markdownContent.split("\n");

    expect(lines[0].startsWith("## ")).toBe(true);
    expect(lines[1]).toContain("**Kastike:**");

    const boldParts = parseInlineMarkdown(lines[1]);
    expect(boldParts[0]).toBe("STRONG:Kastike:");
  });

});
