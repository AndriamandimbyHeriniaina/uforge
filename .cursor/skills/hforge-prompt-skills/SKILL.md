---
name: hforge-prompt-skills
description: Operator-deposited markdown skills injected into every user prompt. Use when editing skills/prompt, SkillsService, or prompt-framing behaviour.
---

# Prompt skills deposit

Read [doc/features/prompt-skills.md](../../../doc/features/prompt-skills.md).

Drop markdown files in `skills/prompt/`. The gateway mounts this directory and re-reads it on each generate. Do not cache skills in Redis. Do not store skill bodies in Postgres as source of truth.
