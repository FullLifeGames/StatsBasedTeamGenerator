# Smogon Stats Team Generator Design

## Overview

Build a multi-format Pokemon team-generator web app that creates Showdown-importable teams from Smogon usage statistics. The generator should use current ladder data, checks and counters, teammate frequencies, common sets, and format-aware role heuristics to produce teams that are statistically grounded and practically usable.

As of April 24, 2026, Smogon's public stats index lists monthly data through `2026-03`. The app must discover the latest available month dynamically instead of hardcoding that value.

## Goals

- Support multiple Smogon formats from the first release by treating format, month, and rating cutoff as data inputs.
- Generate complete teams with inspectable scoring, not just the six most-used Pokemon.
- Use checks and counters to estimate threat coverage and avoid teams that fold to common metagame picks.
- Use teammate data to reward proven synergies while preventing over-concentrated or repetitive builds.
- Build Showdown-importable sets from the most common abilities, items, spreads, moves, and tera types in the selected format.
- Make the first screen the real generator UI, with sprites, role chips, score explanations, and import/export controls.
- Use `@pkmn` libraries where they fit: canonical dex data, legality/type metadata, and Showdown-style sprites.

## Non-Goals

- Do not attempt perfect battle simulation in v1.
- Do not promise tournament-quality teams without user review.
- Do not manually encode every format's metagame by hand.
- Do not require users to download or pre-process Smogon data manually.
- Do not make a marketing landing page before the usable app.

## Primary Data Sources

- Smogon stats root: `https://www.smogon.com/stats/`
- Monthly usage text files: `https://www.smogon.com/stats/{month}/{format}-{cutoff}.txt`
- Chaos JSON files: `https://www.smogon.com/stats/{month}/chaos/{format}-{cutoff}.json`
- Optional moveset text files for display validation: `https://www.smogon.com/stats/{month}/moveset/{format}-{cutoff}.txt`
- `@pkmn/dex` and `@pkmn/data` for Pokemon, moves, items, types, and format metadata.
- `@pkmn/img` for Pokemon sprites and icons.
- `@pkmn/smogon` may be used as an optional supplement for human-readable analysis context, but the generator must not depend on it for core scoring.

## User Experience

The app opens directly to the generator.

The left rail contains:

- Format selector discovered from Smogon files.
- Month selector with latest available month selected by default.
- Rating cutoff selector based on available files for the selected format.
- Archetype/bias selector: balanced optimal, offense, bulky offense, stall, weather, trick room, or format-specific options when detected.
- Seed picker for locking one or more Pokemon into the team.
- Advanced weights for users who want to tune usage, synergy, threat coverage, role coverage, and novelty.

The main area contains:

- Six-slot team view by default, adjusted when a format has a known smaller team size.
- Pokemon cards with sprite, item, ability, tera type, spread, moves, role chips, and confidence.
- Slot controls: lock, replace, reroll set, and explain pick.
- Regenerate button and generation history.

The right panel contains:

- Showdown importable text.
- Team score breakdown.
- Threat coverage table showing common opposing Pokemon and which team members check them.
- Synergy map showing strong teammate edges and weak links.
- Warnings for role gaps, repeated weaknesses, low-confidence sets, unsupported format quirks, or stale data.

## Data Model

Normalize Smogon data into these core objects:

- `StatsIndex`: available months, formats, cutoffs, and file URLs.
- `FormatProfile`: format id, generation, battle style, team size, available cutoffs, and role scoring profile.
- `PokemonStats`: usage, raw count, viability ceiling, abilities, items, spreads, moves, tera types, teammates, checks, and counters.
- `SetCandidate`: ability, item, spread, tera type, four moves, source weights, and confidence score.
- `SynergyEdge`: weighted relationship between two teammates.
- `CounterEdge`: one Pokemon's observed checking/countering relationship into another.
- `GeneratedTeam`: members, sets, score breakdown, warnings, source metadata, and importable text.

Keep raw fetched payloads separate from normalized objects so parser changes do not leak into the UI.

## Generation Algorithm

Use a beam-search optimizer:

1. Build candidate Pokemon pool from usage, viability ceiling, and optional user seeds.
2. Generate set candidates per Pokemon from common abilities, items, spreads, tera types, and moves.
3. Start beams from seeds or high-value candidates.
4. Expand teams by adding candidates that improve total score.
5. Score each team after every addition using usage, set confidence, teammate synergy, role coverage, threat coverage, type balance, duplicate-role penalties, and archetype fit.
6. Keep the best diverse beams to avoid converging on one obvious high-usage core.
7. Return the top team plus alternatives and an explanation for each pick.

The scoring engine must expose component scores so the UI can explain why a Pokemon was selected.

## Role Detection

Roles are inferred from moves, items, abilities, typing, and stats metadata instead of manually tagging every Pokemon. Detection should be probabilistic: a Pokemon can contribute partially to several roles.

Shared roles:

- Physical breaker
- Special breaker
- Cleaner
- Wall or defensive pivot
- Offensive pivot
- Support
- Status spreader
- Setup sweeper
- Weather or terrain setter
- Weather or terrain abuser

Singles-focused roles:

- Hazard setter: Stealth Rock, Spikes, Toxic Spikes, Sticky Web.
- Hazard removal: Rapid Spin, Defog, Court Change, Mortal Spin, Tidy Up.
- Spin blocker or hazard preservation: Ghost typing, Good as Gold, common anti-removal patterns.
- Knock Off or item disruption.
- Cleric or status absorber where the format data supports it.
- Wallbreaker plus cleaner sequencing for offense and bulky offense.

Doubles-focused roles:

- Speed control is heavily weighted: Tailwind, Trick Room, Icy Wind, Electroweb, Thunder Wave, priority control, and naturally fast pressure.
- Positioning and protection: Protect frequency, Fake Out, Follow Me, Rage Powder, Helping Hand, pivoting moves, and defensive tera patterns.
- Spread pressure: common spread attacks and multi-target disruption.
- Board control: Intimidate, terrain/weather control, redirection, screens, and disruption.
- Lead-pair synergy matters more than full-team linear synergy.
- Hazard setting and hazard removal are low-weight unless the selected doubles format's data clearly indicates they are common.

The `FormatProfile` decides which role weights apply. Formats with ids containing `doubles`, `vgc`, `2v2`, or known doubles metadata use doubles weights. Singles formats use singles weights by default. Exotic formats can carry warnings when role inference is uncertain.

## Threat Coverage

For each selected format, identify top meta threats from usage and viability. A team scores higher when it contains reliable checks or counters into those threats.

Use Smogon's `Checks and Counters` fields as weighted matchup evidence. Reward high confidence and sufficient sample size; downweight noisy edges. Coverage should count both hard answers and soft checks, but avoid double-counting several weak answers as a guaranteed solution.

The UI should display threat coverage plainly: threat, usage rank, best answers on the generated team, confidence, and uncovered warnings.

## Synergy Scoring

Teammate data rewards pairs that appear together more often than expected. The scorer should normalize by each Pokemon's overall usage so very common Pokemon do not automatically dominate every score.

Singles synergy emphasizes:

- Defensive type complement.
- Hazard game compatibility.
- Breaker and cleaner sequencing.
- Pivot chains.
- Avoiding stacked weaknesses to top threats.

Doubles synergy emphasizes:

- Lead-pair compatibility.
- Speed-control partner fit.
- Spread move plus partner protection or immunity.
- Weather, terrain, Trick Room, and Fake Out/redirection support.
- Avoiding duplicated passive support roles without enough damage pressure.

## Set Construction

Set generation should prefer statistically coherent sets:

- Choose the highest-confidence ability unless the item/move/spread combination strongly indicates another ability.
- Select item, spread, tera type, and moves from weighted stats.
- Build move sets by maximizing common move weight while preserving role requirements and avoiding illegal or redundant combinations where `@pkmn` data can detect them.
- If four good moves cannot be confidently selected, include a warning rather than hiding uncertainty.
- Support Showdown import format for species, item, ability, tera type, EVs, nature, and moves.

## Caching and Freshness

Use an app data layer that fetches Smogon indexes and stats through a local API/cache. Cache normalized data by `{month, format, cutoff}` to avoid repeated large downloads.

The app should:

- Default to the latest discovered complete month.
- Let users switch month and cutoff.
- Show source metadata on generated teams.
- Handle missing files gracefully.
- Revalidate indexes on app startup or explicit refresh.

## Error Handling

- If Smogon is unavailable, show a clear offline/stale-cache state.
- If a format lacks chaos JSON, disable generation for that format and explain why.
- If a format is discovered but its rules are not recognized, generate with generic scoring and show a format-confidence warning.
- If parser validation fails, surface the affected file and keep the rest of the app usable.

## Visual Direction

The app should feel like a dense but calm competitive tool, closer to a Showdown companion than a marketing dashboard.

Design qualities:

- Compact, scan-friendly layout.
- Strong sprites and type colors, but restrained chrome.
- Clear score chips and warnings.
- No oversized hero section.
- No decorative-only cards or gradients.
- Main workflow visible in the first viewport on desktop.
- Mobile layout stacks controls, team cards, and import/export in a usable order.

## Testing

Parser tests:

- Parse sampled chaos JSON files for singles, doubles, and unusual formats.
- Preserve case-sensitive keys that PowerShell-style parsers would collapse.
- Normalize checks, teammates, sets, and usage consistently.

Scorer tests:

- Singles role tests verify hazard setters/removers matter.
- Doubles role tests verify speed control and positioning matter more than hazards.
- Threat coverage tests verify counter evidence changes team score.
- Synergy tests verify normalized teammate edges affect team score without simply rewarding the most-used Pokemon.

Import/export tests:

- Generated sets produce valid Showdown-style text.
- Locked seed Pokemon remain in generated teams.

Browser tests:

- Select format/month/cutoff.
- Generate a team.
- Lock a slot and regenerate.
- Inspect explanation, threat coverage, and importable output.
- Verify desktop and mobile layouts do not overlap or hide controls.

## Initial Implementation Scope

The first implementation should include:

- Project scaffold for a TypeScript web app.
- Smogon index discovery for months, formats, and cutoffs.
- Chaos JSON fetch, cache, parser, and normalizer.
- Multi-format selector.
- Format-aware role profiles for singles and doubles.
- Beam-search generator with inspectable score breakdown.
- Set builder using common stats.
- Team cards with sprites.
- Threat coverage and synergy explanation panels.
- Showdown importable output.
- Focused parser/scorer tests and browser verification.

Future improvements can add account-level saved teams, richer archetype presets, battle simulator hooks, matchup-specific generation, and deeper integration with Smogon analyses.
