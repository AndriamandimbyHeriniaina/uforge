---
name: hforge-prompt-skills
description: Operator-deposited markdown skills that frame the generation AI (identity, uf-* output protocol, sandbox environment, runtime API, project format, workflow, data, design, games). Use when editing skills/prompt, SkillsService, or prompt-framing behaviour.
---

# Prompt skills deposit

Read [doc/features/prompt-skills.md](../../../doc/features/prompt-skills.md).

- The gateway re-reads `skills/prompt/*.md` on each generate. Do not cache skills in Redis or store their bodies in Postgres.
- Budget: `HFORGE_SKILLS_MAX_CHARS` (default 32000). The loader silently drops every skill after the first one that overflows. Keep the total under ~28000 characters and the critical skills (safety, platform, output protocol) first.
- Skills describe an environment and a quality bar, not a catalogue. Never add a closed list of app or page types.
- `30-runtime-api.md` must match `doc/features/device-bridge.md`; `10-output-protocol.md` must match the gateway parser.
- Bodies in English; the AI answers in the admin's language.
