# studio-suite — Universal Responsive Design Requirement (Web + Native)

## 1. Core Requirement (Non‑Negotiable)

Every consumer‑facing surface of studio‑suite — the React (Vite) web build and the Expo/React Native mobile build — must render and function **seamlessly across the continuous range of mobile and tablet screen sizes, and both orientations**, adapting dynamically to the available screen geometry at runtime. This is a **core, non‑negotiable completion requirement and a load‑bearing acceptance gate** on both surfaces equally — not a polish pass, not a QA nicety, and not an afterthought deferred to post‑launch on either one.

It is **not** “mobile responsive” in the common sense of a phone layout plus a tablet layout. Handsets and tablets are **both first‑class targets** on **both surfaces**; **orientation is an independent axis that applies to every device class, on both surfaces**; and there must be **no dead‑zones** anywhere in that range, on either surface — no size, orientation, or runtime geometry at which the layout is broken, clipped, unreachable, or awkward because it falls between fixed states.

**Building mobile‑first:** the Expo/React Native application is the primary touchpoint for ongoing use; its design and layout must be conceived and executed with mobile and tablet viewports as the foundational targets, scaling thoughtfully to larger screens only after the small‑end is flawless. The web build must match that quality and behaviour equally — a consumer meeting the studio for the first time via the web must receive an experience that is equally impressive and purpose‑built, regardless of viewport size or orientation.

Both builds must be **exact replicas** in features, functions, and visual styling; any surface that exists on one must exist on the other with identical behaviour, adapted only by the responsive rules defined herein.

---

## 2. Locked Terminology

The following terms carry precise, binding meaning across all design, development, and QA artefacts:

| Term | Meaning |
|---|---|
| **dynamically responsive** | Adapts continuously; never snaps between a small number of fixed states. |
| **dependant on viewport size *and* orientation** | Two independent axes. Width alone is insufficient — orientation always binds. |
| **not just… responsive for mobile handsets** | Tablets are a first‑class target, not a fallthrough of a phone layout. |
| **seamlessly rendered** | Continuous range, both orientations, zero exceptions. |
| **dead‑zone** | Any size/orientation combination at which the layout is broken, clipped, unreachable, or awkward because it falls between fixed states — the tell that the work was not done right. |
| **small‑end gate** | The smallest supported viewport (explicitly 375pt logical width portrait) is an absolute pass/fail gate — not a best‑effort edge. |
| **load‑bearing acceptance gate** | Responsiveness is a completion condition; a surface is not done until it passes. |
| **equally impressive and purpose‑built** | Parity of quality between web and native, and parity across the full range within each surface. |
| **custom developed and purpose‑built… professional industry use** | The justification for the standard; it applies identically to both builds. |

---

## 3. Web Surface Specification

The React (Vite) web build must satisfy the following, driven by intrinsic CSS techniques:

- **Fluid type and space:** `clamp()` for type, spacing, and layout gutters; token‑scale values interpolated against viewport width.
- **Container queries** (deferred primary mechanism, when active): per‑component width as the layout driver; media queries serve only as coarse refinements.
- **Grid and flex:** reflow‑first composition; no fixed pixel widths that break the range.
- **Explicit small‑end gate:** iPhone 13 mini portrait (375×812px CSS) — must render fully functional and aesthetically correct. Landscape phone, tablet portrait & landscape, desktop, wide, and constrained‑height viewports are equally mandatory.
- **No layout dead‑zones:** Continuous coverage from 375px width upward, both orientations. No point where horizontal overflow, clipping, or unreachable content occurs.
- **Tap targets:** Minimum 44×44px interactive area on all touch‑driven controls.
- **Navigational fit floor:** The primary navigation must fit without overflow at 1152px width; below that, a collapsed/disclosure pattern must be used.
- **Validation gate:** An automated test matrix (Playwright suite in CI against the shipped build) covering all surface states × viewport × orientation combinations; zero horizontal‑overflow dead‑zones required to pass.

---

## 4. Native (Expo/React Native) Surface Specification

The native build mirrors the web requirement with its own device‑specific implementation. It must be built with mobile‑first responsiveness as a core design principle, not an afterthought.

### 4.1 Device × Orientation Matrix (Mandatory Coverage)

| Class | Cases |
|---|---|
| **Small handset (small‑end gate)** | 375×812 pt logical portrait, and landscape (812×375 pt) — explicit pass/fail. |
| **Standard handset** | ~390–402 pt width, portrait + landscape |
| **Large handset** | ~428–440 pt width, portrait + landscape (including Android large‑display) |
| **Small tablet** | ~744–768 pt, portrait + landscape |
| **Large tablet** | ~1024–1194 pt, portrait + landscape |
| **Constrained geometry** | iPad Split View (½, ⅓), Slide Over, Stage Manager resize; Android split‑screen/multi‑window; landscape phone with keyboard raised — the native analogue of web’s constrained‑height case |
| **Accessibility geometry** | Largest supported OS font scale on the small‑end device |

### 4.2 Mechanism Law (How It Must Work)

1. **Layout is driven by measured runtime geometry** (via `useWindowDimensions` or equivalent hook), never by device identification.
2. **Device‑class branches are refinements**, never the sole mechanism.
3. **Type and spacing** derive from the shared `@is/tokens` scale, interpolated based on available space — not hard‑coded sizes.
4. **Flex‑based, reflow‑first composition**; fixed dimensions only where genuinely fixed by design intent.
5. **Content that cannot fit scrolls or collapses deliberately** — never clips silently, never overflows. This is the direct native equivalent of web’s zero‑horizontal‑overflow requirement.
6. **Orientation changes must be instantaneous and correct**; no stale dimensions, no layout jumps, no content loss on rotation.
7. **Safe‑area insets** (notch, Dynamic Island, gesture bar) must be respected and recalculated on rotation.
8. **OS font scaling** (Dynamic Type / Android) is a separate axis from width; it must have its own matrix coverage.
9. **Software keyboard** is a runtime viewport change; layouts must adapt using `KeyboardAvoidingView` or equivalent, not merely shrink.
10. **Tap targets:** 44×44 pt (iOS) / 48×48 dp (Android) minimum — matching the web’s 44×44 hardening.

### 4.3 Explicitly Forbidden

- Stale dimension reads that do not update on rotation.
- Orientation locks used to avoid the requirement (unless separately ratified as a deliberate product decision).
- Tablet treated as a stretched phone layout.
- Hard‑coding to device model or OS version.
- Single‑simulator, single‑size sign‑off.
- Any reliance on a “frozen desktop” reconciliation path — native has no such exemption; every surface must respond dynamically.

### 4.4 React‑Native‑Specific Traps (Pre‑empted)

1. **One‑shot dimensions** – must use a subscribed, re‑rendering source (e.g., `useWindowDimensions`), never a static read.
2. **Safe‑area handling** – use the community `react-native-safe-area-context`; the built‑in `SafeAreaView` alone is insufficient for continuous geometry changes.
3. **Orientation must be permitted in app config** (`app.json`/`expo` settings) — locked orientation makes the requirement unsatisfiable by construction.
4. **Percentage heights** fight the keyboard; always use flex inside a keyboard‑avoiding container.
5. **Font scale is a separate axis** — must be tested independently of width.
6. **Tablet ≠ wide phone** — a two‑pane or master‑detail pattern is a distinct layout, not simply a wider single‑pane.

### 4.5 Web‑to‑Native Mechanism Translation

| Web Specification | Native Equivalent |
|---|---|
| `clamp()` fluid type + space | Token‑scale interpolation against measured available space |
| Container queries | Per‑component measured width via layout callback |
| Media queries as refinement | Device‑class/geometry‑class branches as refinement only |
| Continuous viewport range | Continuous window‑dimension range, sampled per the matrix |
| Both orientations | Both orientations + rotation transition correctness |
| Constrained‑height case | Split View / Slide Over / Stage Manager / multi‑window / keyboard‑raised landscape |
| 375px portrait small‑end | 375×812 pt logical small‑end |
| Zero horizontal‑overflow | Zero clipped/unreachable content; deliberate scroll or collapse |
| 44×44 tap‑target | 44×44 pt iOS / 48×48 dp Android |
| 1152px nav fit floor + sheet collapse | Per‑surface measured fit floors → deliberate disclosure pattern |
| Playwright CI suite vs shipped build | Equivalent test matrix (to be defined as part of the acceptance gate) |
| — | Safe‑area, OS font scale, keyboard avoidance, multi‑window (native‑only axes) |

---

## 5. Acceptance Criteria (Both Surfaces)

A surface is considered complete only when:

- It passes the full matrix of sizes, orientations, and device classes defined above.
- Zero dead‑zones exist — no layout is broken, clipped, or unreachable at any point in the range.
- Small‑end gate (375pt portrait) renders correctly with all interactive elements reachable and visually sound.
- All tap targets meet minimum size requirements.
- Orientation changes do not cause layout loss, overflow, or stale rendering.
- The native build’s safe‑area, keyboard, and font‑scale adaptations work correctly.
- The web build passes its automated Playwright suite with zero horizontal‑overflow failures.

**The requirement is universal; a partial pass on one surface does not satisfy the gate. Both builds must be independently verified.**