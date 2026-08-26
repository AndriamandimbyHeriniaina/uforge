# Techno — Vite

Bundler du Runtime/Builder (`services/web`).

Externals du `.happ` : `runtime.*` (pont host). Le CSS guest reste une enveloppe Runtime (`wrapGuestDocument`).

Service `compiler` : esbuild headless (`POST /v1/compile`). Il minify spec + player et **renvoie** `{ bundleJs, seedSql, manifest }` ; **aucun stockage** gateway/MinIO.
