---
name: hforge-happ
description: Uforge .happ file format, encryption model (K_admin / KEK / K_device / K_share), export options (without data, frozen) and atomic import. Use when editing crypto, on-device storage, export or import code.
---

# .happ, encryption, export/import

Read [doc/features/happ.md](../../../doc/features/happ.md), [doc/features/encryption.md](../../../doc/features/encryption.md) and [doc/features/export-import.md](../../../doc/features/export-import.md).

- The recipient opens the app WITHOUT a password. Only the admin block is secret (`K_admin`, wrapped by a KEK derived from the admin password). `K_share` travels in the header: it is not a secret.
- A frozen export has no admin block, so the workshop can never be opened from it.
- WebCrypto only. A random 12-byte IV per encryption. The password, KEK and `K_admin` live in RAM only.
- Import replaces the installed app atomically: write the new blocks, switch the header, then delete the old blocks.
- Never send a `.happ`, a key or the password to the gateway or the compiler.
