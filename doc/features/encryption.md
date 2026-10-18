# Fonctionnalité — Chiffrement

## Ce qu’on protège, et contre qui

| Menace | Protection |
| --- | --- |
| Quelqu’un copie le stockage de l’appareil ou ouvre le profil du navigateur | Tout est chiffré au repos (`K_device`, `K_admin`) |
| Le destinataire veut modifier l’appli ou prompter avec le compte de l’admin | Le bloc admin est chiffré par le mot de passe de l’admin, et le gateway exige un JWT pour prompter. Appli figée : il n’y a pas de bloc admin du tout |
| Le fichier `.happ` circule (mail, clé USB, messagerie) | Contenu illisible en l’état et intègre (tag GCM) ; bloc admin secret |
| Le destinataire veut **lire** le code de l’appli | **Impossible à empêcher** : son appareil doit exécuter ce code. Le build est minifié, sans plus. |

## Clés

| Clé | Nature | Chiffre | Où elle vit |
| --- | --- | --- | --- |
| `K_admin` | AES-256-GCM aléatoire, créée avec le compte | Bloc admin : sources, versions, conversation, pièces jointes, base d’aperçu | Jamais en clair sur disque : enveloppée par la KEK |
| KEK | Dérivée du mot de passe | `K_admin` | Jamais stockée : recalculée à chaque ouverture |
| `K_device` | AES-256-GCM, `CryptoKey` **non extractible** créée à l’installation | Build validé et base live sur l’appareil | IndexedDB (V2 : Android Keystore) |
| `K_share` | AES-256-GCM aléatoire, une par export | `app.bin` et `data.bin` dans le fichier `.happ` | En clair dans l’en-tête du fichier |

### Dérivation de la KEK

```text
pré    = HMAC-SHA-256(clé = email normalisé, message = mot de passe)
KEK    = PBKDF2-SHA-256(pré, sel = 16 octets aléatoires, 600 000 itérations) → AES-256-GCM
wrap   = AES-GCM(KEK, K_admin)        sel, itérations, iv et wrap sont stockés dans l’en-tête
```

## Pourquoi une clé aléatoire plutôt que le mot de passe direct

- Changer de mot de passe revient à ré-emballer `K_admin`, sans rien rechiffrer.
- L’export copie le bloc admin tel quel.

## `K_share` n’est pas un secret

Le destinataire doit ouvrir l’appli **sans mot de passe** (décision de [vision.md](../vision.md)), donc la clé voyage avec le fichier. Elle sert à deux choses : empêcher la lecture directe du fichier et détecter la corruption. Elle ne protège pas contre une personne déterminée qui détient le fichier. Le seul contenu réellement secret d’un `.happ` est le bloc admin.

V2 : une option « Protéger l’export par un code », où `K_share` est dérivée d’un code transmis à part.

## Appli figée

Il n’y a pas de bloc admin dans le fichier, et le drapeau `frozen: true` est posé. Il n’y a rien à déchiffrer, même avec le mot de passe. Le Runtime n’affiche pas d’entrée vers l’atelier.

## Règles

- Le mot de passe, la KEK et `K_admin` ne vivent **qu’en RAM**, et ils sont effacés à la fermeture de session.
- WebCrypto uniquement : pas de crypto maison, pas de librairie JS de chiffrement.
- AES-GCM : un IV aléatoire de 12 octets **par** chiffrement ; AAD = `appId` + nom du bloc.
- Le gateway et le compiler voient le code source le temps d’un tour ou d’un build (c’est nécessaire pour l’IA et le bundling). Ils n’en gardent rien.

## V2

- Signer les exports (ECDSA, clé publique de l’admin enregistrée au gateway) pour prouver leur origine.
- Chiffrer la base par le mot de passe de l’appli générée, quand elle a son propre login.
- Android Keystore pour `K_device`.

## Code

`services/web/src/lib/crypto.ts` (KEK, `K_admin`, `K_device`, `seal` / `open`), `core/device.ts` (blocs sur l’appareil), `core/session.ts` (session en RAM, fermeture après 15 min d’inactivité), `core/happFile.ts` (`K_share`, export et import). Testé dans un vrai navigateur : mauvais mot de passe refusé, l’appli live s’ouvre sans mot de passe, un export figé n’offre pas d’atelier, un export complet le rouvre avec le mot de passe de l’auteur.
