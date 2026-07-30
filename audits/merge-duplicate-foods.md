# Merge audit — exact-name duplicates in `foods`

_Generated 2026-07-30 by scripts/025_merge_duplicate_foods.ts (APPLIED)._

51 collisions, 55 redundant rows.

Losers are repointed then soft-deleted (`is_active = false`,
`inactive_reason = 'duplicate_of:<winner-id>'`) — never hard-deleted,
because `meal_items`/`recipe_ingredients` cascade off `foods`.

## beans, snap, green, canned, regular pack, drained solids

- **winner** `6be2f7ab-6a2d-486d-a3aa-cfa3b4abb895` — source=usda type=SR Legacy fdc=169143 verified=true nutrients=41
- loser `c16d972d-afda-4a6e-92d8-a1565a1c0982` — source=usda type=Foundation fdc=321611 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## beans, snap, green, raw

- **winner** `5f3e82ee-db7b-4287-bc45-7611886ba4e7` — source=usda type=SR Legacy fdc=169961 verified=true nutrients=41
- loser `b24fbada-f75a-49e7-ad68-b75009c4a3e5` — source=usda type=Foundation fdc=2346400 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## beef, ground, 80% lean meat / 20% fat, raw

- **winner** `e64f8410-4ca3-4e41-be79-8ee67b47828c` — source=usda type=SR Legacy fdc=174036 verified=true nutrients=41
- loser `831fdeca-cc80-4b5f-b944-72facc477346` — source=usda type=Foundation fdc=2514744 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## beef, ground, 90% lean meat / 10% fat, raw

- **winner** `865aed79-c91f-47fd-bf93-248781b5ad2b` — source=usda type=- fdc=174030 verified=true nutrients=43
- loser `5b56dfb0-2c52-48c9-9b06-13b827c79798` — source=usda type=Foundation fdc=2514743 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## beet greens, raw

- **winner** `27bd3a61-314b-48c1-aff6-71f560215b04` — source=usda type=SR Legacy fdc=170375 verified=true nutrients=41
- loser `1ffc6161-787a-4992-a4c4-cdf69d8abfe6` — source=usda type=Foundation fdc=2747653 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## beets, raw

- **winner** `a84cb808-bcfd-4061-a1ae-f8b7e796b29f` — source=usda type=SR Legacy fdc=169145 verified=true nutrients=41
- loser `70b28dc7-0c30-4745-af76-5249ec857a57` — source=usda type=Foundation fdc=2685576 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## blackberries, raw

- **winner** `0d4e80c9-ed3e-4d3a-98d4-8183c38b0876` — source=usda type=SR Legacy fdc=173946 verified=true nutrients=41
- loser `ba62434f-9958-4d83-9ef8-53b981d46eaf` — source=usda type=Foundation fdc=2727581 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## blueberries, raw

- **winner** `58b422d9-15e9-4c20-8849-8f3f45bcc9e0` — source=usda type=SR Legacy fdc=171711 verified=true nutrients=41
- loser `3d4cca57-eb1c-40ba-b577-0a50861eda6f` — source=curated type=- fdc=- verified=true nutrients=43 refs=0 meal_items / 0 recipe_ingredients
  - backfilled onto winner from loser: vitamin_d_mcg, taurine_mg
- loser `0103cf6e-e2d7-4aab-a1ba-c929c56d6122` — source=usda type=Foundation fdc=2346411 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## broccoli, raw

- **winner** `aa650a4e-3c36-4423-9373-887380eb753e` — source=usda type=SR Legacy fdc=170379 verified=true nutrients=41
- loser `58590b3c-e87f-4403-983b-9676765e372a` — source=curated type=- fdc=- verified=true nutrients=43 refs=1 meal_items / 0 recipe_ingredients
  - backfilled onto winner from loser: vitamin_d_mcg, taurine_mg

## brussels sprouts, raw

- **winner** `b92be9d9-da39-4f3e-82d9-0cb04c059436` — source=usda type=SR Legacy fdc=170383 verified=true nutrients=41
- loser `bb61b06e-1fa1-4d69-a59d-a24ebbdad9f1` — source=usda type=Foundation fdc=2685575 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## cabbage, red, raw

- **winner** `39aa6f49-569a-41ec-bcd6-01a36aaccd9a` — source=usda type=SR Legacy fdc=169977 verified=true nutrients=41
- loser `8fc13dac-0694-471f-b02a-1ad92994c0dc` — source=usda type=Foundation fdc=2346408 verified=false nutrients=41 refs=1 meal_items / 0 recipe_ingredients

## carrots, baby, raw

- **winner** `7ef8c0c8-893f-4779-b58f-0f5acb247a34` — source=usda type=SR Legacy fdc=168568 verified=true nutrients=41
- loser `1be28a9c-b7b5-4a64-b237-b2ce2150ce54` — source=usda type=Foundation fdc=2258587 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## cauliflower, raw

- **winner** `1fb80c09-487f-4bf3-8772-12559ac6839b` — source=usda type=SR Legacy fdc=169986 verified=true nutrients=41
- loser `c8855adc-d3e0-4edd-90d3-5efbf1f7424d` — source=usda type=Foundation fdc=2685573 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## celery, raw

- **winner** `c77cb4fc-0b87-44e4-bbb0-60be33740d48` — source=usda type=SR Legacy fdc=169988 verified=true nutrients=41
- loser `8242307e-345c-4f7e-b196-ce85620d6041` — source=usda type=Foundation fdc=2346405 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised

- **winner** `b1afbd58-815a-4ef6-99c3-ff5facb2f9b3` — source=usda type=Foundation fdc=331960 verified=true nutrients=41
- loser `da6c2ad1-781a-4ddc-8569-936d577f6a8f` — source=usda type=SR Legacy fdc=171140 verified=true nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## collards, raw

- **winner** `f3be30bd-13df-435c-aa14-f4a1cbd6270f` — source=usda type=SR Legacy fdc=170406 verified=true nutrients=41
- loser `891eae20-b8ed-4df5-9967-e973f851be2d` — source=usda type=Foundation fdc=2685574 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## cucumber, with peel, raw

- **winner** `185e0f0f-d82e-4624-871b-db2d6339dce4` — source=usda type=SR Legacy fdc=168409 verified=true nutrients=41
- loser `a3f1736c-5031-451e-ab46-6b44c3e67366` — source=usda type=Foundation fdc=2346406 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## edamame, frozen, prepared

- **winner** `e7f0d0c7-4077-4240-b0db-7acda86c329e` — source=usda type=SR Legacy fdc=168411 verified=true nutrients=41
- loser `131b9a0e-f5d5-4433-b288-b69ace2da055` — source=usda type=Foundation fdc=2758981 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## egg, white, dried

- **winner** `01dc0fc4-f7f5-4554-9a5f-4f94e243fedc` — source=usda type=SR Legacy fdc=172204 verified=true nutrients=41
- loser `60b1262e-559e-4b26-be22-8816978e0e4c` — source=usda type=Foundation fdc=323793 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## egg, white, raw, frozen, pasteurized

- **winner** `28d73ef0-bf63-4d17-83a9-7a1044715a55` — source=usda type=SR Legacy fdc=172203 verified=true nutrients=41
- loser `fa4a13fd-d3b8-4473-b00d-b8b7fe4369f7` — source=usda type=Foundation fdc=323697 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## eggplant, raw

- **winner** `f2eafc29-26fd-4038-ae8b-8f1cdf4629b2` — source=usda type=SR Legacy fdc=169228 verified=true nutrients=41
- loser `b48acc0d-47bb-47fc-83de-ebcc92541e33` — source=usda type=Foundation fdc=2685577 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## fennel, bulb, raw

- **winner** `9ed1cdd8-4e4a-46a3-8761-3f1c57ec33b7` — source=usda type=SR Legacy fdc=169385 verified=true nutrients=41
- loser `3f5349fb-ce9b-4400-a43a-9c04d2ebb7e6` — source=usda type=Foundation fdc=2747655 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## garlic, raw

- **winner** `d2f76262-231a-47bb-81ca-1de0bf3cbe81` — source=usda type=SR Legacy fdc=169230 verified=true nutrients=41
- loser `7692e9e1-783a-4663-99c8-752e666c4d30` — source=curated type=- fdc=- verified=true nutrients=43 refs=0 meal_items / 0 recipe_ingredients
  - backfilled onto winner from loser: vitamin_d_mcg, taurine_mg
- loser `aff0ab3c-d5ad-4d95-a4a8-ca4ac276f0c2` — source=usda type=Foundation fdc=1104647 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## grapefruit juice, white, canned or bottled, unsweetened

- **winner** `821465fe-7e79-49c7-a14e-f78820945643` — source=usda type=Foundation fdc=325287 verified=true nutrients=41
- loser `a0173f5b-a1f9-4ff0-91fd-eebb924d9a52` — source=usda type=SR Legacy fdc=174678 verified=true nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## kale, frozen, cooked, boiled, drained, without salt

- **winner** `75272cbe-9ca7-4a56-b582-a540ed52f4ac` — source=usda type=Foundation fdc=326196 verified=true nutrients=41
- loser `8a6c1c62-b967-4694-ab5a-aefff0bb839e` — source=usda type=SR Legacy fdc=169240 verified=true nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## kale, raw

- **winner** `28e9c32d-ed19-4237-8e29-30df6c5ae42b` — source=usda type=Foundation fdc=323505 verified=true nutrients=41
- loser `69c2e836-78e0-4724-955f-da4848cf8327` — source=usda type=SR Legacy fdc=168421 verified=true nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## kiwifruit, green, raw

- **winner** `b29f9ba5-4f8d-45bc-9d28-a6e59a7db4e7` — source=usda type=Foundation fdc=327046 verified=true nutrients=41
- loser `40595034-e6c8-459e-8b85-c0e65b20f8aa` — source=usda type=SR Legacy fdc=168153 verified=true nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## lamb, ground, raw

- **winner** `10a0264a-418b-4985-96a5-c998251bf036` — source=usda type=- fdc=174370 verified=true nutrients=43
- loser `4588d6ab-1a80-4ef6-bca5-f2ed697170f1` — source=usda type=Foundation fdc=2727570 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients
- loser `90c9b450-272a-474b-adec-07064853a9db` — source=curated type=- fdc=- verified=false nutrients=43 refs=0 meal_items / 0 recipe_ingredients

## melons, honeydew, raw

- **winner** `3bb373f7-9962-457d-b2ed-1f24f0939596` — source=usda type=SR Legacy fdc=169911 verified=true nutrients=41
- loser `d03dcf15-d2e1-4e2d-ae21-9b61ab60d67c` — source=usda type=Foundation fdc=2710816 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## nuts, cashew nuts, raw

- **winner** `00ffa248-7dc4-4cdc-8186-5ece9691dabe` — source=usda type=SR Legacy fdc=170162 verified=true nutrients=41
- loser `d7958edd-d090-46b3-ac15-e3b7bc3682e9` — source=usda type=Foundation fdc=2515374 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## nuts, macadamia nuts, raw

- **winner** `a4559947-8cd9-4966-81a3-aaf43bccb2ac` — source=usda type=SR Legacy fdc=170178 verified=true nutrients=41
- loser `d84ca25c-0a7a-4a98-a334-b0c061e532aa` — source=usda type=Foundation fdc=2515378 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## nuts, pistachio nuts, raw

- **winner** `9ca96347-2a46-4263-9c03-bbe6d1ffaf01` — source=usda type=SR Legacy fdc=170184 verified=true nutrients=41
- loser `e0a853b7-5a32-4be0-a684-8949f588ea16` — source=usda type=Foundation fdc=2515379 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## oil, canola

- **winner** `da3e6ca6-5404-4849-95fb-b3462363057a` — source=usda type=SR Legacy fdc=172336 verified=true nutrients=41
- loser `c520d047-589d-48cd-ba23-b9908ce00253` — source=usda type=Foundation fdc=748278 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## oil, coconut

- **winner** `1e935acf-fbc0-4201-9c38-f5d16b4bc878` — source=usda type=SR Legacy fdc=171412 verified=true nutrients=41
- loser `90cc1ec6-8287-457e-8430-73a341fc673c` — source=usda type=Foundation fdc=330458 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## parsnips, raw

- **winner** `352447a7-e304-497d-bd1a-169cfa857b13` — source=usda type=SR Legacy fdc=170417 verified=true nutrients=41
- loser `e79f0ee4-7638-4c6f-aeaf-2101a1bc33ce` — source=usda type=Foundation fdc=2747659 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## peanut butter, creamy

- **winner** `eae4f96c-aebd-47cd-802f-088c7ac22c2b` — source=usda type=Foundation fdc=2262072 verified=true nutrients=41
- loser `6f8bae18-da08-43ea-9d33-70c06d49a77f` — source=usda type=Foundation fdc=2758989 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## plums, dried (prunes), uncooked

- **winner** `57f0d256-8d53-4a7f-8852-f23a8a3aa82c` — source=usda type=SR Legacy fdc=168162 verified=true nutrients=41
- loser `35ac389a-0c7f-433c-ad6a-6d6a8132422b` — source=usda type=Foundation fdc=2758978 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## quinoa, cooked

- **winner** `0ddbb1a3-3974-4547-95d8-bd8c553e8cbe` — source=usda type=SR Legacy fdc=168917 verified=true nutrients=41
- loser `887e2982-c1ea-447c-a322-c1d631b315e0` — source=curated type=- fdc=- verified=true nutrients=43 refs=0 meal_items / 0 recipe_ingredients
  - backfilled onto winner from loser: vitamin_d_mcg, taurine_mg

## radicchio, raw

- **winner** `27d8607b-53b0-4f51-8613-1c74996e65ae` — source=usda type=SR Legacy fdc=168564 verified=true nutrients=41
- loser `84bf33ed-ea9b-4d1f-bfb5-1c37db1def59` — source=usda type=Foundation fdc=2747664 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## raisins, golden, seedless

- **winner** `d7bac53f-7be5-4283-af28-fc4a557ba8de` — source=usda type=SR Legacy fdc=168164 verified=true nutrients=41
- loser `8d94e3fd-f725-4dc0-9899-abc8a51d086e` — source=usda type=Foundation fdc=2758979 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## raspberries, raw

- **winner** `906b77e6-59b9-4187-bea3-5b6127e1e421` — source=usda type=SR Legacy fdc=167755 verified=true nutrients=41
- loser `a74960c3-5c45-4c8d-a704-57bd59151419` — source=usda type=Foundation fdc=2346410 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## refried beans, canned, vegetarian

- **winner** `17b61e8b-4094-4bd1-8c04-7f78d9880a0c` — source=usda type=SR Legacy fdc=174296 verified=true nutrients=41
- loser `1e692cfe-ee4c-49d6-a87d-7b1c2d48be42` — source=usda type=Foundation fdc=2758985 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## rest custom treat

- **winner** `1be17db8-6d6d-4ae8-833b-2861bfedfbfe` — source=manual type=- fdc=- verified=false nutrients=4
- loser `4237b4df-97cf-41e2-996b-4a24df2025a0` — source=manual type=- fdc=- verified=false nutrients=4 refs=0 meal_items / 0 recipe_ingredients

## spinach, raw

- **winner** `2c1df82a-68b4-448c-83bf-2b8f43980125` — source=usda type=SR Legacy fdc=168462 verified=true nutrients=41
- loser `ea6220e3-8d8c-4e46-8959-94f1645fdba7` — source=curated type=- fdc=- verified=true nutrients=43 refs=1 meal_items / 0 recipe_ingredients
  - backfilled onto winner from loser: vitamin_d_mcg, taurine_mg

## squash, winter, acorn, raw

- **winner** `3d2c5416-189d-4950-a454-e76feeaa720d` — source=usda type=SR Legacy fdc=168472 verified=true nutrients=41
- loser `eff00469-4f46-4d15-9f6d-c2ab27be4f05` — source=usda type=Foundation fdc=2685571 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## squash, winter, butternut, raw

- **winner** `d7280591-e927-4f42-8cd3-6c93876d9a97` — source=usda type=SR Legacy fdc=169295 verified=true nutrients=41
- loser `7acad1d9-f299-4982-ac70-e63453d79182` — source=usda type=Foundation fdc=2685570 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## strawberries, raw

- **winner** `17d9517d-7f32-4819-8beb-6922745a64d9` — source=usda type=SR Legacy fdc=167762 verified=true nutrients=41
- loser `1716e531-2fac-4e3c-a9e1-12fae26b96d4` — source=usda type=Foundation fdc=2346409 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## tomatoes, crushed, canned

- **winner** `ba04cc50-83bc-4776-a91c-750a90a224c5` — source=usda type=SR Legacy fdc=170501 verified=true nutrients=41
- loser `76cd98f7-9ad4-4c58-b0c4-4bbe5c9bb8ba` — source=usda type=Foundation fdc=2685581 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## turnips, raw

- **winner** `71a70cb0-54c6-4ea4-b969-fa2168baa013` — source=usda type=SR Legacy fdc=170465 verified=true nutrients=41
- loser `388754fc-e9b2-4e33-b3de-a340b54f96b0` — source=usda type=Foundation fdc=2747674 verified=false nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## yogurt, greek, plain, whole milk

- **winner** `e4c2184f-f0ac-4b44-b252-c0968962385d` — source=usda type=Foundation fdc=2259794 verified=true nutrients=41
- loser `ce59a1a7-7d77-4c0d-bb7c-b01cbc230143` — source=usda type=SR Legacy fdc=171304 verified=true nutrients=41 refs=0 meal_items / 0 recipe_ingredients

## yogurt, plain, whole milk

- **winner** `e26cc030-7c9f-4206-bb33-f279a2b3a44f` — source=usda type=Foundation fdc=2259793 verified=true nutrients=41
- loser `eb8f6d2e-3f70-4661-809b-b05f9e231646` — source=usda type=SR Legacy fdc=171284 verified=true nutrients=41 refs=0 meal_items / 0 recipe_ingredients
- loser `ecb31d7b-7550-4751-84df-a3a44025c89e` — source=curated type=- fdc=- verified=true nutrients=43 refs=0 meal_items / 0 recipe_ingredients
  - backfilled onto winner from loser: vitamin_d_mcg, taurine_mg
