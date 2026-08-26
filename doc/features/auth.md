# Fonctionnalité — Authentifications (deux niveaux)

## Compte Uforge (gateway)

Email / mot de passe, JWT. Quotas, générations, fichiers. Rôle `ADMIN` pour lister les skills dépôt.

## Accès Builder (Runtime)

Indépendant du mot de passe **de l’app générée** (feature métier optionnelle). Le Builder est une surface privilégiée du Runtime.

Après « Utiliser mon appli », le `.happ` est chiffré sur le device. Seul l’email reste lisible. Le bouton **U** (et le premier déverrouillage après rechargement) ne demande que le **mot de passe** : il déchiffre le paquet et authentifie le gateway.

## App générée

Login utilisateurs finaux (employés, clients) = logique dans le `.happ` + overlay, pas le gateway, sauf sync future.
