# KYB Graph — Design system

> **Contrat de design.** Les valeurs vivent dans `src/styles/design-tokens.css`.
> Elles sont exposées à Tailwind par `src/app/globals.css` (`@theme inline`) et
> consommées par les primitives de `src/components/{ui,shell,empty}`.
> Prévisualisation vivante : **`/design-system`** (interne, non indexée, non liée).
> Le contrat est vérifié par `src/tests/unit/design-{tokens,contract,primitives}.spec.ts`.

## 1. Direction artistique

Console d'investigation et de conformité : **sombre, précise, institutionnelle,
contemporaine**. Data-dense mais lisible, jamais « jeu », « crypto », cyberpunk ni
tableau de bord marketing.

| Principe | Traduction |
| --- | --- |
| **Profondeur par superposition** | Cinq surfaces d'un noir profond virant au bleu nuit (`--canvas-sunken` → `--surface-3`). Jamais un aplat gris neutre. |
| **Un accent, cinq teintes de risque** | Cyan lumineux pour agir, sélectionner, signaler l'actif, confirmer une connexion. Succès · vigilance · critique · information · neutre : strictes et constantes dans toute l'application. |
| **Effets au service de la hiérarchie** | Grille technique très discrète, halos diffus et contrôlés, bordures froides à faible opacité, ombres profondes mais discrètes. Rien de décoratif. |
| **Dense mais lisible** | AA partout (testé), grille de 4 px, chiffres tabulaires, légendes en capitales, une seule police d'affichage. |
| **Mouvement fonctionnel** | 120–220 ms, états par couleur / bordure / halo, entrée de panneau = translation légère + opacité + ressort doux. Respecte `prefers-reduced-motion`. |

Le thème **sombre est le défaut** (`:root`). Le thème clair « Registre » (`.light`)
reste disponible (impression, DSI) avec les mêmes noms de tokens.

## 2. Où vivent les choses

| Fichier | Rôle |
| --- | --- |
| `src/styles/design-tokens.css` | **Source unique des valeurs** : couleurs (OKLCH), surfaces, bordures, élévations, halos, opacités, z-index, mise en page, espacement, tailles et graisses typographiques, motion. |
| `src/app/globals.css` | Expose les tokens à Tailwind (`@theme inline`), couche de base (bordure froide par défaut, focus, sélection, reduced-motion), keyframes et utilitaires `motion-*`, `transition-ui`, `text-eyebrow`, `bg-tech-grid`. Héberge aussi les styles historiques non migrés (graphe, secteurs, démo). |
| `src/lib/design/tone.ts` | Vocabulaire des teintes (`Tone`, `RISK_TONES`) et classes Tailwind associées (`TONE_STYLES`, `TONE_CSS_VAR`). |
| `src/lib/design/domain-tones.ts` | Pont domaine → teinte (statut de dossier, origine, sévérité, preuve, score). |
| `src/lib/design/motion.ts` | Miroir TypeScript des durées / courbes / distances (parité testée). |
| `src/lib/design/color.ts` | Lecture OKLCH, composition alpha, contraste WCAG — utilisée par les tests et la prévisualisation uniquement. |
| `src/components/ui/*` | Primitives (Radix + cva, convention shadcn). |
| `src/components/shell/*` | Coque : `AppShell`, `Sidebar`, `TopBar`, `PageHeader`, `BrandMark`. |
| `src/components/empty/*` | États : `EmptyState`, `LoadingState`, `ErrorState`. |
| `src/components/design-system/*` + `src/app/design-system/page.tsx` | Page de prévisualisation. |

> **Note build.** Next.js (Lightning CSS) peut re-sérialiser les couleurs OKLCH en
> hexadécimal ou `lab()` dans le CSS livré. Le contrat reste **écrit en OKLCH** ;
> les valeurs sRGB ci-dessous sont les équivalents calculés.

## 3. Palette réelle

Valeurs : sombre (défaut) · clair « Registre ». Chaque couleur est vérifiée dans le
gamut sRGB (aucun écrêtage). Classes Tailwind entre parenthèses.

### 3.1 Surfaces — profondeur par superposition

| Token | Sombre | Clair | Usage |
| --- | --- | --- | --- |
| `--canvas-sunken` (`bg-sunken`) | `#05090c` | `#eef0f3` | Puits : champs de saisie, scène, code, aperçus. |
| `--background` (`bg-background`) | `#0a0f12` | `#f9fafc` | Toile de fond de l'application (= accueil « Nuit » / « Registre »). |
| `--surface` (`bg-surface`, `bg-card`) | `#0f171e` | `#ffffff` | Panneau, carte — niveau 1. |
| `--surface-2` (`bg-surface-2`, `bg-accent`) | `#141f29` | `#f2f5f8` | Surélevé : survol de ligne, onglet actif — niveau 2. |
| `--surface-3` (`bg-surface-3`, `bg-popover`) | `#1b2834` | `#ffffff` | Surcouche : menu, dialogue, tiroir, infobulle — niveau 3. |
| `--sidebar` (`bg-sidebar`) | `#060b0f` | `#f1f4f7` | Barre latérale (plus profonde que la toile). |
| `--overlay` (`bg-overlay`) | `#000203` à 66 % | `#151b24` à 42 % | Voile derrière un modal. |

En sombre l'ordre est strictement croissant en luminance (testé) ; plus une
surface est « proche » de l'utilisateur, plus elle est claire et teintée de bleu
nuit. En clair, l'élévation passe surtout par l'ombre (les niveaux ne sont pas
monotones).

### 3.2 Texte

| Token | Sombre | Clair | Usage |
| --- | --- | --- | --- |
| `--foreground` (`text-foreground`) | `#f1f4f6` | `#151b24` | Texte principal (= accueil `--ink`). |
| `--muted-foreground` (`text-muted-foreground`) | `#a4acb1` | `#50565e` | Texte secondaire (= `--ink2`). |
| `--foreground-subtle` (`text-subtle`) | `#929a9f` | `#5f646b` | Tertiaire : métadonnées, unités, légendes (AA sur toutes les surfaces). |
| `--foreground-disabled` (`text-disabled`) | `#636a6f` | `#8b8f95` | Désactivé — exempté de contraste (WCAG 1.4.3). |

### 3.3 Bordures froides, à faible opacité

Les bordures sont des teintes **froides translucides** : elles s'adaptent à la
surface qu'elles bordent (superposition). Par défaut, tout élément reçoit
`--border` (couche de base de `globals.css`).

| Token | Sombre | Clair | Usage |
| --- | --- | --- | --- |
| `--border-subtle` (`border-border-subtle`) | `#bad6e2` à 7 % | `#242e3d` à 7 % | Séparateur discret : lignes de tableau, listes. |
| `--border` (`border-border`) | `#bad6e2` à 12 % | `#242e3d` à 12 % | Filet par défaut : cartes, panneaux, topbar. |
| `--border-strong` (`border-border-strong`) | `#b5d8e3` à 22 % | `#242e3d` à 22 % | Appuyée : carte surélevée, bouton outline, infobulle. |
| `--border-control` (`border-control`) | `#717c84` | `#7b8189` | **Frontière d'un champ** : ≥ 3:1 sur toutes les surfaces (WCAG 1.4.11). |

### 3.4 Action, focus, sélection, signal actif

| Token | Sombre | Clair | Usage |
| --- | --- | --- | --- |
| `--primary` (`bg-primary`, `text-primary`) | `#56d3da` | `#2460b7` | Action principale, focus (`--ring`), sélection, onglet / entrée active, connexion confirmée. Cyan en sombre (= accueil `--accent`), bleu « Registre » en clair. |
| `--primary-hover` (`bg-primary-hover`) | `#9deff3` | `#0f4ea3` | Survol de l'action (= accueil `--accent-hi`). |
| `--primary-foreground` (`text-primary-foreground`) | `#01151b` | `#f9fafc` | Texte sur aplat d'accent (= `--on-accent`). |

L'accent **n'est jamais** un niveau de risque : pas de « ok » ni de « danger » en
cyan.

### 3.5 Teintes sémantiques de risque — strictes et constantes

Cinq teintes, un seul sens chacune, partout (pastilles, métriques, légendes,
graphe, exports). Une teinte accompagne **toujours** un libellé, une icône ou un
style de trait : la couleur ne porte jamais seule l'information.

| Token | Sombre | Clair | Sens | Exemples |
| --- | --- | --- | --- | --- |
| `--tone-success` (`text-tone-success`) | `#67d283` | `#1b6c3a` | Succès / prêt | Dossier prêt, source live, score calculé |
| `--tone-vigilance` (`text-tone-vigilance`) | `#ebb16c` | `#965311` | Vigilance / à vérifier | Enrichissement, mode démo, preuve inférée (= accueil `--warn`) |
| `--tone-critical` (`text-tone-critical`) | `#f97770` | `#b61537` | Critique | Erreur, sévérité haute, échec de source |
| `--tone-info` (`text-tone-info`) | `#75aef5` | `#025884` | Information | Donnée de démonstration, sévérité « info » |
| `--tone-neutral` (`text-tone-neutral`) | `#a4acb1` | `#50565e` | Neutre | Brouillon, absence de valeur |
| `--on-tone` (`text-on-tone`) | `#01151b` | `#f9fafc` | Texte sur aplat de teinte | Badge `appearance="solid"` |

Déclinaisons : texte `text-tone-*` · point `bg-tone-*` · pastille `border-tone-*/30
bg-tone-*/12 text-tone-*` · contour `border-tone-*/50` · aplat `bg-tone-* text-on-tone`
— toutes dans `TONE_STYLES` (`src/lib/design/tone.ts`).

Distance perceptuelle OKLab ≥ 0,08 entre l'accent et les cinq teintes, deux à deux,
dans les deux thèmes (testé). L'information passe d'un bleu-violet (sombre) à un bleu-pétrole
(clair) pour rester distincte de l'accent de chaque thème.

### 3.6 Niveaux de preuve (traits, légendes)

La preuve **n'est pas un risque** : jamais de rouge pour « simulé ».

| Token | Sombre | Clair | Trait |
| --- | --- | --- | --- |
| `--proof-confirmed` | → `--primary` | → `--primary` | plein, accent (connexion confirmée) |
| `--proof-declared` | → `--border-control` | → `--border-control` | plein fin, neutre |
| `--proof-inferred` | → `--tone-vigilance` | → `--tone-vigilance` | tirets + « à vérifier » |
| `--proof-simulated` | `#9ea6ab` | `#50565e` | pointillés, neutre |

Tous ≥ 3:1 sur les surfaces d'usage (testé). Le style de trait (plein / tirets /
pointillés) double l'encodage couleur.

### 3.7 Élévations et halos

| Token | Rôle | Classe |
| --- | --- | --- |
| `--elevation-xs` | Contrôle (champ) | `shadow-xs` |
| `--elevation-sm` | Carte, panneau, onglet actif | `shadow-sm` |
| `--elevation-md` | Menu, popover, infobulle, carte surélevée | `shadow-md` |
| `--elevation-lg` | Dialogue, tiroir | `shadow-lg` |
| `--glow-primary` | Halo diffus d'accent : survol d'une action / carte interactive, sélection | `shadow-glow` |

En sombre : ombre noire profonde + arête haute `inset` à 3–6 % (lumière froide).
En clair : ombre encre à faible opacité.

### 3.8 Grille technique

`--grid-line` (`bg-tech-grid`) : réseau de lignes de 1 px tous les 32 px à 5 %. À
n'utiliser que lorsqu'elle porte la hiérarchie (`AppShell canvas="grid"`, scène
de graphe) — **jamais** sous du texte dense. Pas de bruit.

### 3.9 Rôles shadcn et alias historiques

`--card`, `--popover`, `--secondary`, `--muted`, `--accent`, `--destructive`,
`--input`, `--ring`, `--sidebar-*` sont des **alias** des tokens ci-dessus (section 3
de `design-tokens.css`) : ils gardent les composants shadcn fonctionnels. Attention,
`--accent` est le *fond de survol* shadcn (= `--surface-2`), pas l'accent de marque
(`--primary`).

`--violet`, `--teal`, `--teal-2`, `--emerald`, `--amber`, `--red` sont des alias
**historiques** (≈ 120 usages, `text-violet`, `bg-emerald/10`…) : ne pas les
utiliser dans du nouveau code. Ils suivent la palette (violet/teal → `--primary`,
emerald → `--tone-success`, amber → `--tone-vigilance`, red → `--tone-critical`).
Exception documentée : en mode clair, `--violet` / `--teal` restent le teal clair
d'origine (`#15c2b8`) tant que ~20 boutons historiques posent `bg-violet` +
`text-[#04201d]` (texte sombre figé).

## 4. Règles de contraste

Seuils : texte **≥ 4,5:1** (AA) ; éléments d'interface et traits porteurs
d'information **≥ 3:1** (WCAG 1.4.11). Valeurs mesurées sur les surfaces d'usage
(ratios WCAG 2.x), testées dans les deux thèmes :

| Sombre — texte \ fond | `--background` | `--surface` | `--surface-2` | `--surface-3` |
| --- | --- | --- | --- | --- |
| `--foreground` | 17,4 | 16,4 | 15,1 | 13,6 |
| `--muted-foreground` | 8,4 | 7,8 | 7,2 | 6,5 |
| `--foreground-subtle` | 6,7 | 6,3 | 5,8 | 5,2 |
| `--primary` | 10,8 | 10,1 | 9,3 | 8,4 |
| `--tone-success` | 10,2 | 9,6 | 8,8 | 7,9 |
| `--tone-vigilance` | 10,1 | 9,5 | 8,8 | 7,9 |
| `--tone-critical` | 7,2 | 6,8 | 6,3 | 5,6 |
| `--tone-info` | 8,4 | 7,9 | 7,3 | 6,5 |

| Clair — texte \ fond | `--background` | `--surface` | `--surface-2` | `--surface-3` |
| --- | --- | --- | --- | --- |
| `--foreground` | 16,6 | 17,3 | 15,8 | 17,3 |
| `--muted-foreground` | 7,1 | 7,4 | 6,8 | 7,4 |
| `--foreground-subtle` | 5,7 | 6,0 | 5,4 | 6,0 |
| `--primary` | 5,9 | 6,1 | 5,6 | 6,1 |
| `--tone-success` | 6,2 | 6,5 | 5,9 | 6,5 |
| `--tone-vigilance` | 5,7 | 5,9 | 5,4 | 5,9 |
| `--tone-critical` | 6,4 | 6,7 | 6,1 | 6,7 |
| `--tone-info` | 7,4 | 7,7 | 7,0 | 7,7 |

Autres paires testées : `--primary-foreground` sur `--primary` / `--primary-hover`
(10,4 sombre · 5,9 clair), `--on-tone` sur les aplats de teinte (≥ 7,0 sombre ·
≥ 5,7 clair), pastille « soft » (teinte sur teinte à 12 %) ≥ 4,5, `--border-control`
et `--ring` ≥ 3:1 (3,6–4,5 pour la frontière de champ).

Règles d'usage :

1. **Jamais une teinte seule** : libellé, icône ou style de trait en plus.
2. **Texte sur teinte** : pastille « soft » (teinte sur son propre fond à 12 %) ou
   aplat avec `text-on-tone` — jamais du blanc ou noir arbitraire.
3. **Champs** : `border-control` (≥ 3:1), fond `bg-sunken`.
4. **Focus** : contour plein 2 px `--ring` (≥ 9:1 en sombre) — ne jamais le
   supprimer sans équivalent (`outline-none` + anneau `ring-ring/50` + bordure).
5. **États désactivés** : exemptés ; rester lisibles (`--foreground-disabled`).
6. **Texte < 12 px** (`text-micro`) : réservé aux unités et légendes tertiaires.

## 5. Typographie

> **Aucune nouvelle police.** Le design system n'utilise que ce que
> `src/app/layout.tsx` charge déjà — vérifié par `design-contract.spec.ts`.

| Rôle | Police | Classe | Graisses d'usage |
| --- | --- | --- | --- |
| Texte, interface | **Inter** (`--font-inter`) | `font-sans` (défaut du `body`) | 400 · 500 · 600 |
| Titres d'affichage | **Space Grotesk** (`--font-space-grotesk`) | `font-display` | 600 · 700 |
| Empreintes, digests, raccourcis | pile monospace système (aucune police chargée) | `font-mono` | 400 |

Échelle — les valeurs sont celles de l'échelle Tailwind, que l'application a
toujours utilisée, plus un cran « micro ». Elles vivent en tokens
(`--font-size-*` / `--line-height-*`) exposés à Tailwind sous leurs noms habituels :

| Classe | Tokens | Taille / interligne | Usage |
| --- | --- | --- | --- |
| `text-micro` | `--font-size-micro` · `--line-height-micro` | 11 px / 16 | Unités, légendes tertiaires, `<kbd>` |
| `text-xs` | `--font-size-xs` · `--line-height-xs` | 12 px / 16 | Aide, métadonnées, pastilles, en-têtes de tableau, `text-eyebrow` |
| `text-sm` | `--font-size-sm` · `--line-height-sm` | 14 px / 20 | **Texte d'interface par défaut** |
| `text-base` | `--font-size-base` · `--line-height-base` | 16 px / 24 | Corps de lecture |
| `text-lg` | `--font-size-lg` · `--line-height-lg` | 18 px / 28 | Titre de panneau / dialogue |
| `text-xl` | `--font-size-xl` · `--line-height-xl` | 20 px / 28 | Titre de section |
| `text-2xl` | `--font-size-2xl` · `--line-height-2xl` | 24 px / 32 | **Titre de page** (`PageHeader`) — `font-display font-bold` |
| `text-3xl` | `--font-size-3xl` · `--line-height-3xl` | 30 px / 36 | Chiffres clés (`KpiCard`), titres d'états plein écran |

Graisses — `--weight-regular` 400 (`font-normal`) · `--weight-medium` 500
(`font-medium`) · `--weight-semibold` 600 (`font-semibold`) · `--weight-bold` 700
(`font-bold`). Interlettrage des légendes : `--tracking-caps` 0,025 em (= `tracking-wide`).

Règles : `tabular-nums` pour tout nombre comparable ; légendes `text-eyebrow`
(capitales, 12 px, 600, `--tracking-caps`, tertiaire) ; **pas** de graisse 300 / 800 /
900, **pas** d'interlettrage ajouté aux titres, **pas** de `text-[Npx]`.

## 6. Échelles

| Échelle | Valeurs | Notes |
| --- | --- | --- |
| **Espacement** | unité `--space-unit` 4 px (= `--spacing` Tailwind) · `--space-0` 0 · `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32 · `--space-10` 40 · `--space-12` 48 · `--space-16` 64 | En classes : `p-2`, `gap-3`… (mêmes valeurs). Les `--space-*` servent aux styles inline / SVG. 8 petit écart · 12 gouttière de contrôle · 16 padding de panneau · 24 gouttière de page |
| **Rayons** | `rounded-sm` 4 · `rounded-md` 6 · `rounded-lg` 8 · `rounded-xl` 12 · `rounded-full` | `--radius` = 0,5 rem (panneau). Contrôles 6, panneaux 8, surcouches 12, puces ronds |
| **Élévations** | `shadow-xs` … `shadow-lg`, `shadow-glow` | Voir § 3.7 |
| **Opacités** | `--opacity-disabled` 0,5 · `--opacity-tint` 0,12 · `--opacity-tint-strong` 0,2 · `--opacity-border-tone` 0,3 · `--opacity-hover-fill` 0,6 | Teinte de pastille = `/12`, bordure = `/30`, survol de ligne = `bg-muted/60` |
| **z-index** | `--z-base` 0 · `--z-raised` 10 · `--z-sticky` 20 · `--z-floating` 30 · `--z-overlay` 50 · `--z-toast` 60 · `--z-skip-link` 100 | Toute couche portalisée (menu, dialogue, tooltip) partage `--z-overlay` ; l'ordre du DOM les départage. Jamais de `z-[…]` brut. |
| **Mise en page** | `--layout-sidebar-width` 15 rem · `--layout-topbar-height` 3,5 rem · `--layout-page-gutter` 1,5 rem · `--layout-page-max` 72 rem · `--layout-reading-max` 48 rem · `--layout-panel-width` 22 rem | Largeur de page : `max-w-[var(--layout-page-max)]` |
| **Breakpoints** | `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536 | `md` : la sidebar remplace le tiroir · `lg` : panneaux latéraux persistants · `xl` : tables denses sans défilement |

## 7. Composants

Principe : **un composant extensible n'est pas dupliqué.** `Card`, `Badge`,
`Button`, `Tabs`, `Table`, `Dialog`, `Sheet`, `Tooltip`, `EmptyState` sont étendus ;
les nouvelles primitives composent les existantes.

| Primitive | Fichier | Rôle et règles |
| --- | --- | --- |
| **AppShell** | `shell/AppShell.tsx` | `[sidebar \| topbar + contenu]` plein écran. Lien d'évitement « Aller au contenu principal », `<main id="contenu">`. `canvas="grid"` pour la grille technique. Les fournisseurs globaux restent dans `(app)/layout.tsx`. |
| **Sidebar** | `shell/Sidebar.tsx` | Briques génériques : `Sidebar`, `SidebarHeader`, `SidebarNav`, `SidebarSection`, `SidebarItem`, `SidebarFooter`. `SidebarItem active` pose `aria-current="page"` + fond d'accent 10 % + liseré d'accent. Assemblée par `SidebarContent` ; `AppSidebar` (≥ md) et `MobileSidebar` (tiroir) l'habillent. |
| **TopBar** | `shell/TopBar.tsx` | `[start] · recherche ⌘K · [end]`. Slots `start` / `end` recomposables. Seul endroit avec un flou d'arrière-plan léger. |
| **PageHeader** | `shell/PageHeader.tsx` | Un seul `h1` par vue : titre `font-display text-2xl font-bold`, légende, description, métadonnées, actions. Une seule action primaire. |
| **Panel / Card** | `ui/card.tsx` | `Card` : `variant` `default` · `panel` · `raised` · `sunken`, `interactive` (bordure d'accent + halo au survol, jamais de déplacement). `Panel`, `PanelHeader`, `PanelTitle`, `PanelDescription`, `PanelBody`, `PanelFooter` : variante dense à filets. |
| **MetricChip** | `ui/metric-chip.tsx` | « libellé · valeur » compact, chiffres tabulaires, `tone` sur la valeur uniquement. Utilisé par `ScorePills`. |
| **StatusBadge** | `ui/status-badge.tsx` | Statut = libellé + point ou icône + teinte (`soft` · `outline` · `solid`). Construit sur `Badge` (qui porte les variantes de teinte). |
| **IconButton** | `ui/icon-button.tsx` | Étend `Button`. `label` **obligatoire** (nom accessible), infobulle au survol et au focus, `pressed` → `aria-pressed`. |
| **Tabs** | `ui/tabs.tsx` | Navigation entre panneaux d'un même contenu. `variant="line"` (soulignement d'accent) pour la navigation, `default` (groupe en puits) pour les outils denses. |
| **SegmentedControl** | `ui/segmented-control.tsx` | Choix exclusif (mode, période, densité) — sémantique radio (Radix ToggleGroup), `label` obligatoire, une valeur toujours active. |
| **DataTable (coque)** | `ui/data-table.tsx` | Conteneur à bordure froide + barre d'outils + zone défilante (`stickyHeader`, `maxHeight`, `density`) + pied. `state` `ready` · `loading` · `empty` · `error` au même emplacement. Le tableau reste composé avec `Table*`. |
| **EmptyState** | `empty/EmptyState.tsx` | Icône, titre, description, `cta` ou `action`. `variant` `card` · `inline`. |
| **LoadingState** | `empty/LoadingState.tsx` | `role="status"`, `aria-live="polite"`, squelette (`rows` · `block`) ou indicateur `inline`. |
| **ErrorState** | `empty/ErrorState.tsx` | `role="alert"`, message sobre non accusatoire, `digest` en mono, action en slot. `tone` `vigilance` (récupérable) · `critical`. |
| **Tooltip** | `ui/tooltip.tsx` | Surface 3, bordure forte, texte bref ; survol **et** focus clavier ; Échap ferme. Jamais d'action ni d'information indispensable. |
| **Dialog** | `ui/dialog.tsx` | Modal Radix : focus piégé, retour du focus au déclencheur, Échap, clic sur le voile. Titre obligatoire (nom accessible). |
| **SidePanel** | `ui/side-panel.tsx` | Tiroir : en-tête (titre, description, fermer), corps défilant, pied. `modal` (défaut : voile + focus piégé) ou non modal (inspection : contexte utilisable, Échap ferme). `size` `sm` · `md` · `lg` · `xl`. Composé sur `Sheet`. |

Pastilles métier (adaptateurs minces, mêmes props qu'avant) : `CaseStatusBadge`,
`CaseQualityBadges`, `ReviewStateBadge`, `ScorePills`, `EvidenceBadge`,
`SourceHealthBadge`, `KpiCard` — elles consomment `StatusBadge` / `MetricChip` et
`domain-tones.ts` ; leurs libellés sont inchangés.

## 8. Motion

> Fonctionnelle, courte, jamais décorative.

| Token | Valeur | Usage |
| --- | --- | --- |
| `--motion-duration-fast` | 120 ms | Survol, focus, couleur / bordure / halo |
| `--motion-duration-base` | 180 ms | Changement d'état, infobulle, transition de page |
| `--motion-duration-slow` | 220 ms | Entrée d'un panneau / dialogue |
| `--motion-duration-exit` | 140 ms | Sortie — toujours plus courte que l'entrée |
| `--motion-distance-panel` | 12 px | Translation d'entrée d'un panneau |
| `--motion-distance-fade` | 4 px | Décalage d'entrée d'une page / d'un bloc |
| `--motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | États (`transition-ui`) |
| `--motion-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrées de contenu |
| `--motion-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Sorties |
| `--motion-ease-spring` | `linear(…)` ≈ 2 % de dépassement ; repli `cubic-bezier(0.32, 1.08, 0.5, 1)` | Entrée de panneau — « ressort doux » |

Utilitaires (`globals.css`) : `motion-enter` / `motion-exit` (translation + opacité,
vecteur donné par `motion-from-{top,right,bottom,left}`), `motion-fade-in` /
`motion-fade-out`, `transition-ui` (couleur, bordure, halo, fond — 120 ms).

Règles :

1. **États = couleur, bordure, halo.** Le survol n'élève presque pas (`shadow-glow`,
   `border-primary/40`) et **ne déplace ni ne redimensionne jamais**.
2. **Seules les surcouches se déplacent** (panneaux, dialogues, menus) : entrée =
   ≤ 12 px + opacité (+ ressort doux pour panneaux et dialogues) ; sortie plus
   courte, sans ressort. Aucun contenu en place ne bouge.
3. **Rien ne boucle** sur un contenu opérationnel. Exceptions : indicateurs de
   chargement uniquement — spinner de `LoadingState inline`, pulse du squelette,
   icône de chargement d'un toast.
4. **`prefers-reduced-motion: reduce`** : règle globale (`globals.css`) — animations
   et transitions à 0,01 ms ; `PageMotion` supprime la translation et le fondu.
   Côté JS : `useReducedMotion()` de `motion/react`.
5. Durées d'état d'interface : **120–220 ms** (testé, ainsi que la parité des
   constantes `lib/design/motion.ts`).

## 9. Interdits

- Un **littéral de couleur** (hex, rgb, hsl, oklch) dans une primitive — toujours un token.
- Une **teinte de risque** pour autre chose qu'un niveau de risque ; l'accent n'est
  jamais « ok » ni « danger ».
- Une **information portée par la couleur seule**.
- Des **dégradés arc-en-ciel**, un **violet de marque**, un verre dépoli blanc,
  du néomorphisme, des illustrations décoratives.
- Une **animation qui boucle** sur du contenu opérationnel ; un **déplacement ou une
  mise à l'échelle au survol**.
- Une **ombre ad hoc** (utiliser `shadow-xs…lg`, `shadow-glow`), un **z-index brut**,
  une **taille de texte arbitraire** (`text-[11px]` → `text-micro`).
- Une **autre police** que celles de `src/app/layout.tsx`.
- Un **flou d'arrière-plan** sur du contenu (seule la `TopBar` en porte un).
- Écrire dans `globals.css` un style non migré **nouveau** : section « historiques »
  figée.

Ce qui est automatisable est vérifié par `design-contract.spec.ts` sur le territoire
`ui · shell · empty · design-system · lib/design`.

## 10. Prévisualisation

`/design-system` (fichier `src/app/design-system/page.tsx`) : tokens lus **en direct**
sur `<html>` (valeur sRGB + ratio de contraste réel, thème courant), échelles,
coque réelle dans un cadre, toutes les primitives dans leurs variantes et états,
surcouches interactives, démonstration de motion. Changer de thème en haut de page.
Page interne : `robots: noindex`, aucune donnée métier, aucun lien depuis la
navigation.

## 11. Ce qui est vérifié automatiquement

| Test | Garantit |
| --- | --- |
| `design-tokens.spec.ts` | Complétude des tokens (2 thèmes) · tout en gamut sRGB · aucun hex hors alias documentés · profondeur ordonnée (sombre) · contrastes AA texte / non-texte · teintes distinctes (OKLab ≥ 0,08) · z-index croissants · motion 120–220 ms, sortie < entrée, parité TypeScript ↔ CSS · exposition à Tailwind · reduced-motion. |
| `design-contract.spec.ts` | Territoire sans hex / rgb / palette Tailwind brute / alias historiques / z-index brut / `text-[Npx]` / flou / dégradé / boucle d'animation / mouvement au survol · aucune police ajoutée · `DESIGN_SYSTEM.md` documente chaque token et chaque primitive. |
| `design-primitives.spec.ts` | Focus piégé, Échap, retour du focus (Dialog, SidePanel modal et non modal) · SegmentedControl exclusif et nommé · rôles `status` / `alert` · nom accessible des boutons icône · coque et `aria-current`. |

## 12. Écarts assumés par rapport à l'accueil

L'accueil (`components/landing/kyb`) reste la source de l'identité ; le design
system en dérive, avec ces écarts, tous volontaires :

| Sujet | Accueil | Design system | Raison |
| --- | --- | --- | --- |
| Polices | Public Sans + Geist Mono (Nuit), Instrument Sans + JetBrains Mono (Registre) | Inter + Space Grotesk, **inchangées** | Consigne : n'utiliser que la police réellement chargée par l'application, avec son usage actuel. Bascule possible en un point (`layout.tsx` + `--font-*` de `globals.css`). |
| Surfaces | Fond plat, hiérarchie par filets, aucune carte | Cinq surfaces superposées + cartes à bordure froide | Direction artistique : profondeur par superposition. |
| Connexion confirmée | Trait `--ink` plein | Trait `--primary` (accent) | Direction artistique : l'accent signale la connexion confirmée. |
| Trait « déclaré » (clair) | `--line` à 2,55:1 | `--border-control` ≥ 3:1 | WCAG 1.4.11 sur un trait porteur d'information. |
| Bouton primaire (clair) | Fond encre, survol accent | Fond `--primary` | Règle unique « accent = action » dans les deux thèmes. |
| Sévérité | Forme et taille, une seule teinte `--warn` | Cinq teintes + libellé / icône | Besoin produit : statuts, scores, signaux. |

## 13. Dette et migration

Le contrat est en place ; ces zones ne l'adoptent pas encore (« lots » de l'audit) :

- **Graphe** (`components/graph/*`, bloc `.graph-*` de `globals.css`) : scène
  `#0b1020` fixe, aurores teal/bleu/violet, orbes lustrés, `NODE_COLORS`,
  `EVIDENCE_EDGE_COLORS`, `SEVERITY_COLORS`, `COMMUNITY_COLORS` en hexadécimal. Le
  DOM du graphe est verrouillé par `graph-selection.spec.ts`.
- **Secteurs** (`components/secteurs/*`, `lib/domain/sector-scoring.ts`) : styles
  inline et `PALETTE` hors tokens, page hors coque.
- **Pages métier** : ~120 usages des alias historiques ; ~200 littéraux hex hors
  territoire (dont Lab 58, PDF 21) ; ~37 `text-[Npx]`.
- **Démo, Lab, parcours** : `.landing-scope`, modules CSS dédiés.
- **Pages publiques** (`SitePageHeader`, `PublicFooter`) : tokens déjà suivis, gabarit à
  aligner sur `PageHeader`.
- **Libellés** à corriger (hors design) : « Score calcule », « Fiabilite »,
  « masques », « echec », « Demo ».
- **Code mort** : `components/landing/*.tsx`, `components/landing/mockup/**`.

Règle de migration : lorsqu'un fichier entre dans le territoire, il consomme les
primitives et les tokens, et le test de contrat l'inclut.

## 14. Ajouter un token ou une primitive

**Token** : 1) valeur dans les **deux** thèmes de `design-tokens.css` ;
2) exposition `--color-*` (ou `--shadow-*`…) dans `@theme inline` de `globals.css` ;
3) ligne dans ce document (§ 3, § 6 ou § 8) — le test échoue sinon ;
4) si c'est une couleur de texte ou d'interface, elle entre dans les listes de
contraste de `design-tokens.spec.ts`.

**Primitive** : 1) étendre un composant existant avant d'en créer un ; 2) tokens
uniquement (aucun hex, aucun `z-[n]`, aucun `text-[Npx]`) ; 3) nom accessible
obligatoire pour tout contrôle sans texte ; 4) états chargement / vide / erreur si
elle affiche des données ; 5) variante dans `ComponentGallery` et ligne en § 7.
