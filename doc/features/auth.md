# Fonctionnalité — Compte admin et accès

## Compte admin = compte Uforge

- Créé au premier lancement (email + mot de passe) via `POST /v1/auth/register`. Il faut du réseau.
- Minimum de 8 caractères (règle actuelle du gateway). L’écran affiche un indicateur de robustesse et prévient : **mot de passe perdu = atelier perdu** (personne ne peut déchiffrer le bloc admin).
- Le mot de passe sert à deux choses :
  1. se connecter au gateway (JWT) pour prompter ;
  2. dériver la KEK qui ouvre le bloc admin (voir [encryption.md](encryption.md)).
- Il n’est **jamais stocké** : ni `localStorage`, ni `sessionStorage`, ni disque. Il reste en RAM pendant la session atelier, puis il est effacé.

## Ouvrir l’atelier

Bulle → « Atelier » → mot de passe. L’email est pré-rempli depuis l’en-tête de l’appli installée.

1. **Preuve locale** : la KEK déchiffre `K_admin`, puis le bloc admin. Un échec signifie un mauvais mot de passe.
2. **Session gateway** : `POST /v1/auth/login`, qui renvoie un JWT pour les tours de conversation.

Hors ligne, seule l’étape 1 passe : l’atelier s’ouvre sans prompt (versions, export, réinitialisation).

La session se ferme au **Builder**, à la fermeture de l’atelier, et après 15 minutes d’inactivité. Elle efface de la RAM le mot de passe, la KEK, `K_admin` et le JWT.

## Destinataire d’un `.happ`

- Il utilise l’appli **sans mot de passe**.
- Si l’appli n’est pas figée et qu’il connaît le mot de passe de l’admin, il ouvre l’atelier comme l’admin : même compte, même quota. C’est la responsabilité de l’admin.
- Si l’appli est figée, il n’y a pas de bloc admin : la bulle ne propose pas d’atelier.

## Connexion dans l’appli générée

Si l’admin demande une appli avec login (employés, clients, code PIN), c’est une **fonction de l’appli générée** : une table `users` avec des mots de passe hachés, écrite par l’IA. Elle n’a aucun lien avec le compte Uforge. Voir [data.md](data.md) et la skill `skills/prompt/60-data.md`.

## Changement de mot de passe (V2)

`POST /v1/auth/password` côté gateway, puis ré-emballage local de `K_admin` avec la nouvelle KEK, qui exige l’ancien mot de passe. Les `.happ` déjà exportés restent liés à l’ancien mot de passe.

## Rôle `ADMIN` du gateway

`UserRole.ADMIN` désigne l’**opérateur de la plateforme** Uforge : il voit `GET /v1/skills` et n’a pas de limite de quota. Ce n’est pas « l’admin d’une appli », qui est tout utilisateur propriétaire de son appli. Ne pas confondre les deux.
