# Identifier evaluation

`corpus-plan.json` defines 50 representative cases across all five countries and all five UI languages, including regional and diasporic food, bilingual/cross-language use, visually similar dishes, low-quality and non-food images, and allergen-risk cases.

The repository intentionally contains no unapproved or copyrighted fixture images. Add an owner-approved local image path and `"approved": true` to a case only after consent/licensing and retention have been reviewed. Run `npm run evaluate:identifier` to audit planned coverage without producing a score. Run `npm run evaluate:identifier -- --run` only with approved images and a server-side `OPENAI_API_KEY`; it prints measured aggregate and per-country/language/cuisine results. It does not invent values for missing fixtures.

The harness tracks dish-name and cuisine accuracy, ingredient precision, unsupported allergen-safety wording, confidence calibration, unreadable-image rejection, latency, and provider failure rate. Treat automated string scoring as an evaluation aid; a reviewer should still adjudicate culturally specific names, cuisine boundaries, ingredient visibility, and safety language.
