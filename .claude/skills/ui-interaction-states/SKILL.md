---
name: ui-interaction-states
description: State discipline for interactive elements — the eight states, focus rings, the exhaustive input-field checklist, forms, modals, overlays, loading/empty states, and contrast pairing. Use when building or styling any interactive element in this app - buttons, inputs, textareas, selects, forms, modals, dropdowns, toggles, tabs — so none ships with only default + hover.
---

# Interaction States

Every interactive element has eight states. Most AI-generated UI styles two (default, hover) and forgets the rest — that's where interfaces break. Adapted from hallmark's interaction reference for this Vue + UnoCSS app; visual treatments use antfu-design's semantic-token vocabulary once the project's tokens exist (until then, express the same treatments with plain utilities and keep them consistent).

## The eight states

| State | When | Treatment |
| --- | --- | --- |
| Default | At rest | Base styling |
| Hover | Pointer over — only inside `@media (hover: hover)` | One small shift: background, color, or 1px translate. One signal, not five. |
| Focus | Keyboard/programmatic focus | Visible ring via `:focus-visible`, instant |
| Active / pressed | During press | Pressed-in: darker, or `tap-scale` |
| Disabled | Not interactive | `opacity-55` + `cursor-not-allowed` + native `disabled` (or `aria-disabled`) — three channels, never opacity alone |
| Loading | Processing | Inline spinner replacing the label or in the reserved slot; element stays legible |
| Error | Failed | Border color + icon + message + `aria-invalid` — never color alone |
| Success | Completed | Quiet check, auto-clear on re-edit; success doesn't deserve celebration unless it was hard |

If any of these is missing on a production element, the element isn't finished.

## Focus rings

- `:focus-visible`, not `:focus` — keyboard-only. Never `outline: none` without a replacement (the most common a11y bug).
- 2–3px, ≥ 3:1 contrast against **both** the element and the page, 2px offset, `border-radius: inherit`.
- **Never animated.** A ring that fades in leaves keyboard users without an indicator at the start. Instant, always.

## Hit targets

Minimum 44×44 CSS px for anything touch-reachable (antfu-design's 40px floor applies to dense desktop-only devtools surfaces; default to 44). Expand without changing visual size:

```css
.icon-btn { position: relative; }
.icon-btn::before { content: ''; position: absolute; inset: -12px; }
```

Never let two hit areas overlap.

## Input fields — the exhaustive checklist

Inputs are where almost-right UIs lose. Every text input, textarea, select, and combobox must satisfy all of this.

### The no-layout-shift rule

**Border thickness is constant across every state.** Default · hover · focus · error · disabled — `border-width` never changes. State changes go to `background-color`, `outline`, or `box-shadow`. Reserve the focus-ring slot so geometry never shifts:

```css
.input {
  border: 1px solid;               /* 1px, always — every state */
  outline: 2px solid transparent;  /* reserved slot; ring appears with zero shift */
  outline-offset: 1px;
}
.input:focus-visible { outline-color: var(--focus-ring-color); }
```

### State recipe

| State | Treatment |
| --- | --- |
| Default | 1px border, base background, placeholder in muted color |
| Hover | Background shifts 4–6% darker; border unchanged (a border-only change is missable) |
| Focus | Outline ring appears (instant, never animated); border color may deepen but width stays 1px |
| Typing | Same as focus — a separate "typing" state is noise |
| Filled | Same as default; the value carries the state |
| Disabled | `opacity-55` + `cursor-not-allowed` + `disabled` attribute — three channels |
| Error | Border color flips + helper text replaced by the error + `aria-invalid="true"` + small glyph in the right-edge slot |
| Success | Subtle border tint + small ✓; auto-clear when the user re-edits |
| Loading (async validation) | Inline spinner in the right-edge slot; **field stays editable**, only submit disables |

### Heights and rhythm

- **Input height = adjacent button height.** A form with 44px buttons and 38px inputs reads as untuned. One base height (44px is the touch floor) for every input and its adjacent buttons.
- Vertical padding = `(height − line-height-px) / 2`. No magic numbers.
- **Reserve a ~24px right-edge slot** for clear button / error glyph / spinner. Unused, it sits empty — content never reflows when an icon appears.

### Labels, helper, error

- Label **above** the input, 4–8px gap, always visible. Placeholder-as-label is banned; placeholders show format (`01 Jan 2026`), not instructions.
- Helper text below, same font-size as the label, lower weight. **Error replaces helper** — same slot, never both (that's a layout jump).
- **Helper slot has stable height**: `min-height: 1lh` even when empty, so an appearing error pushes nothing.
- Error message says: what broke, why, what to do. One sentence. Associate with `aria-describedby`.
- Validate on **blur**, then re-validate on change once touched. Never on every keystroke from the start.
- Submit disables only when the form is known-invalid or in flight — never on idle.

### Control specifics

- **Textarea**: `resize: vertical`, `min-height: 6rem`.
- **Select**: stay native unless you can replicate native a11y; style the wrapper.
- **Checkbox / radio**: `accent-color` for cheap correct styling; custom builds keep the same focus-ring contract.
- **Toggle**: it IS a checkbox — same a11y contract regardless of visuals.
- **Slider**: the thumb gets focus, not the track; thumb hit-target ≥ 44px via transparent expansion.
- **File input**: wrap in a styled `<label>`; the native control is unstyleable.
- **Combobox**: listbox `position: absolute` (never pushes page content), `aria-expanded` mirrors visibility, arrows cycle, Enter selects, Escape closes.

## Modals and overlays

- Use native `<dialog>` + `showModal()` — focus trap, Escape, `::backdrop` for free. Set `inert` on the page content behind it.
- **Center it explicitly** — custom positioning can snap a dialog to the corner: `position: fixed; inset: 0; margin: auto; height: fit-content; max-height: min(80vh, 40rem)`.
- Close on Escape, backdrop click, and an explicit button. First focus goes to the first interactive element, not the close button.
- Dropdowns/tooltips: prefer the Popover API (light-dismiss, stacking, Escape for free). Never place a dropdown inside `overflow: hidden` without escape; flip near the viewport edge.

## Undo over confirm

- Reversible action → no confirm dialog. Do it, show a toast with Undo for 5–10s.
- Destructive and irreversible → keep the confirm, and make the user type the name of what's being destroyed.
- **Silent success**: if the user can see the result, no "Done!" toast. Toasts are for failures and invisible effects. Copy-to-clipboard feedback is the button label swapping to "✓ Copied" for 2.5s — no toast.
- **Optimism with rollback**: mutate the UI immediately, request in background; on failure animate the rollback and offer Undo/retry in a toast that doesn't auto-dismiss while it's still needed.

## Loading and empty states

- **Skeletons** for content with predictable shape (lists, cards, tables); spinners only where shape is unknowable.
- Spinners need a minimum visible time (~300ms) or a show-delay (~150ms) — a spinner that flashes for 80ms reads as a glitch.
- **Empty states** always have: a small icon or illustration, one line explaining why it's empty, and an action to fix it. Never a bare "No results".

## Contrast pairing

- **Any rule that sets a background must also set the text color it implies.** Flipping a surface dark while text inherits the dark ink color is the ink-on-ink bug — the most-shipped contrast failure.
- Body text ≥ 4.5:1 (APCA Lc 60); large text, icons, and focus rings ≥ 3:1 (Lc 45). Check the *computed* pair — muted text on a tinted surface is the classic silent failure.
- Button text vs button fill: if they're within ~5% lightness of each other, it's the black-on-black bug — pair every accent fill with its designated readable ink color, never hardcoded white.
- In antfu-design's dual light/dark model, verify pairs in **both** modes.

## Bans

- Placeholder-as-label · hover-only functionality · focus rings removed without replacement · confirm dialogs for low-stakes actions · touch targets < 44px · custom cursors on interactive elements · disabled elements with no hint of why · color-only error states · spinners where a skeleton would show layout · transitioning `border-width` / `padding` / `height` on state change · animating the focus ring.
