# Techno — Vite

Vite bundle le **Runtime** (`services/web` : atelier, bulle, pont, stockage) en dev comme pour l’APK.

Vite ne sert **pas** à builder les applis générées. C’est le rôle du service `compiler` (esbuild, voir [esbuild.md](esbuild.md)). Il n’y a plus d’« externals » partagés : chaque appli embarque ses propres dépendances, ce qui la rend autonome et utilisable hors ligne.
