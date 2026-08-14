# Motion Recipes

Vue-adapted implementations for the cases that come up most. Start from the recipe, then adapt. Curves are the `--ease-out` / `--ease-in-out` / `--ease-drawer` tokens from SKILL.md.

---

## Button press

Any pressable element. `scale()` scales children too — label and icons come along, which is what makes it read as a physical press.

```css
.button { transition: transform 160ms var(--ease-out); }
.button:active { transform: scale(0.96); }
```

Or just the `tap-scale` shortcut. No hover gating needed here — `:active` is a real press on touch. Gate any `:hover` styling separately.

---

## Dropdown, popover, menu, select

Scales out of its trigger, not out of thin air. The `transform-origin` is the whole point.

```vue
<Transition name="pop">
  <div v-if="open" class="popover" :style="{ transformOrigin: origin }">…</div>
</Transition>
```

```css
.popover { transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out); }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: scale(0.95); }
```

Derive `origin` from the placement side (e.g. Floating UI's `placement`: `bottom-start` → `top left`).

---

## Tooltip

Same shape as a popover, faster — plus the detail most implementations miss: once one tooltip is open, neighbours open instantly (skip both delay and animation) so the toolbar feels fast.

```css
.tooltip { transition: opacity 125ms var(--ease-out), transform 125ms var(--ease-out); }
.tip-enter-from, .tip-leave-to { opacity: 0; transform: scale(0.97); }
.tooltip[data-instant] { transition-duration: 0ms; }
```

Delay 800–1000ms on hover; **0ms on keyboard focus** — keyboard users reached it deliberately.

---

## Modal

The one popover that stays centered (not anchored to a trigger). Animate the backdrop's opacity alongside so they read as one surface. Use native `<dialog>` — see `ui-interaction-states`.

```css
.modal { transform-origin: center; transition: opacity 250ms var(--ease-out), transform 250ms var(--ease-out); }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.96); }
.backdrop { transition: opacity 250ms var(--ease-out); }
```

---

## Drawer / sheet

```css
.drawer { transform: translateY(0); transition: transform 500ms var(--ease-drawer); }
.drawer-enter-from, .drawer-leave-to { transform: translateY(100%); }
```

`translateY(100%)` moves by the element's own height whatever the content. Add drag and it becomes a gesture problem — see **Gestures** below.

---

## Toast

```css
.toast {
  opacity: 1; transform: translateY(0);
  transition: opacity 400ms ease, transform 400ms ease;
  @starting-style { opacity: 0; transform: translateY(100%); }
}
```

Plain `ease`, slightly slower than typical UI — toast motion is tuned to the component's personality (the Sonner lesson). Exit through the same edge it entered. New toasts push the stack in one direction; existing toasts never reflow the page. When toasts stack, the opacity/height balance is trial and error — adjust, then check again next day.

---

## Accordion / collapse

One of the few animations that costs layout every frame — keep it short. Measure content height in JS rather than animating to `auto`, or animate `grid-template-rows: 0fr → 1fr` on a wrapper.

```css
.content { overflow: hidden; transition: height 200ms var(--ease-out), opacity 200ms var(--ease-out); }
```

---

## Stagger a group entrance

For a list or grid the user sees occasionally — never one they pass all day. Decorative: must not block interaction.

```css
.item { opacity: 0; transform: translateY(8px); animation: fade-in 300ms var(--ease-out) forwards; }
.item:nth-child(2) { animation-delay: 100ms; }
.item:nth-child(3) { animation-delay: 200ms; }
@keyframes fade-in { to { opacity: 1; transform: translateY(0); } }
```

With `<TransitionGroup>`, set `animation-delay: calc(var(--i) * 100ms)` from a bound `--i`.

---

## List add / remove / reorder

```vue
<TransitionGroup name="list" tag="ul">
  <li v-for="item in items" :key="item.id">…</li>
</TransitionGroup>
```

```css
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(8px); }
.list-enter-active, .list-leave-active { transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out); }
.list-move { transition: transform 250ms var(--ease-in-out); } /* FLIP reorder, transform-based, free */
.list-leave-active { position: absolute; } /* so siblings can slide into place */
```

---

## Hold to confirm

For destructive actions where a plain click is too easy to slip. `linear` is correct on the fill — it's a progress indicator, and progress shouldn't ease.

```css
.overlay { clip-path: inset(0 100% 0 0); transition: clip-path 200ms var(--ease-out); } /* release: snappy */
.button:active .overlay { clip-path: inset(0 0 0 0); transition: clip-path 2s linear; } /* press: deliberate */
.button:active { transform: scale(0.96); }
```

---

## Tab indicator with a color transition

Timing individual color transitions across a tab list never lands. Duplicate the tab list, style the copy as the active state, clip it to the active tab, and animate the clip:

```css
.tabs-active-copy {
  clip-path: inset(0 60% 0 20%); /* driven by the active tab's position */
  transition: clip-path 250ms var(--ease-in-out);
}
```

Text and background change in perfect sync because one element is being revealed, not two colors interpolated. Tab **content** crossfades only — never slides sideways, never animates height.

---

## Masking a crossfade that won't settle

When two states visibly overlap during a transition and no tuning fixes it, blur the seam so the eye reads one transformation instead of two objects swapping:

```css
.content { transition: filter 200ms ease, opacity 200ms ease; }
.content.transitioning { filter: blur(2px); opacity: 0.7; }
```

Keep blur well under 20px — heavy blur is expensive, especially in Safari.

---

## Programmatic, without a library

WAAPI: hardware-accelerated, interruptible, zero bundle cost.

```js
element.animate(
  [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }],
  { duration: 1000, fill: 'forwards', easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
)
```

---

## Gestures (drag, swipe, sheets)

Springs, not durations — the user can reverse mid-motion, and springs carry velocity through the interruption. Never lock out input during a transition; on interrupt, animate from the live on-screen value, not the logical target.

**Dismiss on a flick, not just distance:**

```js
const velocity = Math.abs(swipeAmount) / elapsedMs
if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11)
  dismiss()
```

**Project momentum to pick the landing point** (Apple's exponential-decay projection — not the physics-textbook form):

```js
function project(initialVelocity /* px/s */, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate)
}
const target = nearestSnapPoint(currentPosition + project(releaseVelocity))
// then hand the release velocity to the settling spring
```

**Rubber-band past boundaries** — real things slow before they stop:

```js
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}
```

The feel checklist that separates a good drag from a bad one:

- `setPointerCapture` once the drag starts, so tracking survives leaving the element's bounds; respect the grab offset (don't snap to center).
- Multi-touch protection — `if (isDragging) return` on new touch points.
- 1:1 tracking during the gesture; feedback is continuous, never only at the end.
- Settle with `{ type: 'spring', duration: 0.5, bounce: 0.2 }`; bounce only because a flick preceded it — a menu that faded in gets no overshoot.
- Set `transform` on the dragged element directly (`el.style.transform = …`), never via a CSS variable on a parent.
- Test on a real device — connect a phone to the dev server by IP.
