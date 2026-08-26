# Techno — Redis

Rate limiting des `POST /v1/ai/generate` (fenêtre glissante par `userId`).

Cache optionnel des sessions JWT (blacklist logout, plus tard).

Ne pas y mettre les skills : elles sont des fichiers, relues à chaque prompt.
