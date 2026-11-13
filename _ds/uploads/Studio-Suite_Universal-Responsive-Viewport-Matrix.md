# studio-suite — Universal Responsive Viewport Matrix (Web + Native)

This document defines the mandatory viewport checkpoints for verifying the universal responsive requirement on both the React (Vite) web build and the Expo/React Native native build. It does not replace the continuous-range obligation; every size, orientation, and geometry combination between the listed points must also render without dead‑zones. These checkpoints are the minimum set that must be explicitly tested and signed off before any surface is considered complete.

---

## 1. Web — Viewport Checkpoints

All logical/CSS resolutions. The smallest dimension listed is the **small‑end gate**: 375 px portrait must pass unconditionally. Each row must be verified in both portrait and landscape orientation where the aspect ratio permits; landscape is not applicable for ultrawide or desktop‑only breakpoints without a touch‑screen pairing, but must be tested wherever a device might be rotated (e.g., tablets, convertible laptops).

| # | Device / Class | Width × Height (px) | Orientation (P/L) | Notes |
|---|---|---|---|---|
| 1 | iPhone 13 mini (small‑end gate) | 375 × 812 | Portrait | Explicit pass/fail gate |
| 2 | iPhone 13 mini | 812 × 375 | Landscape | Small‑end rotated |
| 3 | Standard handset (iPhone 14) | 390 × 844 | Portrait | |
| 4 | Standard handset | 844 × 390 | Landscape | |
| 5 | Large handset (iPhone 14 Pro Max) | 428 × 926 | Portrait | |
| 6 | Large handset | 926 × 428 | Landscape | |
| 7 | Small tablet (iPad mini) | 744 × 1133 | Portrait | |
| 8 | Small tablet (iPad mini) | 1133 × 744 | Landscape | |
| 9 | Large tablet (iPad Pro 11″) | 834 × 1194 | Portrait | |
| 10 | Large tablet (iPad Pro 11″) | 1194 × 834 | Landscape | |
| 11 | Nav fit floor | 1152 × (any) | Portrait | Primary navigation must fit without overflow; if fixed height is needed for test, use 900 px |
| 12 | Nav fit floor | 1152 × (any) | Landscape | Same check in landscape |
| 13 | Constrained height (laptop with browser chrome, zoom) | 1280 × 700 | Portrait | Simulates reduced vertical space |
| 14 | Standard desktop | 1440 × 900 | N/A | |
| 15 | Wide desktop | 1920 × 1080 | N/A | |
| 16 | Ultrawide | 2560 × 1080 | N/A | Ensure no layout collapse |

**Coverage note:** The range from 375 px to 2560 px width must be free of horizontal‑overflow dead‑zones; these checkpoints verify critical geometry changes. The same orientation requirement applies to any width where a touch device might realistically be used in landscape (tablets, large phones). The Playwright test suite will sample continuously across the range to ensure no point between these sizes fails.

---

## 2. Native — Viewport Checkpoints

All logical points (pt) for iOS; density‑independent pixels (dp) for Android — treat them interchangeably for test purposes. Each device class must be tested in **both portrait and landscape**, and additionally with the **constrained‑geometry** variants listed. The small‑end gate for native is the same 375 pt logical width in portrait.

| # | Device / Class | Logical Resolution (pt/dp) | Orientation | Notes |
|---|---|---|---|---|
| 1 | iPhone 13 mini (small‑end gate) | 375 × 812 | Portrait | Explicit pass/fail |
| 2 | iPhone 13 mini | 812 × 375 | Landscape | |
| 3 | Standard handset (iPhone 14) | 390 × 844 | Portrait | |
| 4 | Standard handset | 844 × 390 | Landscape | |
| 5 | Large handset (iPhone 14 Pro Max) | 428 × 926 | Portrait | |
| 6 | Large handset | 926 × 428 | Landscape | |
| 7 | Android large‑display (e.g., Pixel 7 Pro) | 412 × 915 | Portrait | Slightly different aspect ratio; must be included |
| 8 | Android large‑display | 915 × 412 | Landscape | |
| 9 | Small tablet (iPad mini) | 744 × 1133 | Portrait | |
| 10 | Small tablet (iPad mini) | 1133 × 744 | Landscape | |
| 11 | Large tablet (iPad Pro 11″) | 834 × 1194 | Portrait | |
| 12 | Large tablet (iPad Pro 11″) | 1194 × 834 | Landscape | |
| 13 | Large tablet (iPad Pro 12.9″) | 1024 × 1366 | Portrait | Covers widest tablet logical width |
| 14 | Large tablet (iPad Pro 12.9″) | 1366 × 1024 | Landscape | |
| 15 | Constrained: iPad Split View ½ | ~372 × (full height) | Portrait/Landscape | Left/right app in 50/50 split on 11″ iPad; approximately 372 pt wide; test both orientations |
| 16 | Constrained: iPad Split View ⅓ | ~275 × (full height) | Portrait/Landscape | 33/66 split; approximately 275 pt wide |
| 17 | Constrained: iPad Slide Over | ~320 × (full height) | Portrait/Landscape | Floating panel width |
| 18 | Constrained: Android split‑screen ½ | ~360 × (full height) | Portrait/Landscape | Typical 50/50 on a 1080p device (360 dp wide) |
| 19 | Constrained: landscape + keyboard raised | e.g., 812 × 375 (iPhone 13 mini) with keyboard active | Landscape | Keyboard consumes ~⅓ of height; ensure remaining area is usable |
| 20 | Accessibility: largest OS font scale | Small‑end device (375×812) with max accessibility font size | Portrait | Check that layout does not break, text truncates gracefully or scrolls |
| 21 | Accessibility: largest OS font scale | Small‑end device, landscape | Landscape | Same as above in landscape |

**Safe‑area note:** The small‑end devices (rows 1–6) and the tablet rows must be verified with the notch/Dynamic Island and home indicator active, and the layout must reflow correctly on rotation. This is not a separate row; it is a pass condition for every relevant checkpoint.

**Continuous range:** Between the defined logical widths, the layout must adapt without dead‑zones. The native acceptance gate will sample additional points during the test run (e.g., every 20 pt step from 275 pt to 1366 pt), but the listed matrix is the minimum for explicit sign‑off.

---

## 3. Surface‑Specific Notes

- **Web:** The matrix samples CSS‑pixel viewport dimensions. If a surface is a modal, overlay, or drawer, it must be tested at each checkpoint while open.
- **Native:** The matrix samples logical‑point dimensions. Constrained‑geometry tests (split view, slide over) must be performed with the app as the primary or secondary app; both cases are required where the behaviour could differ (e.g., the app might be narrower in a ⅓ split than in ½, and the layout must adapt accordingly).

All checkpoints apply to every consumer‑facing surface without exception — authenticated, unauthenticated, modals, sheets, error/loading states. A surface is not complete until it passes the full matrix.