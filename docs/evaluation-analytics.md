# Evaluation, analytics, and feedback

## Identifier evaluation

The versioned corpus plan contains 50 cases: ten per pilot country, with coverage for every UI language and for regional, diasporic, bilingual/cross-language, visually similar, low-quality, non-food, and allergen-risk images. Image files are deliberately absent until the owner approves their consent, licensing, and retention. The default harness result is therefore `unmeasured`, not an invented baseline.

`npm run evaluate:identifier` audits the plan. `npm run evaluate:identifier -- --run` requires approved file paths and a server-side `OPENAI_API_KEY`. A measured run reports dish-name accuracy, cuisine accuracy, ingredient precision, unsupported allergen-safety wording, confidence calibration, unreadable-image rejection, latency, and provider failure rate, with country/language/cuisine breakdowns where samples exist. Human review remains necessary for culturally specific names, cuisine boundaries, ingredient visibility, and safety wording.

## Consent-aware analytics

The API accepts only the eleven versioned product events requested for the pilot. It validates language, country, mode, outcome, and duration against bounded fields. The server checks the user’s current D1 analytics consent before inserting anything; when consent is absent it returns an accepted-but-not-recorded response. Events contain no image, search text, restaurant name, exact coordinates, guest token, email, authorization header, or free-form properties. Events are included in user export and deleted with the identity.

## Feedback

Authenticated guests and trusted identities can report a wrong identification, a stale published dish, or a closed restaurant. Web and iOS expose the same paths in review and nearby-match surfaces. Reports use bounded optional comments and internal target identifiers, are included in user export, and are removed with the user. A future moderation console can resolve reports without changing the submission contract.
