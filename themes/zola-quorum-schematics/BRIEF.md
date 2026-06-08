# Brief — Thème Zola « blueprint × terminal »

## Mission

Construis un **thème Zola standalone, réutilisable et publiable**, qui implémente le design « plan d'architecte × terminal » décrit ci-dessous. Le thème doit pouvoir être déposé dans `themes/` de n'importe quel site Zola, ou publié sur le répertoire officiel des thèmes Zola.

Travaille en autonomie : génère l'arborescence complète, crée un site d'exemple minimal, lance `zola build` et `zola check`, corrige toutes les erreurs et warnings, itère jusqu'à ce que le build passe proprement. Ne me redemande pas de validation à chaque étape — avance jusqu'à un thème fonctionnel et testé.

## Concept de design

Le site se présente comme une **feuille de plan d'architecte** (drawing sheet) encadrée, posée sur une **grille millimétrée cyan**, mais qui « respire comme un terminal » : prompt, build log, status bar, curseur clignotant. Deux thèmes de couleur : `blueprint` (encre bleue sur papier chaud, clair) et `cyanotype` (le négatif : cyan sur bleu nuit, sombre), avec un toggle qui bascule entre les deux. Palette deux tons + un accent cyan unique. **Lisibilité d'abord** : un seul élément animé visible à la fois, tout le reste statique. Typographie 100 % monospace.

Un fichier HTML de référence complet est fourni (`reference.html`) : il contient le design cible exact (tokens CSS, structure, composants). **Reproduis fidèlement son rendu visuel**, puis généralise-le en templates Zola dynamiques. En cas de doute sur une couleur, un espacement ou un comportement, le fichier de référence fait foi.

## Composants à implémenter

Tous présents dans `reference.html` — reprends-les tels quels puis rends-les dynamiques :

1. **Cartouche de titre** (title block) en haut : project / sheet / scale / drawn by + **schéma cluster SVG** (3 nœuds, leader en cyan, une liaison active en pointillés). Configurable via `config.toml` (`extra`).
2. **Nav** avec logo `◳`, liens en style chemin (`/home`, `/blog`…), et **bouton toggle** `⊕ cyanotype` / `⊕ blueprint`.
3. **Bande console** : prompt `pierre@host:~/blog$ ./build --deterministic` + ligne de sortie `✓ N posts compiled · …` avec **curseur clignotant**. `N` = nombre réel de posts.
4. **Barre fault injection** avec bouton **chaos toggle** (`inject partition` / `heal partition`) : déclenche une bannière rouge `PARTITION DETECTED`, fait passer node-3 du schéma cluster en rouge, et bascule la status bar en `nodes: 2/3 degraded`. Entièrement opt-in (rien ne bouge sans clic).
5. **Hero** (page d'accueil) : titre souligné cyan, intro, **specs** (domain / focus / lang), **ligne de cote** (dimension line) configurable.
6. **Liste de posts = nomenclature (BOM)** : numérotée `001/002…`, date + **seed déterministe** dérivé du slug (voir plus bas), titre, description, tags. Hover : titre en cyan + `_` clignotant après le numéro.
7. **Page article** : fil d'ariane, titre, **ligne meta** (date / read-time / seed / **badge de cohérence** `consistency: linearizable`), **TOC** « index of sections » numérotée `1.0…N.0` à partir de `page.toc`, prose, citations encadrées (bordure gauche cyan).
8. **Footer** = cartouche bas : revision history + **vector clock** `logical clock: [deploy:N, edit:M, rev:X]` + liens sociaux.
9. **Status bar** fixe en bas (style tmux/htop) : `● online · uptime · last deploy · nodes: 1/1 healthy`. `last deploy` = date de build réelle.

## Exigences techniques Zola

- **Templates** : `base.html`, `index.html`, `page.html`, `section.html`, plus `taxonomy_single.html` et `taxonomy_list.html` pour les tags. Utilise l'héritage de templates (`{% extends %}`, `{% block %}`).
- **Macros / partials** : factorise le cartouche, le schéma cluster, la status bar, la nav, le footer en partials inclus (`templates/partials/`).
- **Shortcodes** : au minimum `quote(author, source)` pour les citations encadrées, et `note()` pour un callout. Documente-les dans le README.
- **TOC** : généré depuis `page.toc`, numéroté `1.0`, `2.0`, … Ancres `#` cliquables visibles au hover sur les titres `<h2>/<h3>`.
- **Coloration syntaxique** : `highlight_code = true`, `highlight_theme = "css"`, génère **deux feuilles** (une claire, une sombre) chargées selon le thème actif. Choisis des thèmes syntect cohérents avec la palette.
- **Recherche** : active `build_search_index = true` (elasticlunr) et fournis un champ de recherche client minimal optionnel.
- **RSS / Atom + sitemap** : activés.
- **Taxonomies** : `tags` configurées, page d'index des tags.
- **Pas de dépendance CDN** : self-host la police monospace (fournis JetBrains Mono ou équivalent libre dans `static/fonts/`, avec `font-display: swap`). CSS et JS dans des fichiers séparés sous `static/`, pas d'inline massif.

## Seed déterministe & vector clock (la signature)

- **Seed** : pour chaque post, dérive un seed hex stable du `page.slug` (hash simple reproductible — implémente-le dans un template filter ou via `get_hash` de Zola si dispo, sinon un calcul Tera déterministe). Affiché sous la date dans la BOM et dans la ligne meta. Le même slug doit toujours donner le même seed.
- **Vector clock** : dans le footer, dérivé de métadonnées de build (nombre de posts, date, version). Cosmétique mais stable.
- **Build log** : le `✓ N posts compiled` doit refléter le **vrai** nombre de posts via `get_section` / pagination.
- **Badge de cohérence** : lisible depuis un champ `extra.consistency` du front-matter de l'article (`linearizable`, `eventually-consistent`, etc.), avec une valeur par défaut.

## Thèmes de couleur & accessibilité

- Deux thèmes via `data-theme` sur `<html>` : `blueprint` (clair) et `cyanotype` (sombre, = négatif).
- Toggle en JS vanilla, **persiste le choix** (localStorage) et respecte `prefers-color-scheme` au premier chargement.
- Vise WCAG AA sur les contrastes texte/fond dans les deux thèmes. Vérifie les ratios.
- Le chaos toggle et le cyanotype flip sont deux boutons distincts, indépendants.

## Responsive

Le design est pensé desktop-first (cartouche multi-colonnes, BOM en grille, status bar fixe). **Soigne le mobile** : le cartouche doit se replier proprement (pas de débordement), la nav passe en menu compact, la BOM en pile, la status bar et la bannière chaos ne doivent pas masquer le contenu. Teste mentalement à 360px de large.

## Livrables & structure attendue

```
.
├── theme.toml              # métadonnées du thème (nom, auteur, licence, min_version, demo)
├── README.md               # install, config extra documentée, shortcodes, captures
├── LICENSE                 # MIT
├── config.toml             # config du site d'exemple (sert de doc vivante)
├── content/                # site d'exemple : 3-4 posts dont un long (avec code + citations + TOC)
├── templates/
│   ├── base.html
│   ├── index.html
│   ├── page.html
│   ├── section.html
│   ├── taxonomy_single.html
│   ├── taxonomy_list.html
│   ├── partials/           # cartouche, cluster, statusbar, nav, footer
│   └── shortcodes/         # quote, note
├── static/
│   ├── css/                # main.css + syntax-light.css + syntax-dark.css
│   ├── js/                 # theme-toggle.js, chaos.js, search.js
│   └── fonts/              # police mono self-hosted
└── screenshot.png          # capture pour le répertoire de thèmes (si possible)
```

`theme.toml` doit suivre le format attendu par le répertoire officiel Zola (champs `name`, `description`, `license`, `homepage`, `min_version`, section `[extra]` documentant les options). Le README doit lister **toutes** les clés `extra` configurables (textes du cartouche, identité du prompt, libellés de la status bar, nœuds du cluster, activation/désactivation du chaos toggle, etc.) avec leurs valeurs par défaut.

## Critères de réussite (vérifie-les avant de conclure)

1. `zola build` et `zola check` passent sans erreur ni warning sur le site d'exemple.
2. `zola serve` rend une home + un article + une page de tags fidèles à `reference.html` dans les deux thèmes.
3. Le toggle clair/sombre fonctionne, persiste, et part de `prefers-color-scheme`.
4. Le chaos toggle déclenche bannière + cluster rouge + status bar dégradée, et se rétablit.
5. Le seed d'un post est stable et identique pour un slug donné.
6. Le build log affiche le vrai nombre de posts.
7. Tout fonctionne sans connexion (zéro CDN), police incluse.
8. Le mobile ne casse pas le cartouche et reste lisible.
9. README complet : un inconnu peut installer le thème et le configurer sans lire le code.

## Notes de style

- Monospace partout. Bordures fines `1px` plutôt qu'ombres. Grille de fond très discrète.
- Accent cyan **unique** — ne multiplie pas les couleurs vives. Le rouge est réservé aux états de panne (chaos, révisions).
- Garde les longs articles parfaitement lisibles : largeur de ligne ~68-70ch, contraste suffisant, aucun effet qui bouge pendant la lecture.
- Le ton « dist sys » (cluster, seed, vector clock, consistency, partition) est la personnalité du thème — assume-le, mais sans transformer le site en démo technique illisible.

## Itération

Si une feature est ambiguë, choisis l'option la plus sobre et la plus lisible, documente ton choix dans le README, et continue. Ne bloque pas. À la fin, fournis un court récapitulatif : ce qui est fait, les choix notables, et toute limite connue.
