# Techno — Vite

Bundler du web Runtime/Builder et, plus tard, du compiler pour les apps utilisatrices.

Externals du `.happ` : `vue`, `runtime`. Sortie IIFE ou ESM selon le loader Runtime.

Service `compiler` : enveloppe Vite (headless) quand le vrai build sera branché. Stub actuel : zip manifest + placeholder JS.
