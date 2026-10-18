# Fonctionnalité — Atelier (interface admin)

L’atelier est l’endroit où l’admin construit son appli en conversation avec l’IA. Il n’est accessible qu’avec le mot de passe admin (voir [auth.md](auth.md)) et n’est jamais exposé à l’appli générée (aucun `openBuilder()`).

## Écran

- **En haut** : aperçu du brouillon (iframe). **En bas** : conversation. Ce sont deux blocs distincts, sans calque au-dessus de l’iframe, sinon les taps mobiles ne l’atteignent pas.
- **Plein écran** : teste le brouillon comme une vraie appli. Une poignée discrète ramène à l’atelier.
- **Actions** : **Builder** · Versions · Exporter · Télécharger le code (.zip des sources du brouillon, pour l’admin) · Importer · Réinitialiser.

## Conversation (façon Claude Code / Lovable)

- L’admin écrit, l’IA répond en streaming. Les fichiers modifiés apparaissent en **pastilles** (« ✎ Panier », « + Écran contact ») pendant l’écriture. Le code n’est jamais affiché dans la bulle de chat.
- Pièces jointes : images (logo, photos, capture d’une appli qui inspire) et fichiers texte ou tableur. Voir [attachments.md](attachments.md).
- À chaque tour, l’atelier envoie le workspace complet. Voir le contrat dans [gateway.md](gateway.md).
- L’IA agit directement : dès le premier message, elle livre une première version complète. Elle ne pose une question que si c’est vraiment bloquant. Comportement défini par `skills/prompt/50-workflow.md`.
- Un tour est **atomique** : soit toutes ses opérations s’appliquent, soit aucune.

## Brouillon et aperçu

- Le workspace (fichiers source) **est** le brouillon. Il vit sur l’appareil, chiffré dans le bloc admin, et survit aux rechargements.
- Après chaque tour qui modifie des fichiers : `POST /v1/build { mode: "preview" }`, puis affichage dans l’iframe.
- L’aperçu utilise une **base d’aperçu**, pas la base live. Tester ne pollue donc pas les vraies données. Un sélecteur au-dessus de l’aperçu propose « Vraies données » (copie fraîche de la base live à chaque ouverture de l’atelier) ou « Base vide ». Voir [data.md](data.md#base-live-et-base-daperçu).
- `runtime.app.mode === "preview"` dans l’aperçu.

## Erreurs et « Corriger »

- Dans l’aperçu, le Runtime injecte un collecteur qui remonte les erreurs JS, les promesses rejetées et les `console.error`. Les erreurs de build du compiler remontent aussi.
- Un bandeau s’affiche : « L’appli a rencontré un problème ». Le bouton **Corriger** lance un nouveau tour avec les erreurs dans `errors`.
- Une opération `uf-edit` qui ne s’applique pas est relancée une fois par le gateway. Si elle échoue encore, le tour est marqué en échec et le workspace reste intact.

## Versions

- Chaque tour qui modifie des fichiers crée une **version** : numéro, date, message de l’admin, chemins modifiés.
- « Revenir à cette version » crée une nouvelle version identique à l’ancienne : rien n’est détruit.
- Stockage : instantanés dédupliqués par hash de fichier, dans le bloc admin. On garde les 50 dernières versions (réglable).

## Builder (valider)

1. `POST /v1/build { mode: "production" }`. Voir [compiler.md](compiler.md).
2. L’appli live passe à cette version. La base live est conservée et le nouveau code applique ses migrations au démarrage.
3. La session admin se ferme ; le Runtime passe en mode appli.

Tant que l’admin ne refait pas Builder, l’appli live ne change pas, même si le brouillon évolue.

## Code

`services/web/src/core/workshop.ts` (tours, aperçu, versions, Builder) et `components/Workshop.vue` (écran).

## Projet initial

Gabarit minimal créé avec le compte (version 1) : `uforge.json`, `assets/icon.svg`, `index.html`, `src/main.js`, `src/styles.css`. Il affiche un seul écran, « Ton appli commence ici », que l’IA remplace au premier tour.
