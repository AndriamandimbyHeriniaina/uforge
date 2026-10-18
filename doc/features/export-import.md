# Fonctionnalité — Export / import

## Exporter

Depuis l’atelier, quand l’admin est connecté.

| Option | Défaut | Effet |
| --- | --- | --- |
| Inclure mes données | non | Avec : la base live part dans `data.bin`. Sans : base vide, l’appli recrée ses données initiales chez le destinataire. |
| Appli figée | non | Pas de bloc admin. Le destinataire ne pourra jamais ouvrir l’atelier, même avec le mot de passe, donc ne pourra jamais prompter avec le compte de l’admin. |

- **Prérequis** : il faut une version validée. Si le brouillon diffère de la live, l’atelier propose « Builder puis exporter » ou « Exporter la version live ».
- **Message affiché avant l’export** : « Toute personne qui a ce fichier peut utiliser l’appli. » Si l’appli n’est pas figée, il ajoute : « Avec ton mot de passe, elle pourra aussi la modifier avec ton compte. »
- **Résultat** : `<nom-de-l-appli>.happ`. Sur le web, il est téléchargé. Sur Android, il passe par la feuille de partage ou par « Enregistrer ».
- Format : [happ.md](happ.md). Le fichier ne passe jamais par le gateway.

## Importer

Points d’entrée :
- bulle → « Importer une appli », **sans mot de passe** ;
- écran d’accueil du Runtime vierge ;
- atelier → menu → « Importer une appli » ;
- Android : ouvrir un fichier `.happ` (filtres d’intention dans `AndroidManifest.xml`, pas encore testé sur appareil) ;
- web : glisser-déposer sur l’écran d’accueil.

Étapes :
1. Lire `header.json` et afficher le nom, l’icône, l’auteur, la date, les options (« figée », « contient des données ») et les capacités (« utilise la caméra, internet »).
2. Vérifier `format` et `runtimeMin`. Si le Runtime est trop ancien : « Mets à jour Uforge ».
3. Si une appli est déjà installée : « Remplacer *Appli actuelle* par *Nouvelle appli* ? Ses données seront effacées. » Il y a une double confirmation.
4. Déchiffrer `app.bin` et `data.bin` avec `K_share`, puis vérifier les tags GCM et les `sha256`.
5. Rechiffrer le build et la base avec `K_device`, et copier `admin.bin` tel quel.
6. Faire un remplacement **atomique** : écrire les nouveaux blocs, basculer l’en-tête, puis effacer les anciens. En cas d’erreur, l’appli en place reste intacte.
7. Passer en mode appli.

## Chez le destinataire

- Il utilise l’appli sans mot de passe, sauf si l’appli a son propre login.
- Sa bulle propose « Atelier » (avec le mot de passe de l’admin, email affiché) si l’appli n’est pas figée, ainsi que « Importer une appli » et « À propos ».
- S’il a le mot de passe, il devient admin sur cet appareil : même compte Uforge, même quota.
- S’il réexporte, l’en-tête garde le même `owner`.

## Erreurs

| Cas | Comportement |
| --- | --- |
| Fichier corrompu ou modifié (tag GCM, `sha256`) | Refus, l’appli en place est intacte |
| Format plus récent que le Runtime | « Mets à jour Uforge » |
| Fichier qui n’est pas un `.happ` | « Ce fichier n’est pas une appli Uforge » |

## Non prévu

- Fusionner deux applis, ou importer seulement les données : un import remplace toujours tout.
- Synchroniser entre appareils : voir [data.md](data.md#limites).
