---
name: ui-motion
description: Build UI motion for this Vue + UnoCSS app by deciding, in order, whether it should animate at all, its purpose, tool, properties, curve, duration, interruption, and exit — with exact values from fixed tables. Use when adding animation, transitions, enter/exit motion, hover or press feedback, or when asked to make a component feel alive, and when hunting for places that could animate. Defers to vue-stack:antfu-design wherever the two overlap.
---

# UI Motion

A construction skill: turn a request for motion into an implementation that survives a strict review (`ui-review`) the first time. Distilled from Emil Kowalski's animation philosophy, adapted for Vue 3 + UnoCSS.

Two failure modes, and the first is worse:

1. **Animating something that shouldn't animate.** The gate below exists to produce zero lines of code sometimes. That's a success.
2. **Right thing, wrong ingredients** — `ease-in` on an entrance, `scale(0)`, keyframes on a toast, a sluggish dropdown.

Never present motion options as a menu. Make the call, state the reasoning in one line, write the code.

## Relationship to antfu-design

`vue-stack:antfu-design` is this project's design canon. This skill fills its missing numeric layer (which curve, how many ms, from which origin, whether to animate at all). Where the two sources disagreed, these rulings apply — do not re-litigate:

- **Tap scale is `0.96`** (the `tap-scale` shortcut), not 0.97.
- **Stagger interval is ~100ms** for content-chunk entrances, not 30–80ms.
- **Icon swaps** cross-fade with opacity + scale + slight blur using `cubic-bezier(0.2, 0, 0, 1)`, per antfu-design's micro-interactions reference.

Everything else below fills gaps antfu-design leaves open and does not override it.

## Motion tokens

The canonical curves. Built-in CSS easings are too weak for deliberate UI motion; never invent a bezier from memory.

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* strong ease-out — the UI default */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* strong ease-in-out — on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* iOS-like drawer curve */
```

`uno.config.ts` deliberately defines no theme yet (visual foundation arrives with a later design change). When you first ship motion, add only this additive, motion-scoped block — it doesn't preempt the visual tokens:

```ts
export default defineConfig({
  presets: [presetWind4()],
  preflights: [{
    getCSS: () => ':root{--ease-out:cubic-bezier(0.23,1,0.32,1);--ease-in-out:cubic-bezier(0.77,0,0.175,1);--ease-drawer:cubic-bezier(0.32,0.72,0,1)}',
  }],
  shortcuts: {
    'tap-scale': 'transition-transform active:scale-[0.96]',
  },
})
```

Use them via plain CSS (`transition: transform 200ms var(--ease-out)`) or utilities (`ease-[var(--ease-out)] duration-200`). If a curve you need isn't here, take it from easing.dev — don't hand-roll.

## The build sequence

Run in order. Steps 1 and 2 gate everything.

### 1. Should this animate at all?

| Frequency | Decision |
| --- | --- |
| 100+ times/day (keyboard shortcuts, command palette toggle) | **No animation. Ever.** Stop here. |
| Tens of times/day (hover, list navigation) | Near-imperceptible only — fast and subtle, or nothing |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare / first-time (onboarding, success, celebration) | The delight budget lives here |

**Keyboard-initiated actions are a disqualifier, not a judgment call.** If the request fails this gate, say so plainly and offer the non-motion alternative instead.

### 2. Name the purpose

One of: **feedback** · **spatial consistency** · **state indication** · **preventing a jarring change** · **explanation** (marketing/onboarding only) · **delight** (rare-tier only). Can't name it? Don't build it. Data the user is reading or acting on never moves for style.

### 3. Pick the tool — cheapest that works

| Need | Tool |
| --- | --- |
| Hover, press, color, a class/attribute-driven state toggle | **CSS transition** |
| Enter/leave tied to `v-if` / `v-show` / list changes | **Vue `<Transition>` / `<TransitionGroup>`** (they emit CSS transitions — same tool, managed classes) |
| Entry animation on mount, no JS state | **CSS `@starting-style`** |
| Predetermined motion that must stay smooth while the page is busy | **CSS animation** (runs off the main thread) |
| Programmatic control with CSS performance, no library | **WAAPI** (`element.animate()`) |
| Springs, gesture-driven values, layout animations | **motion.dev** vanilla `animate()` — don't add it for anything the rows above cover |

### 4. Pick the properties

- **`transform` and `opacity` only.** (`clip-path` is the sanctioned third — see RECIPES.md. `height` is tolerated only for accordions.) Never `width`/`margin`/`padding`/`top`/`left`.
- **Never `scale(0)`.** Enter from `scale(0.95–0.97)` + `opacity: 0`.
- **`transform-origin` at the trigger** for popovers, dropdowns, menus, tooltips. **Modals are exempt** — they stay centered.
- **Percentages in `translate()`** are relative to the element's own size; prefer over hardcoded px.
- **Never drive a child's transform via a CSS variable on the parent** — it recalculates styles for every child. Set `transform` on the element directly.

### 5. Easing and duration

Easing, in decision order: entering/exiting → `--ease-out` · moving/morphing on screen → `--ease-in-out` · hover/color → `ease` · constant motion → `linear`. **Never `ease-in` on UI** — it delays the exact moment the user is watching.

| Element | Duration |
| --- | --- |
| Button press feedback | 100–160ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects | 150–250ms |
| Modals, drawers | 200–500ms |

**UI animations stay under 300ms.** Exits run at 60–75% of their entrance. Reach for a spring only when the user's hand is involved — drag with momentum, an interruptible gesture: `{ type: 'spring', duration: 0.5, bounce: 0.2 }`, bounce 0.1–0.3, and no bounce unless the gesture carried momentum.

### 6. Interruption and exit

- **Transitions, not keyframes, for anything triggered rapidly** — transitions retarget from the current value; keyframes restart from zero. Vue `<Transition>` uses transitions by default; keep it that way.
- **Exit the way it entered.** Symmetric paths.
- **Asymmetric timing where the user is deciding** — slow on the deliberate phase (hold-to-confirm: 2s linear), snappy on the system response (release: 200ms `--ease-out`).
- **Skip enter animations on first paint**: `<Transition>` without `appear` already does this — only add `appear` when a mount animation is genuinely wanted.

### 7. Reduced motion and pointer gating — ships with the animation, every time

```css
@media (prefers-reduced-motion: reduce) {
  .element { transition: opacity 150ms ease; transform: none; } /* keep opacity/color, drop movement */
}
@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: translateY(-1px); } /* touch fires false hovers on tap */
}
```

Reduced motion means **fewer and gentler**, not zero. In script, use VueUse `usePreferredReducedMotion()` when a JS branch is unavoidable; prefer the media query.

## Vue mapping

React/Base UI idioms in upstream material translate as:

| Upstream idiom | Vue equivalent |
| --- | --- |
| `[data-starting-style]` / `[data-ending-style]` | `.v-enter-from` / `.v-leave-to` on `<Transition>`, or native `@starting-style` |
| `useEffect(() => setMounted(true))` fallback | Not needed — `<Transition appear>` or `@starting-style` |
| Base UI `var(--transform-origin)` | Set `transform-origin` from your positioning logic (Floating UI middleware data / placement side) |
| `useReducedMotion()` | CSS media query first; `usePreferredReducedMotion()` from VueUse |
| Framer Motion `x` / `y` shorthands (main-thread, drop frames) | Full `transform` string in motion.dev `animate()`, or plain CSS |
| List add/remove/reorder | `<TransitionGroup>`; `.v-move` is transform-based FLIP — reorder animation for free, GPU-friendly |

## Finding opportunities (on request)

When asked "what could animate here?", flip into restraint-first search mode: sweep for feedback gaps (no `:active`), teleporting state (`v-if` swaps with no bridge), missing spatial story (popovers from thin air), flat group entrances, and rare high-emotion moments rendered flat. Every candidate must pass the frequency and purpose gates above plus the duration budget. Cap suggestions at 5–7, ordered by leverage, **and always list 2–5 candidates you deliberately rejected with the gate that killed each** — that list is what separates this from an animation wishlist. Report only; don't implement uninvited.

## Never ship

| Never | Instead |
| --- | --- |
| `transition: all` / `transition-all` | Name the exact properties |
| `scale(0)` entrance | `scale(0.95)` + `opacity: 0` |
| `ease-in` on a UI element | `--ease-out` |
| Animation on a keyboard shortcut or 100+/day action | No animation |
| UI duration over 300ms with no reason | 150–250ms |
| `transform-origin: center` on a trigger-anchored popover | Origin at the trigger (modals exempt) |
| Keyframes on toasts, toggles, rapidly-triggered elements | CSS transitions / `<Transition>` |
| Animating `width`/`height`/`margin`/`padding`/`top`/`left` | `transform` / `opacity` |
| Ungated `:hover` motion | `@media (hover: hover) and (pointer: fine)` |
| Missing `prefers-reduced-motion` | Gentler variant, not zero |
| Overshoot/bounce easing on plain UI state changes | Reserve for momentum gestures |
| Focus ring that fades in | Focus indication is instant, always |

## Recipes

Ready-to-adapt implementations — button press, dropdown, tooltip, modal, drawer, toast, accordion, stagger, hold-to-confirm, tab indicator, list transitions, gestures — in [RECIPES.md](RECIPES.md). Load it whenever the request matches one; start from the recipe, not a blank file.

## Output

Write the code, then at most a few lines: the gate result (frequency tier + named purpose, and anything rejected), the ingredients (tool, properties, curve, duration — one line), and what to feel-check if feel can't be judged from code (play at 2–5× duration in the DevTools animation inspector, look again next day). The code is the deliverable — don't pad this into a report. When the honest answer is "this shouldn't animate," give it.
