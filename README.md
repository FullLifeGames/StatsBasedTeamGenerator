# Smogon Stats Team Generator

A multi-format Pokemon team generator powered by Smogon usage stats, checks and counters, teammate data, and format-aware role scoring.

## Run Locally

```bash
npm install
npm run dev
```

Open the Vite URL printed by the terminal, usually `http://127.0.0.1:5173`.

## What The Generator Uses

- Smogon monthly stats index for available months, formats, and cutoffs.
- Smogon chaos JSON for usage, sets, teammate data, and checks/counters.
- Singles role weights prioritize hazards, removal, item disruption, and defensive/offensive sequencing.
- Doubles role weights prioritize speed control, positioning, board control, and spread pressure.
- Set choices are team-contextual, so the generator penalizes low-value repeated roles like excessive singles hazard setters.

