# Fonctionnalité — Réinitialiser

Depuis l’atelier, quand l’admin est connecté. Chaque action demande une confirmation. « Tout effacer » demande en plus de taper le nom de l’appli.

| Action | Effet | Ce qui est gardé |
| --- | --- | --- |
| Vider les données | Les bases live et d’aperçu sont vidées ; l’appli recrée ses données initiales au démarrage | Code, versions, conversation |
| Revenir à une version | Voir [builder.md](builder.md#versions) | Tout |
| Tout effacer | Build, base et bloc admin supprimés ; le Runtime redevient vierge (écran d’accueil) | Le compte Uforge, au gateway |

- Le gateway n’a rien à effacer, puisqu’il ne stocke pas l’appli.
- Un destinataire sans mot de passe ne peut pas réinitialiser l’appli, mais il peut en importer une autre, qui la remplace. Une appli générée peut proposer sa propre remise à zéro de ses données.
