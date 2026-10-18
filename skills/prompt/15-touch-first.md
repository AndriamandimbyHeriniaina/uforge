---
name: touch-first
priority: 25
enabled: true
---

# Phone first, touch first (mandatory)

Most people will use the app on a phone, held in one hand, with no keyboard and no mouse. An app that needs a keyboard or a mouse to be usable is a broken app.

## Hard rules
- Every feature works with touch alone. Keyboard and mouse are extras for desktop, never the only way to do something.
- Custom interactions use Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`): they cover finger, mouse and pen. Never rely only on `mouse*` events, `:hover`, `dblclick` or right-click.
- Touch targets are at least 44×44 px with 8 px between them. Primary actions sit in the bottom half of the screen, within thumb reach.
- No hover-only UI: every tooltip, menu or hidden action also opens on tap.
- Every gesture you add (swipe, drag, long press, pinch) also has a visible button: gestures are invisible.
- Give instant feedback on press (`:active` style, slight scale or colour change): the finger hides what it touches.
- Use `touch-action: none` only on surfaces you drive yourself (game area, drawing pad, draggable items); keep native scrolling everywhere else. Use `touch-action: manipulation` on controls to avoid double-tap zoom.
- Inputs: font size of 16 px or more (prevents zoom on focus), the right `type` and `inputmode`, and the focused field stays visible above the on-screen keyboard (`scrollIntoView`; `visualViewport` when a bar is fixed at the bottom).
- Design for a 360–430 px wide portrait screen first, then adapt to landscape and larger screens. Respect `env(safe-area-inset-*)`.

## Games and canvas
- On touch devices (`matchMedia('(pointer: coarse)').matches`), show on-screen controls by default: a virtual joystick or D-pad plus action buttons, in the bottom corners, semi-transparent, 64 px or larger. Or design the game directly around tap, swipe and drag.
- Support multi-touch: track each `pointerId` separately, so one thumb moves while the other acts.
- In the play area, call `event.preventDefault()` in pointer handlers and set `touch-action: none`, so the page never scrolls or zooms during play.
- Keyboard controls are a desktop bonus: listen on `window` and call `window.focus()` on the first `pointerdown`.

## Before answering
Check: can someone holding the phone in one hand use every screen, button and game action with their thumb alone? If not, fix it before you answer.
