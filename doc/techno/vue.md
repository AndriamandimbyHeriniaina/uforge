# Techno — Vue 3

Vue sert à l’UI du **Runtime** dans `services/web` : écran d’accueil, atelier, bulle, dialogues d’import et d’export. Composition API, TypeScript. Pinia est facultatif.

Les applis générées ne reçoivent **pas** Vue du Runtime. Elles utilisent ce que l’IA choisit (JS natif, Preact, Chart.js, Phaser…), déclaré dans leur `uforge.json` et embarqué par le compiler.

L’atelier et l’appli dans l’iframe ne partagent jamais le même contexte JS.
