<div align="center">
	<h1>📡 Smith Chart RF Toolkit</h1>
	<p>A single-file, canvas‑based interactive Smith Chart web application for RF & microwave engineers.</p>
	<img src="public/favicon.svg" width="96" alt="Smith Chart Icon" />
</div>

## ✨ Features

- Fully rendered Smith Chart (constant resistance circles & reactance arcs) drawn with the HTML Canvas API
- Impedance / Admittance labeling toggle
- Plot load by entering:
	- Characteristic impedance (Z₀)
	- Complex load (ZL) in formats: `R+jX`, `R-jX`, `jX`, `R`
	- Frequency (MHz)
- Click on chart to add arbitrary points (inverse-mapped from Γ to Z)
- SWR circle, reflection coefficient, SWR, Return Loss & more in real time
- Transmission line movement (rotate Γ along constant |Γ| using distance in wavelengths, direction selectable)
- Approximate L‑section impedance matching (two solution variants) with component value estimates (nH / pF)
- Dynamic chart sizing slider (400–900px)
- Dark, responsive Tailwind UI (mobile-friendly: chart stacks above data panel)
- Favicon + metadata

## 🧮 Key RF Relationships Implemented

| Quantity | Formula | Notes |
|----------|---------|-------|
| Normalized impedance | z = Z / Z₀ | Complex
| Reflection coefficient | Γ = (z − 1) / (z + 1) | Standard bilinear transform
| Normalized admittance | y = 1 / z | Used when toggling conceptual admittance labels
| SWR | (1 + |Γ|) / (1 − |Γ|) | For |Γ| < 1
| Return Loss (dB) | −20 log₁₀ |Γ| | Positive value (better match → higher RL)
| Transmission line rotation | Δ∠Γ = ± 720° · d(λ) | 360° per 0.5 λ toward generator

## 🧩 L-Section Matching (Simplified)

The current algorithm:
1. Cancels load reactance with an equal/opposite series reactance.
2. Determines step-up or step-down network based on normalized resistance r.
3. Approximates shunt element via susceptance transformation (not full rigorous topology enumeration).
4. Provides two heuristic sequences (A & B) for quick exploration.

Improvements (see roadmap) could add: topology selection (series first vs shunt first), sign-aware orientation, Q minimization, multi-section networks.

## 🚀 Getting Started

Install dependencies (if not already):

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Open: http://localhost:3000

## 🖱️ Usage Walkthrough

1. Adjust Z₀ if different from 50 Ω.
2. Enter load as `ZL` (e.g., `37.5-j12.5`) OR use R / X fields (they sync with ZL).
3. Set frequency (affects L/C value calculations only).
4. Click Plot to add the load point. It becomes the active point.
5. Optionally click anywhere on the chart to add exploratory points.
6. Use Dist (λ) + direction to move along the line (visual arc of Γ maintained at constant magnitude).
7. Open L-Section tab → choose Solution A or B; inspect component table.
8. Use the size slider to enlarge the chart for presentations.
9. Toggle Admittance View (labels update; future enhancement could fully transform geometry).

## 🏗️ Architecture Overview

The application intentionally remains single-file (`src/app/page.tsx`) for portability & clarity:

- React client component with state hooks
- Canvas draw routine (`draw()`) recomputed on dependency changes
- Complex arithmetic implemented manually (no external math lib)
- Impedance ↔ reflection coefficient mapping uses canonical bilinear transform
- Matching logic confined to `computeLMatch`

## 📁 Important Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main Smith Chart application (UI + logic + rendering) |
| `src/app/layout.tsx` | Root layout & metadata (fonts, favicon) |
| `public/favicon.svg` | Custom favicon / icon |
| `globals.css` | Global Tailwind + base styles |

## 🧪 Validation & Assumptions

| Area | Status | Notes |
|------|--------|-------|
| Γ mapping accuracy | ✅ | Bilinear transform, unit disc enforced |
| Reactance arc fidelity | ✅ | Sampled r sweep until |Γ| → 1 |
| Admittance mode | ◑ | Labels only; full y-plane inversion path future work |
| L-match networks | ◑ | Simplified approximations (educational) |
| Input UX | ✅ | Deferred validation for Z₀ & frequency (onBlur) |
| Mobile layout | ✅ | Flex stack; chart scales |

## 🗺️ Roadmap Ideas

- Full admittance plane overlay (mirror / conjugate transform)
- Drag-and-drop markers & live update panel
- Quarter-wave / multi-section transformers
- Stub matching (single / double)
- Smith Chart export (PNG / SVG) & marker list CSV
- Q-factor and bandwidth estimation helpers
- PWA packaging with offline support
- Accessibility refinements (keyboard navigation for markers)

## ⚠️ Limitations

- L-section synthesis not exhaustive; may not reflect all valid practical networks.
- No loss or frequency-dependent reactance modeling beyond ideal L/C formulas.
- Reactance arc sampling step-size adaptive but could be further smoothed.

## 🧠 Math Reference Snippets

Reflection coefficient: `Γ = (Z − Z₀) / (Z + Z₀)` → normalized form uses `z = Z/Z₀` → `Γ = (z−1)/(z+1)`.

SWR: `SWR = (1 + |Γ|) / (1 − |Γ|)`

Return Loss: `RL(dB) = −20 log₁₀ |Γ|`

Series reactance conversion:
```
X_L = 2π f L   ⇒   L = X_L / (2π f)
X_C = -1 / (2π f C)   ⇒   C = 1 / (2π f |X_C|)
```

## 🔧 Development Notes

You can refactor the single file into modular components if the feature set grows (e.g., separate hooks for math, chart drawing, matching, UI panels).

Tailwind classes are used directly; consider extracting style tokens if theming expands.

## 🛡️ License

MIT (add a `LICENSE` file if distributing publicly.)

## 🙌 Acknowledgements

- RF engineering community & classic Smith Chart references
- Inspiration: analog network design workflows and lab bench tooling

---

Feel free to open issues or propose enhancements. Enjoy exploring impedance transformations! ⚡

