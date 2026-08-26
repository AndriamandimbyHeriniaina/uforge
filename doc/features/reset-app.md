# Fonctionnalité — Nettoyer / réinitialiser

Bouton admin Builder, près du prompt. Confirmation (nom de l’app ou slider).

MVP : un bouton **Tout remettre à zéro**, confirmation en deux clics. Efface overlay + `.happ` local + draft Builder. Le compte Uforge reste.

| Action | Effet |
| --- | --- |
| Réinitialiser les données | Overlay détruit ; seed du `.happ` recopié |
| Nettoyer l’app | Overlay + `.happ` installé supprimés ; Runtime vide ; Builder et compte Uforge intacts |
| Effacer le chantier | En plus, drafts / source workspace |

Ne pas toucher aux secrets gateway ni aux autres apps éventuellement installées.
