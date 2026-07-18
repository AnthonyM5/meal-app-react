// Foods toxic to dogs, used as a safety pass on every ingredient import.
//
// Citations:
// - ASPCA Animal Poison Control, "People Foods to Avoid Feeding Your Pets"
//   https://www.aspca.org/pet-care/animal-poison-control/people-foods-avoid-feeding-your-pets
// - Merck Veterinary Manual, "Food Hazards" (Cortinovis & Caloni 2016 review)
// - FDA CVM advisories on xylitol (2021) and grape/raisin toxicity
//
// Matching is name-based and intentionally aggressive: a false positive
// (flagging "garlic powder seasoning") is far cheaper than a false negative.

export interface ToxicFoodRule {
  /** Case-insensitive substrings that mark an ingredient as unsafe */
  patterns: string[]
  note: string
}

export const DOG_TOXIC_FOODS: ToxicFoodRule[] = [
  {
    patterns: ['onion', 'shallot', 'scallion'],
    note: 'TOXIC: organosulfoxides cause Heinz-body hemolytic anemia; all forms (raw, cooked, powdered) are dangerous (ASPCA APC)',
  },
  {
    patterns: ['garlic'],
    note: 'TOXIC: more concentrated organosulfoxides than onion; causes hemolytic anemia (ASPCA APC)',
  },
  {
    patterns: ['chive'],
    note: 'TOXIC: allium family — hemolytic anemia risk (ASPCA APC)',
  },
  {
    patterns: ['leek'],
    note: 'TOXIC: allium family — hemolytic anemia risk (ASPCA APC)',
  },
  {
    patterns: ['grape'],
    note: 'TOXIC: acute kidney injury (tartaric acid suspected); no safe dose established (FDA CVM / Merck Vet Manual)',
  },
  {
    patterns: ['raisin', 'sultana', 'currant'],
    note: 'TOXIC: concentrated grape toxicity — acute kidney injury; no safe dose established (FDA CVM)',
  },
  {
    patterns: ['macadamia'],
    note: 'TOXIC: causes weakness, tremors, hyperthermia; mechanism unknown (Merck Vet Manual)',
  },
  {
    patterns: ['chocolate', 'cocoa', 'cacao'],
    note: 'TOXIC: theobromine and caffeine — dogs metabolize theobromine slowly; darker = more dangerous (Merck Vet Manual)',
  },
  {
    patterns: ['xylitol', 'birch sugar'],
    note: 'TOXIC: triggers massive insulin release causing hypoglycemia, then hepatic necrosis; tiny amounts can be fatal (FDA CVM 2021)',
  },
  {
    patterns: ['alcohol', 'beer', 'wine', 'liquor', 'rum', 'vodka', 'whiskey'],
    note: 'TOXIC: ethanol — CNS depression, acidosis; dogs are far more sensitive than humans (ASPCA APC)',
  },
  {
    patterns: ['coffee', 'caffeine', 'espresso'],
    note: 'TOXIC: caffeine — cardiac arrhythmia and CNS stimulation (ASPCA APC)',
  },
  {
    patterns: ['nutmeg'],
    note: 'TOXIC: myristicin — tremors and seizures at seasoning-jar quantities (ASPCA APC)',
  },
  {
    patterns: ['avocado'],
    note: 'CAUTION: persin — mild GI upset in dogs; pit is an obstruction hazard (ASPCA APC)',
  },
]

export interface DogSafetyResult {
  isSafe: boolean
  note: string | null
}

/**
 * Short patterns (≤4 chars) match as whole words with an optional plural,
 * not substrings — "rum" must not flag "Wheat, durum" or "breadcrumbs",
 * "wine" must not flag "swine". Longer patterns keep the aggressive
 * substring behavior so "grape" still catches "grapefruit" and "chocolate"
 * still catches "chocolate chip cookies".
 */
function matches(lowerName: string, pattern: string): boolean {
  if (pattern.length > 4) return lowerName.includes(pattern)
  return new RegExp(`\\b${pattern}s?\\b`).test(lowerName)
}

/** Name-based toxicity check used by the ingredient importer. */
export function checkDogSafety(ingredientName: string): DogSafetyResult {
  const lower = ingredientName.toLowerCase()
  for (const rule of DOG_TOXIC_FOODS) {
    if (rule.patterns.some(p => matches(lower, p))) {
      return { isSafe: false, note: rule.note }
    }
  }
  return { isSafe: true, note: null }
}
