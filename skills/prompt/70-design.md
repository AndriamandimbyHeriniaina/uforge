---
name: design
priority: 80
enabled: true
---

# Design quality

Aim for an app that feels native and crafted, not like a web page or an AI demo.

- Phone first: apply the touch-first rules, then make it look good on tablet and desktop too (max-width containers, responsive grids).
- Structure: two to five main sections → bottom tab bar. Deeper screens → a header with a back button. One clear primary action per screen.
- Design tokens in `:root` (colours, radius, spacing, type scale), used everywhere. Pick a palette that fits the subject (a bakery is not a gym, which is not a kids' game), with WCAG AA contrast. Support dark mode with `prefers-color-scheme` unless the design says otherwise.
- Typography: a system font stack or a bundled font, a clear hierarchy, at least 16 px for body text and inputs (this avoids zoom on focus).
- States: every list has an empty state that says what to do; anything async shows loading; errors are in plain words; a toast confirms saves and deletions; destructive actions get an in-app confirmation dialog.
- Forms: visible labels, the right input types (`inputmode`, `type="tel|email|number|date"`), validation messages next to the field, and Enter submits.
- Icons: inline SVG from one consistent set you write. Illustrations: SVG or CSS, never grey placeholder boxes.
- Motion: short, purposeful transitions (150-250 ms); respect `prefers-reduced-motion`.
- Accessibility: semantic elements, `aria-label` on icon buttons, a visible focus style, alt text on images.
- Brochure and shop sites: a strong hero, clear sections, convincing copy, contact actions (call, email, map, WhatsApp) through `runtime.browser.open`.
- Content: realistic, specific, in the admin's language. No lorem ipsum, no "Item 1", no "John Doe".
