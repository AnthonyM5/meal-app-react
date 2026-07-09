# USDA Nutrient Coverage Audit

_Audit-plan AC #1 (`NUTRIENT_API_SOURCING_AND_AUDIT.md` §3.1). Generated 2026-07-08._

Companion machine-readable data: [`usda-nutrient-coverage.json`](./usda-nutrient-coverage.json).

## Method

Pulled `format=full` for a 20-food sample spanning muscle meats, organs, fish, vegetables, and fruit — raw **and** cooked variants — and diffed every `foodNutrients[].nutrient.id` present against the extractor's mapped ID set in `lib/usda-canine.ts` (`USDA_CANINE_NUTRIENT_IDS`).

- **Sample size:** 20 foods (`fdcIds`: 171077, 174030, 171060, 169451, 169449, 175167, 168482, 168462, 171287, 170379, 171477, 171795, 173424, 175168, 170134, 175139, 175159, 170393, 168448, 171711)
- **Distinct nutrient IDs observed:** 145
- **Currently mapped:** 47

## Headline finding

After the 2026-07-08 amino-acid/B-vitamin expansion, **no AAFCO-required canine nutrient present in FDC is being dropped.** Every unmapped field falls into a category that is either already captured, deliberately excluded, or nutritionally irrelevant to dogs — with a single soft candidate (moisture/water) noted below. Nothing lands in "needs review."

## Unmapped nutrients, classified

Every nutrient ID seen in the sample but not extracted, grouped by *why* it's unmapped. Count = how many of the sample foods carried it.

### ⚠️ CANDIDATE — worth adding later (1)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1051 | Water | g | 20 | Water/moisture — enables dry-matter-basis conversions; genuinely useful, not yet needed |

### Handled elsewhere (toxicity name-matcher) (2)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1057 | Caffeine | mg | 20 | Caffeine/theobromine — toxicity markers; handled by dog-toxic-foods name matcher, not nutrient math |
| 1058 | Theobromine | mg | 20 | Caffeine/theobromine — toxicity markers; handled by dog-toxic-foods name matcher, not nutrient math |

### Intentionally excluded — no AAFCO canine requirement (7)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1185 | Vitamin K (phylloquinone) | µg | 20 | Vitamin K — dogs synthesize via gut flora; AAFCO sets no requirement (same as taurine) |
| 1122 | Lycopene | µg | 19 | Carotenoid antioxidant (lycopene / lutein+zeaxanthin); no AAFCO canine requirement |
| 1123 | Lutein + zeaxanthin | µg | 19 | Carotenoid antioxidant (lycopene / lutein+zeaxanthin); no AAFCO canine requirement |
| 1184 | Vitamin K (Dihydrophylloquinone) | µg | 12 | Vitamin K — dogs synthesize via gut flora; AAFCO sets no requirement (same as taurine) |
| 1099 | Fluoride, F | µg | 3 | Fluoride — no AAFCO canine dietary requirement |
| 1283 | Phytosterols | mg | 3 | Phytosterols — plant compound, no canine requirement |
| 1183 | Vitamin K (Menaquinone-4) | µg | 2 | Vitamin K — dogs synthesize via gut flora; AAFCO sets no requirement (same as taurine) |

### Intentionally excluded — non-essential amino acids (7)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1222 | Alanine | g | 19 | Non-essential amino acid; AAFCO sets no canine minimum |
| 1223 | Aspartic acid | g | 19 | Non-essential amino acid; AAFCO sets no canine minimum |
| 1224 | Glutamic acid | g | 19 | Non-essential amino acid; AAFCO sets no canine minimum |
| 1225 | Glycine | g | 19 | Non-essential amino acid; AAFCO sets no canine minimum |
| 1226 | Proline | g | 19 | Non-essential amino acid; AAFCO sets no canine minimum |
| 1227 | Serine | g | 19 | Non-essential amino acid; AAFCO sets no canine minimum |
| 1228 | Hydroxyproline | g | 4 | Non-essential amino acid; AAFCO sets no canine minimum |

### Already captured via a mapped nutrient (16)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1105 | Retinol | µg | 20 | Vitamin A precursor/alt-unit; captured via Vitamin A RAE 1106 (mapped) |
| 1186 | Folic acid | µg | 20 | Folate variant; total folate 1177 is mapped |
| 1187 | Folate, food | µg | 20 | Folate variant; total folate 1177 is mapped |
| 1190 | Folate, DFE | µg | 20 | Folate variant; total folate 1177 is mapped |
| 1104 | Vitamin A, IU | IU | 19 | Vitamin A precursor/alt-unit; captured via Vitamin A RAE 1106 (mapped) |
| 1107 | Carotene, beta | µg | 19 | Vitamin A precursor/alt-unit; captured via Vitamin A RAE 1106 (mapped) |
| 1108 | Carotene, alpha | µg | 19 | Vitamin A precursor/alt-unit; captured via Vitamin A RAE 1106 (mapped) |
| 1120 | Cryptoxanthin, beta | µg | 19 | Vitamin A precursor/alt-unit; captured via Vitamin A RAE 1106 (mapped) |
| 1112 | Vitamin D3 (cholecalciferol) | µg | 11 | Vitamin D component; total vit D (1110/1114) handled in extractor |
| 1010 | Sucrose | g | 7 | Individual carbohydrate; total carbs 1005 + total sugars 2000 mapped |
| 1011 | Glucose | g | 7 | Individual carbohydrate; total carbs 1005 + total sugars 2000 mapped |
| 1012 | Fructose | g | 7 | Individual carbohydrate; total carbs 1005 + total sugars 2000 mapped |
| 1013 | Lactose | g | 7 | Individual carbohydrate; total carbs 1005 + total sugars 2000 mapped |
| 1014 | Maltose | g | 7 | Individual carbohydrate; total carbs 1005 + total sugars 2000 mapped |
| 1075 | Galactose | g | 7 | Individual carbohydrate; total carbs 1005 + total sugars 2000 mapped |
| 1009 | Starch | g | 5 | Individual carbohydrate; total carbs 1005 + total sugars 2000 mapped |

### Already captured (alpha-tocopherol mapped) (7)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1125 | Tocopherol, beta | mg | 13 | Vitamin E isomer; alpha-tocopherol 1109 (the AAFCO form) is mapped |
| 1126 | Tocopherol, gamma | mg | 13 | Vitamin E isomer; alpha-tocopherol 1109 (the AAFCO form) is mapped |
| 1127 | Tocopherol, delta | mg | 13 | Vitamin E isomer; alpha-tocopherol 1109 (the AAFCO form) is mapped |
| 1128 | Tocotrienol, alpha | mg | 13 | Vitamin E isomer; alpha-tocopherol 1109 (the AAFCO form) is mapped |
| 1129 | Tocotrienol, beta | mg | 13 | Vitamin E isomer; alpha-tocopherol 1109 (the AAFCO form) is mapped |
| 1130 | Tocotrienol, gamma | mg | 13 | Vitamin E isomer; alpha-tocopherol 1109 (the AAFCO form) is mapped |
| 1131 | Tocotrienol, delta | mg | 13 | Vitamin E isomer; alpha-tocopherol 1109 (the AAFCO form) is mapped |

### Aggregate fat class — specific essential FAs mapped (6)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1258 | Fatty acids, total saturated | g | 20 | Aggregate fat class; we track the specific essential FAs (EPA/DHA/LA) |
| 1292 | Fatty acids, total monounsaturated | g | 20 | Aggregate fat class; we track the specific essential FAs (EPA/DHA/LA) |
| 1293 | Fatty acids, total polyunsaturated | g | 20 | Aggregate fat class; we track the specific essential FAs (EPA/DHA/LA) |
| 1257 | Fatty acids, total trans | g | 15 | Aggregate fat class; we track the specific essential FAs (EPA/DHA/LA) |
| 1329 | Fatty acids, total trans-monoenoic | g | 5 | Aggregate fat class; we track the specific essential FAs (EPA/DHA/LA) |
| 1331 | Fatty acids, total trans-polyenoic | g | 3 | Aggregate fat class; we track the specific essential FAs (EPA/DHA/LA) |

### Individual fatty-acid chains — only essential FAs relevant (41)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1261 | SFA 8:0 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1262 | SFA 10:0 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1263 | SFA 12:0 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1264 | SFA 14:0 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1265 | SFA 16:0 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1266 | SFA 18:0 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1268 | MUFA 18:1 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1270 | PUFA 18:3 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1271 | PUFA 20:4 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1275 | MUFA 16:1 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1276 | PUFA 18:4 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1277 | MUFA 20:1 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1279 | MUFA 22:1 | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1280 | PUFA 22:5 n-3 (DPA) | g | 20 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1259 | SFA 4:0 | g | 19 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1260 | SFA 6:0 | g | 19 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1267 | SFA 20:0 | g | 13 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1274 | MUFA 14:1 | g | 13 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1299 | SFA 15:0 | g | 13 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1300 | SFA 17:0 | g | 13 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1323 | MUFA 17:1 | g | 12 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1273 | SFA 22:0 | g | 11 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1313 | PUFA 20:2 n-6 c,c | g | 11 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1325 | PUFA 20:3 | g | 11 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1333 | MUFA 15:1 | g | 11 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1321 | PUFA 18:3 n-6 c,c,c | g | 10 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1404 | PUFA 18:3 n-3 c,c,c (ALA) | g | 8 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1301 | SFA 24:0 | g | 7 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1304 | TFA 18:1 t | g | 5 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1303 | TFA 16:1 t | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1305 | TFA 22:1 t | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1306 | TFA 18:2 t not further defined | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1311 | PUFA 18:2 CLAs | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1312 | MUFA 24:1 c | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1314 | MUFA 16:1 c | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1315 | MUFA 18:1 c | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1317 | MUFA 22:1 c | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1405 | PUFA 20:3 n-3 | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1406 | PUFA 20:3 n-6 | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1411 | PUFA 22:4 | g | 3 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |
| 1409 | PUFA 18:3i | g | 1 | Individual fatty-acid chain; only essential EPA/DHA/LA are AAFCO-relevant (mapped) |

### Fortification fields — N/A to fresh whole foods (2)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1242 | Vitamin E, added | mg | 19 | "added" fortification field; irrelevant to whole fresh foods |
| 1246 | Vitamin B-12, added | µg | 19 | "added" fortification field; irrelevant to whole fresh foods |

### USDA roll-up headers — not discrete nutrients (7)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1062 | Energy | kJ | 20 | Energy in kJ — duplicate of kcal (1008, mapped) |
| 2039 | Carbohydrates | g | 20 | USDA summary/roll-up header, not a discrete nutrient |
| 2042 | Amino acids | g | 20 | USDA summary/roll-up header, not a discrete nutrient |
| 2043 | Minerals | mg | 20 | USDA summary/roll-up header, not a discrete nutrient |
| 2044 | Lipids | g | 20 | USDA summary/roll-up header, not a discrete nutrient |
| 2045 | Proximates | g | 20 | USDA summary/roll-up header, not a discrete nutrient |
| 2046 | Vitamins and Other Components | g | 20 | USDA summary/roll-up header, not a discrete nutrient |

### Minor — no canine requirement (2)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1007 | Ash | g | 20 | Ash / betaine — no discrete canine requirement (minerals already mapped individually) |
| 1198 | Betaine | mg | 14 | Ash / betaine — no discrete canine requirement (minerals already mapped individually) |

### Non-nutrient (1)

| id | name | unit | in N/20 | rationale |
|---|---|---|---|---|
| 1018 | Alcohol, ethyl | g | 20 | Alcohol — not relevant to dog food |

## Recommendation

- **No immediate schema change required.** The one genuine candidate is **Water / moisture (1051)** — not a nutrient per se, but it enables dry-matter-basis (DMB) conversions, the standard way veterinary nutrition compares raw vs. cooked foods. A `moisture_g` column would let the app express nutrients on a DMB. Deferred; flagged for a future pass.
- **Caffeine / theobromine (1057/1058)** are handled by the `dog-toxic-foods` name matcher (chocolate/coffee → unsafe), not nutrient math. No action unless we want quantitative toxicity thresholds later.
- **Re-run this audit** whenever `USDA_CANINE_NUTRIENT_IDS` changes, or quarterly when FDC updates (§3.5), to catch newly-added IDs or renamed fields.
