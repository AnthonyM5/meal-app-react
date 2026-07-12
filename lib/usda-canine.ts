// Canine-relevant nutrient extraction from USDA FoodData Central responses.
//
// Every nutrient ID below was verified against live FDC data on 2026-07-06
// (fixture: __tests__/fixtures/usda-chicken-liver-171060.json, fdcId 171060,
// plus Foundation egg foods for iodine). The amino-acid/B-vitamin IDs added
// 2026-07-08 were verified against a live 8-food format=full sample (chicken
// breast/liver, beef, salmon, egg, spinach, broccoli, sweet potato — all raw)
// covering meats, organs, and produce; every ID below was present in all 8.
// Do not add IDs from memory — fetch a food with format=full and observe
// nutrient.id first.
//
// KNOWN LIMITATION: taurine is not reported in FDC Foundation/SR Legacy/
// Branded responses we probed, so it is deliberately absent here. Taurine
// values come from the seed data / a future curated table (handoff §3.3);
// imported ingredients keep taurine_mg = 0 and is_verified = false.

import { checkDogSafety } from '@/lib/dog-toxic-foods'

/** Verified FDC nutrient IDs (see header). Amounts are per 100 g. */
export const USDA_CANINE_NUTRIENT_IDS = {
  ENERGY_KCAL: 1008, // Energy (kcal)
  PROTEIN: 1003, // Protein (g)
  CARBS: 1005, // Carbohydrate, by difference (g)
  FAT: 1004, // Total lipid (fat) (g)
  FIBER: 1079, // Fiber, total dietary (g)
  SUGAR: 2000, // Total Sugars (g)
  CHOLESTEROL: 1253, // Cholesterol (mg)
  CALCIUM: 1087, // Calcium, Ca (mg)
  IRON: 1089, // Iron, Fe (mg)
  MAGNESIUM: 1090, // Magnesium, Mg (mg) — NB: 1090 is NOT methionine
  PHOSPHORUS: 1091, // Phosphorus, P (mg)
  POTASSIUM: 1092, // Potassium, K (mg)
  SODIUM: 1093, // Sodium, Na (mg)
  ZINC: 1095, // Zinc, Zn (mg)
  COPPER: 1098, // Copper, Cu (mg)
  IODINE: 1100, // Iodine, I (µg) — observed in Foundation egg foods
  MANGANESE: 1101, // Manganese, Mn (mg)
  SELENIUM: 1103, // Selenium, Se (µg)
  VITAMIN_A_RAE: 1106, // Vitamin A, RAE (µg)
  VITAMIN_E: 1109, // Vitamin E (alpha-tocopherol) (mg)
  VITAMIN_D_IU: 1110, // Vitamin D (D2 + D3), International Units (IU)
  VITAMIN_D_MCG: 1114, // Vitamin D (D2 + D3) (µg) — fallback, ×40 → IU
  VITAMIN_C: 1162, // Vitamin C (mg)
  FOLATE_TOTAL: 1177, // Folate, total (µg)
  VITAMIN_B12: 1178, // Vitamin B-12 (µg)
  CHOLINE: 1180, // Choline, total (mg)
  TRYPTOPHAN: 1210, // Tryptophan (g)
  THREONINE: 1211, // Threonine (g)
  ISOLEUCINE: 1212, // Isoleucine (g)
  LEUCINE: 1213, // Leucine (g)
  LYSINE: 1214, // Lysine (g)
  METHIONINE: 1215, // Methionine (g)
  CYSTINE: 1216, // Cystine (g)
  PHENYLALANINE: 1217, // Phenylalanine (g)
  TYROSINE: 1218, // Tyrosine (g)
  VALINE: 1219, // Valine (g)
  ARGININE: 1220, // Arginine (g)
  HISTIDINE: 1221, // Histidine (g)
  THIAMIN: 1165, // Thiamin (Vitamin B1) (mg)
  RIBOFLAVIN: 1166, // Riboflavin (Vitamin B2) (mg)
  NIACIN: 1167, // Niacin (mg)
  PANTOTHENIC_ACID: 1170, // Pantothenic acid (mg)
  VITAMIN_B6: 1175, // Vitamin B-6 (mg)
  PUFA_EPA: 1278, // PUFA 20:5 n-3 (EPA) (g)
  PUFA_DHA: 1272, // PUFA 22:6 n-3 (DHA) (g)
  PUFA_LA: 1316, // PUFA 18:2 n-6 c,c — linoleic acid (g)
  PUFA_18_2: 1269, // PUFA 18:2 (g) — LA fallback when n-6 split absent
} as const

/**
 * A nutrient entry in either FDC response shape:
 *  - search results:  { nutrientId, nutrientName, value, unitName }
 *  - format=full:     { nutrient: { id, name, unitName }, amount }
 */
export interface USDANutrientEntry {
  nutrientId?: number
  nutrientName?: string
  value?: number
  amount?: number
  nutrient?: { id?: number; name?: string; unitName?: string }
}

export interface USDAFoodLike {
  fdcId: number
  description: string
  brandOwner?: string
  brandName?: string
  foodNutrients: USDANutrientEntry[]
}

function buildAmountMap(entries: USDANutrientEntry[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const entry of entries) {
    const id = entry.nutrientId ?? entry.nutrient?.id
    const amount = entry.value ?? entry.amount
    if (id != null && amount != null && !map.has(id)) {
      map.set(id, amount)
    }
  }
  return map
}

export interface CanineIngredientNutrients {
  calories_per_serving: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
  cholesterol_mg: number
  calcium_mg: number
  iron_mg: number
  magnesium_mg: number
  phosphorus_mg: number
  potassium_mg: number
  sodium_mg: number
  zinc_mg: number
  copper_mg: number
  manganese_mg: number
  selenium_mcg: number
  iodine_mcg: number
  vitamin_a_mcg: number
  vitamin_c_mg: number
  vitamin_d_iu: number
  vitamin_e_mg: number
  vitamin_b12_mcg: number
  folate_mcg: number
  choline_mg: number
  thiamin_mg: number
  riboflavin_mg: number
  niacin_mg: number
  pantothenic_acid_mg: number
  vitamin_b6_mg: number
  omega3_epa_dha_mg: number
  omega6_la_mg: number
  methionine_cystine_mg: number
  lysine_mg: number
  tryptophan_mg: number
  threonine_mg: number
  isoleucine_mg: number
  leucine_mg: number
  valine_mg: number
  arginine_mg: number
  histidine_mg: number
  phenylalanine_tyrosine_mg: number
}

/**
 * Extract the full canine nutrient set (per 100 g) from FDC foodNutrients.
 * Handles both the search-result and format=full response shapes.
 */
export function extractCanineNutrients(
  foodNutrients: USDANutrientEntry[]
): CanineIngredientNutrients {
  const ids = USDA_CANINE_NUTRIENT_IDS
  const amounts = buildAmountMap(foodNutrients)
  const get = (id: number) => amounts.get(id) ?? 0

  // Vitamin D: prefer the direct IU nutrient, else convert µg (1 µg = 40 IU)
  const vitaminDIu =
    amounts.get(ids.VITAMIN_D_IU) ?? get(ids.VITAMIN_D_MCG) * 40

  // Linoleic acid: prefer the explicit n-6 isomer, else total 18:2
  const linoleicG = amounts.get(ids.PUFA_LA) ?? get(ids.PUFA_18_2)

  return {
    calories_per_serving: get(ids.ENERGY_KCAL),
    protein_g: get(ids.PROTEIN),
    carbs_g: get(ids.CARBS),
    fat_g: get(ids.FAT),
    fiber_g: get(ids.FIBER),
    sugar_g: get(ids.SUGAR),
    cholesterol_mg: get(ids.CHOLESTEROL),
    calcium_mg: get(ids.CALCIUM),
    iron_mg: get(ids.IRON),
    magnesium_mg: get(ids.MAGNESIUM),
    phosphorus_mg: get(ids.PHOSPHORUS),
    potassium_mg: get(ids.POTASSIUM),
    sodium_mg: get(ids.SODIUM),
    zinc_mg: get(ids.ZINC),
    copper_mg: get(ids.COPPER),
    manganese_mg: get(ids.MANGANESE),
    selenium_mcg: get(ids.SELENIUM),
    iodine_mcg: get(ids.IODINE),
    vitamin_a_mcg: get(ids.VITAMIN_A_RAE),
    vitamin_c_mg: get(ids.VITAMIN_C),
    vitamin_d_iu: vitaminDIu,
    vitamin_e_mg: get(ids.VITAMIN_E),
    vitamin_b12_mcg: get(ids.VITAMIN_B12),
    folate_mcg: get(ids.FOLATE_TOTAL),
    choline_mg: get(ids.CHOLINE),
    thiamin_mg: get(ids.THIAMIN),
    riboflavin_mg: get(ids.RIBOFLAVIN),
    niacin_mg: get(ids.NIACIN),
    pantothenic_acid_mg: get(ids.PANTOTHENIC_ACID),
    vitamin_b6_mg: get(ids.VITAMIN_B6),
    // grams → mg for fatty acids and amino acids
    omega3_epa_dha_mg: (get(ids.PUFA_EPA) + get(ids.PUFA_DHA)) * 1000,
    omega6_la_mg: linoleicG * 1000,
    methionine_cystine_mg: (get(ids.METHIONINE) + get(ids.CYSTINE)) * 1000,
    lysine_mg: get(ids.LYSINE) * 1000,
    tryptophan_mg: get(ids.TRYPTOPHAN) * 1000,
    threonine_mg: get(ids.THREONINE) * 1000,
    isoleucine_mg: get(ids.ISOLEUCINE) * 1000,
    leucine_mg: get(ids.LEUCINE) * 1000,
    valine_mg: get(ids.VALINE) * 1000,
    arginine_mg: get(ids.ARGININE) * 1000,
    histidine_mg: get(ids.HISTIDINE) * 1000,
    phenylalanine_tyrosine_mg:
      (get(ids.PHENYLALANINE) + get(ids.TYROSINE)) * 1000,
  }
}

/** Count how many distinct tracked nutrients had actual FDC data. */
export function countExtractedNutrients(
  foodNutrients: USDANutrientEntry[]
): number {
  const amounts = buildAmountMap(foodNutrients)
  return Object.values(USDA_CANINE_NUTRIENT_IDS).filter(id =>
    amounts.has(id)
  ).length
}

// Cooking-method words as they appear in FDC descriptions. 'raw' is matched
// as a whole word so e.g. "strawberries" doesn't false-positive. 'uncooked'
// (FDC's dry-grain wording, e.g. "Quinoa, uncooked") counts as raw and must
// be tested before COOKED_PATTERN, which would substring-match it. 'dried'
// is deliberately excluded — dried fruit is not a raw fresh-feeding form.
const COOKED_PATTERN =
  /cooked|roasted|stewed|fried|boiled|grilled|baked|braised|poached|steamed|rotisserie|hard-boiled|scrambled/i
const RAW_PATTERN = /\b(raw|uncooked)\b/i

/**
 * Infer raw/cooked from a USDA description. Nutrient values always describe
 * the food as analyzed (as fed) — this label only lets both variants coexist
 * and be told apart in search; no conversion math is ever applied.
 */
export function inferPreparationState(
  description: string
): 'raw' | 'cooked' | null {
  // Check raw first: the explicit whole-word "raw" is the stronger signal
  if (RAW_PATTERN.test(description)) return 'raw'
  if (COOKED_PATTERN.test(description)) return 'cooked'
  return null
}

/**
 * Convert a USDA food into a `foods` (Ingredient) row, per 100 g, with the
 * dog-safety pass applied. Taurine/amino coverage in FDC is incomplete, so
 * imports are marked is_verified = false when the profile is sparse — the
 * UI shows those as "incomplete profile".
 */
export function convertUSDAToIngredient(usdaFood: USDAFoodLike) {
  const nutrients = extractCanineNutrients(usdaFood.foodNutrients)
  const safety = checkDogSafety(usdaFood.description)
  // Foundation/SR Legacy foods report 21+ of our 48 tracked nutrients (same
  // ~44% bar as before the 2026-07-08 amino-acid/B-vitamin expansion); below
  // that the profile is too sparse to trust for gap math.
  const isComplete = countExtractedNutrients(usdaFood.foodNutrients) >= 21

  return {
    fdc_id: usdaFood.fdcId,
    name: usdaFood.description,
    brand: usdaFood.brandOwner || usdaFood.brandName || 'USDA',
    serving_size: 100,
    serving_unit: 'g',
    ...nutrients,
    is_safe_for_dogs: safety.isSafe,
    toxicity_note: safety.note,
    preparation_state: inferPreparationState(usdaFood.description),
    is_verified: isComplete,
  }
}
