# Vision Uforge (You Forge)

> **Source de vérité produit.** En cas de conflit avec une autre page, du code existant ou une habitude, cette page gagne. Validée par le porteur du projet le 2026-10-18.

## En une phrase

Uforge est une appli vide qui devient, par la conversation avec une IA, **n’importe quelle appli que le JavaScript permet**. L’admin la protège par son mot de passe, la valide (« Builder »), puis peut l’exporter dans un fichier `.happ` que d’autres installent.

## Parcours

1. **Installation** : sur téléphone (Android, Capacitor) ou sur le web.
2. **Compte admin** : au premier lancement, l’utilisateur crée son compte Uforge (email + mot de passe). Ce mot de passe protège l’atelier et chiffre ce qui en sort (appli et base de données). Sans lui, pas d’atelier et pas de prompt.
3. **Atelier** : l’admin décrit l’appli qu’il veut. Il n’y a **aucune liste de modèles** : jeu, gestion, vitrine, outil, quiz, tableau de bord… tout ce que le JS sait faire. Seules les règles de sécurité et l’environnement d’exécution limitent l’IA. Sa seule vraie limite, c’est l’imagination de l’admin.
4. **Conversation** : comme avec Claude Code ou Lovable. L’admin corrige et ajoute message après message ; l’IA modifie le code ; l’aperçu se met à jour.
5. **Brouillon** : l’admin visualise l’appli à tout moment (aperçu, plein écran). Tant qu’il ne valide pas, c’est un brouillon et l’appli « live » ne change pas.
6. **Builder** : l’admin valide. L’appli est construite en version optimisée et s’affiche seule, en plein écran. L’atelier disparaît. Pour y revenir, il faut passer par la **bulle flottante**, qui redemande le mot de passe.
7. **Export / import** : depuis l’atelier, « Exporter » produit un `.happ` qui contient tout (code, base, images). « Importer » installe un `.happ` reçu et **remplace** l’appli en place. Le destinataire utilise l’appli ; l’atelier lui reste fermé sans le mot de passe de l’admin.

## Décisions

| Question | Décision |
| --- | --- |
| Le destinataire a-t-il besoin d’un mot de passe ? | **Non.** Sauf si l’appli générée demande elle-même une connexion (c’est alors une fonction de l’appli, pas de Uforge). |
| Login de l’atelier | Le **compte Uforge de l’admin**. Qui a le mot de passe est admin et peut prompter. S’il est divulgué, c’est la responsabilité de l’admin. |
| Options d’export | **« Sans mes données »** : base vierge. **« Appli figée »** : aucun atelier possible chez le destinataire, même avec le mot de passe, donc aucun prompt sur le compte de l’admin. |
| Internet | Autorisé si l’appli générée en a besoin. Une appli qui embarque tout fonctionne hors ligne. |
| Import | Remplace l’appli installée, après confirmation. |
| Nombre d’applis | Une seule par installation. Pas de gestionnaire d’applis. |

## Ce que Uforge n’est pas

- **Pas un générateur à formulaires.** L’IA n’est pas limitée à des types de pages (« liste », « tableau de bord », « jeu »…) : elle écrit du vrai code.
- **Pas un store ni un gestionnaire multi-applis.**
- **Pas un hébergeur.** Le gateway ne stocke ni le code, ni le `.happ`, ni les données de l’appli.
- **Pas un générateur d’applis natives** (Kotlin, Swift, Unity) : tout tourne dans le Runtime (WebView).

## Glossaire

| Terme | Sens |
| --- | --- |
| Runtime | L’appli Uforge installée (web ou APK). Elle contient l’atelier et exécute l’appli générée. |
| Admin | Détenteur du compte Uforge (email + mot de passe) lié à l’appli. |
| Atelier | L’interface admin : conversation, aperçu, versions, export, import. |
| Appli | Ce que l’IA a généré. Elle tourne dans une iframe isolée. |
| Workspace / projet | Les fichiers source de l’appli, avec ses versions et la conversation. |
| Brouillon | L’état du workspace pas encore validé. |
| Builder | L’action de validation : build optimisé, puis passage en mode appli. |
| Appli live | La dernière version validée, celle qu’on utilise. |
| Bulle | Le bouton flottant qui mène à l’atelier (mot de passe). |
| `.happ` | Le fichier d’export qui contient une appli complète. |
| Appli figée | Un export sans atelier : impossible à modifier chez le destinataire. |
| Destinataire | La personne qui importe un `.happ`. |

## Historique

Le projet a dévié deux fois :

1. Premier commit : atelier multi-applis, `.happ` signé et stocké sur MinIO.
2. Commits suivants : l’IA remplissait un JSON à 4 types de pages, l’appli exigeait le mot de passe pour démarrer, et l’export/import n’existait pas.

Cette page remet le cap. Les écarts restants entre le code et la vision sont listés dans [architecture.md](architecture.md#état-du-code-octobre-2026).
