# Fonctionnalité — Authentifications (deux niveaux)

## Compte Uforge (gateway)

Email / mot de passe, JWT. Quotas, générations, fichiers. Rôle `ADMIN` pour lister les skills dépôt.

## Accès Builder (Runtime)

Indépendant du mot de passe **de l’app générée** (feature métier optionnelle). Le Builder est une surface privilégiée du Runtime.

## App générée

Login utilisateurs finaux (employés, clients) = logique dans le `.happ` + overlay, pas le gateway, sauf sync future.
