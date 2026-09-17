# Transitional bridge aliases — undefined classes in shared components

**Status:** APPLIED 2026-09-17 (rulings by James) · **TRANSITIONAL** — every alias here is removed once its last usage site converts.
**Where:** `packages/ui/src/styles/theme.css`, block marked `TRANSITIONAL ALIASES`.
**Scope:** `packages/ui/src/components/**` — 201 classes that generated no CSS after the token wiring (3 scanner false positives excluded: `border-box`, `border-color`, `fill-box` are CSS values in strings). Zero-usage classes: none (every row has ≥1 site).

## Removal protocol
1. When converting a page/component, fix its class names to token names (DESIGN.md §2) instead of relying on these aliases.
2. After each conversion, grep the class across `apps/` and `packages/` (excluding `theme.css`); at **zero** usages, delete its line from the TRANSITIONAL block and its row here.
3. When this table is empty, delete the block and this file.

**Columns** — *Old*: what the class rendered under `theme.css` at `5e4386f` (Untitled UI dark theme; `—` = nothing then either). *Token*: the Vanyshr token the alias points at. *Alias*: the Tailwind theme key added (namespaced per utility so e.g. `bg-tertiary` and `text-tertiary` can differ).

## Scaffolded shadcn components (never defined in any system)

| Class | Uses | Sites | Old (pre-bible) | Token | Alias | Notes |
|---|---|---|---|---|---|---|
| `bg-background-surface-default` | 3 | ui/card/card.tsx:12<br>ui/switch/switch.tsx:20<br>ui/tabs/tabs.tsx:30 | — | `--color-bg-surface` | `--background-color-background-surface-default` |  |
| `bg-background-surface-secondary` | 6 | ui/skeleton/skeleton.tsx:9<br>ui/table/table.tsx:25,50,65,65<br>ui/tabs/tabs.tsx:15 | — | `--color-bg-elevated` | `--background-color-background-surface-secondary` | tab list track, table header/hover, skeleton |
| `bg-border-neutral-200` | 1 | ui/separator/separator.tsx:25 | — | `--color-border` | `--background-color-border-neutral-200` |  |
| `bg-border-neutral-300` | 1 | ui/switch/switch.tsx:12 | — | `--color-border-strong` | `--background-color-border-neutral-300` | switch unchecked track |
| `bg-utility-brand-600` | 1 | ui/switch/switch.tsx:12 | `rgb(53 183 254)` | `--color-primary` | `--background-color-utility-brand-600` | switch checked track (+ thumb needs --color-primary-on contrast) |
| `border-border-neutral-200` | 4 | ui/card/card.tsx:12<br>ui/table/table.tsx:25,50,65 | — | `--color-border` | `--border-color-border-neutral-200` |  |
| `ring-offset-background-surface-default` | 3 | ui/switch/switch.tsx:12<br>ui/tabs/tabs.tsx:30,45 | — | `--color-bg-surface` | `--ring-offset-color-background-surface-default` |  |

## Surfaces, states & overlays

| Class | Uses | Sites | Old (pre-bible) | Token | Alias | Notes |
|---|---|---|---|---|---|---|
| `bg-active` | 5 | application/app-navigation/base-components/nav-item-button.tsx:57<br>application/app-navigation/base-components/nav-item.tsx:9<br>application/tabs/tabs.tsx:27<br>ui/button-group/button-group.tsx:20<br>ui/select/select-item.tsx:46 | `rgb(51 51 51)` | `--color-state-active` | `--background-color-active` |  |
| `bg-alpha-black` | 12 | shared-assets/illustrations/box.tsx:87,168,242<br>shared-assets/illustrations/cloud.tsx:89,173,266<br>shared-assets/illustrations/credit-card.tsx:101,194,288<br>shared-assets/illustrations/documents.tsx:178,350,523 | `rgb(255 255 255)` | `--color-text-primary` | `--background-color-alpha-black` | DEVIATES from approved state-active: every use is /20 on an opaque inverted base (old = white); state-active is already 8% alpha → ~1.6%, invisible |
| `bg-alpha-white` | 2 | application/pagination/pagination-dot.tsx:27<br>application/pagination/pagination-line.tsx:25 | `rgb(12 14 18)` | `--color-text-inverse` | `--background-color-alpha-white` | DEVIATES from approved state-active: used as /90 scrim on opaque near-black (old rgb(12 14 18)); state-active would render a faint white wash |
| `bg-disabled_subtle` | 16 | application/file-upload/file-upload-base.tsx:204<br>ui/button-group/button-group.tsx:20<br>ui/checkbox/checkbox.tsx:21<br>ui/input/input-group.tsx:28,29,105<br>ui/input/input.tsx:89,90<br>ui/pin-input/pin-input.tsx:97<br>ui/radio-group/radio-group.tsx:31<br>ui/select/combobox.tsx:46<br>ui/select/multi-select.tsx:331<br>ui/select/select-native.tsx:34<br>ui/select/select.tsx:61<br>ui/tags/base-components/tag-checkbox.tsx:20<br>ui/textarea/textarea.tsx:36 | `rgb(40 40 40)` | `--color-state-disabled-bg` | `--background-color-disabled_subtle` |  |
| `bg-overlay` | 3 | application/app-navigation/base-components/mobile-header.tsx:32<br>application/modals/modal.tsx:13<br>application/slideout-menus/slideout-menu.tsx:19 | `rgb(51 51 51)` | `--color-bg-overlay` | `--background-color-overlay` |  |
| `bg-primary-25` | 1 | ui/avatar/base-components/avatar-company-icon.tsx:22 | — | `--color-bg-app` | `--background-color-primary-25` |  |
| `bg-primary-solid` | 1 | ui/tooltip/tooltip.tsx:69 | `rgb(40 40 40)` | `--color-bg-elevated` | `--background-color-primary-solid` | old = dark grey fill |
| `bg-primary_alt` | 5 | application/tabs/tabs.tsx:31,38<br>foundations/featured-icon/featured-icon.tsx:83<br>ui/progress-indicators/progress-indicators.tsx:99,111 | `rgb(40 40 40)` | `--color-bg-app` | `--background-color-primary_alt` |  |
| `bg-primary_hover` | 30 | application/app-navigation/base-components/mobile-header.tsx:21<br>application/app-navigation/base-components/nav-account-card.tsx:99,100,138,186,186<br>application/app-navigation/base-components/nav-item-button.tsx:56<br>application/app-navigation/base-components/nav-item.tsx:8<br>application/pagination/pagination.tsx:21,21,23<br>application/tabs/tabs.tsx:25<br>marketing/header-navigation/base-components/nav-menu-item.tsx:22<br>marketing/header-navigation/header.tsx:42,54,193<br>ui/avatar/base-components/avatar-add-button.tsx:24<br>ui/button-group/button-group.tsx:16<br>ui/buttons/button-utility.tsx:12,13<br>ui/buttons/button.tsx:62,62,71,71<br>ui/buttons/close-button.tsx:13<br>ui/buttons/social-button.tsx:33<br>ui/dropdown/dropdown.tsx:53,54<br>ui/select/select-item.tsx:48<br>ui/tags/base-components/tag-close-x.tsx:23 | `rgb(51 51 51)` | `--color-state-hover` | `--background-color-primary_hover` | bible §9: hover = wash, not a surface step |
| `bg-quaternary` | 4 | application/pagination/pagination-dot.tsx:37<br>application/pagination/pagination-line.tsx:35<br>ui/progress-indicators/progress-indicators.tsx:45<br>ui/slider/slider.tsx:40 | `rgb(64 64 64)` | `--color-bg-elevated` | `--background-color-quaternary` | no 4th surface step |
| `bg-secondary-solid` | 2 | foundations/featured-icon/featured-icon.tsx:41,58 | `rgb(64 64 64)` | `--color-bg-elevated` | `--background-color-secondary-solid` |  |
| `bg-secondary_alt` | 3 | application/app-navigation/base-components/nav-account-card.tsx:83<br>application/tabs/tabs.tsx:75,76 | `rgb(30 30 30)` | `--color-bg-surface` | `--background-color-secondary_alt` |  |
| `bg-secondary_hover` | 2 | application/app-navigation/base-components/nav-item-button.tsx:57<br>application/app-navigation/base-components/nav-item.tsx:9 | `rgb(51 51 51)` | `--color-state-hover` | `--background-color-secondary_hover` | bible §9: hover = wash, not a surface step |
| `bg-tertiary` | 6 | foundations/featured-icon/featured-icon.tsx:24<br>ui/avatar/avatar-profile-photo.tsx:77,85,92<br>ui/tags/tags.tsx:150<br>ui/toggle/toggle.tsx:45 | `rgb(51 51 51)` | `--color-bg-elevated` | `--background-color-tertiary` |  |
| `caret-alpha-black` | 2 | ui/select/combobox.tsx:66<br>ui/select/multi-select.tsx:289 | `rgb(255 255 255)` | `--color-text-primary` | `--caret-color-alpha-black` | old = white |
| `fill-bg-primary-solid` | 1 | ui/tooltip/tooltip.tsx:86 | `rgb(40 40 40)` | `--color-bg-elevated` | `--fill-bg-primary-solid` | old = dark grey fill |
| `fill-bg-tertiary` | 1 | foundations/rating-stars.tsx:33 | `rgb(51 51 51)` | `--color-bg-elevated` | `--fill-bg-tertiary` |  |
| `ring-disabled_subtle` | 6 | application/file-upload/file-upload-base.tsx:204<br>ui/buttons/button-utility.tsx:12<br>ui/buttons/button.tsx:55,64,100,109 | `rgb(255 255 255 / 0.06)` | `--color-border-subtle` | `--ring-color-disabled_subtle` | disabled outline |
| `ring-secondary_alt` | 14 | application/app-navigation/base-components/nav-account-card.tsx:83<br>application/slideout-menus/slideout-menu.tsx:54<br>foundations/featured-icon/featured-icon.tsx:85<br>marketing/header-navigation/dropdown-header-navigation.tsx:40<br>marketing/header-navigation/header.tsx:114<br>ui/avatar/avatar-profile-photo.tsx:77,85,92,113<br>ui/dropdown/dropdown.tsx:115<br>ui/progress-indicators/progress-indicators.tsx:99,111<br>ui/select/popover.tsx:19<br>ui/slider/slider.tsx:15 | `rgb(255 255 255 / 0.10)` | `--color-border-subtle` | `--ring-color-secondary_alt` |  |
| `stroke-bg-quaternary` | 3 | ui/progress-indicators/progress-circles.tsx:73,134<br>ui/progress-indicators/simple-circle.tsx:9 | `rgb(64 64 64)` | `--color-bg-elevated` | `--stroke-bg-quaternary` |  |
| `text-alpha-black` | 1 | ui/buttons/social-button.tsx:133 | `rgb(255 255 255)` | `--color-text-primary` | `--text-color-alpha-black` | old = white |
| `text-bg-tertiary` | 1 | application/loading-indicator/loading-indicator.tsx:99 | `rgb(51 51 51)` | `--color-bg-elevated` | `--text-color-bg-tertiary` | icon drawn in surface color |
| `text-primary_on-brand` | 1 | foundations/rating-badge.tsx:136 | `rgb(255 255 255)` | `--color-primary-on` | `--text-color-primary_on-brand` |  |
| `text-quaternary` | 11 | application/app-navigation/sidebar-navigation/sidebar-sections-subheadings.tsx:34<br>application/file-upload/file-upload-base.tsx:290<br>application/pagination/pagination.tsx:21<br>application/table/table.tsx:186<br>application/tabs/tabs.tsx:183<br>ui/avatar/avatar-profile-photo.tsx:78<br>ui/avatar/avatar.tsx:86<br>ui/dropdown/dropdown.tsx:79<br>ui/input/input.tsx:170<br>ui/select/combobox.tsx:81<br>ui/select/multi-select.tsx:302 | `rgb(163 163 163)` | `--color-text-tertiary` | `--text-color-quaternary` | no 4th text step |
| `text-secondary_hover` | 10 | application/app-navigation/base-components/nav-account-card.tsx:143<br>application/app-navigation/base-components/nav-item.tsx:50,52<br>marketing/header-navigation/header.tsx:128,166<br>ui/button-group/button-group.tsx:16,20<br>ui/buttons/button.tsx:62<br>ui/buttons/social-button.tsx:33<br>ui/dropdown/dropdown.tsx:69 | `rgb(224 222 220)` | `--color-text-primary` | `--text-color-secondary_hover` | hover of text-secondary (one step stronger) |
| `text-secondary_on-brand` | 1 | foundations/rating-badge.tsx:137 | `rgb(163 163 163)` | `--color-primary-on` | `--text-color-secondary_on-brand` |  |
| `text-tertiary` | 34 | application/app-navigation/base-components/nav-account-card.tsx:92,148<br>application/app-navigation/sidebar-navigation/sidebar-slim.tsx:152<br>application/empty-state/empty-state.tsx:121<br>application/file-upload/file-upload-base.tsx:202,281,347,356<br>application/pagination/pagination.tsx:101,157,208<br>application/table/table.tsx:97,264<br>marketing/header-navigation/base-components/nav-menu-item.tsx:36<br>ui/avatar/avatar-label-group.tsx:24<br>ui/buttons/button.tsx:71,78<br>ui/checkbox/checkbox.tsx:107<br>ui/input/hint-text.tsx:19<br>ui/input/input-group.tsx:21,28,113<br>ui/pin-input/pin-input.tsx:137<br>ui/progress-indicators/progress-circles.tsx:17,24,31,38,45<br>ui/radio-group/radio-group.tsx:101<br>ui/select/combobox.tsx:60<br>ui/select/select-item.tsx:75<br>ui/select/select-native.tsx:36<br>ui/select/select.tsx:89<br>ui/toggle/toggle.tsx:128 | `rgb(163 163 163)` | `--color-text-tertiary` | `--text-color-tertiary` |  |
| `to-bg-disabled_subtle` | 1 | ui/select/combobox.tsx:74 | `rgb(40 40 40)` | `--color-state-disabled-bg` | `--color-bg-disabled_subtle` |  |

## Text & foreground (icons)

| Class | Uses | Sites | Old (pre-bible) | Token | Alias | Notes |
|---|---|---|---|---|---|---|
| `bg-brand-primary_alt` | 1 | application/tabs/tabs.tsx:21 | `rgb(40 40 40)` | `--color-primary-muted` | `--background-color-brand-primary_alt` |  |
| `bg-brand-secondary` | 1 | foundations/featured-icon/featured-icon.tsx:23 | `rgb(11 143 217)` | `--color-primary-muted` | `--background-color-brand-secondary` |  |
| `bg-brand-solid` | 9 | foundations/featured-icon/featured-icon.tsx:40,57<br>shared-assets/qr-code.tsx:15<br>ui/buttons/button.tsx:51<br>ui/checkbox/checkbox.tsx:20<br>ui/radio-group/radio-group.tsx:30<br>ui/slider/slider.tsx:42<br>ui/tags/base-components/tag-checkbox.tsx:19<br>ui/toggle/toggle.tsx:46 | `rgb(20 171 254)` | `--color-primary` | `--background-color-brand-solid` |  |
| `bg-brand-solid_hover` | 3 | ui/buttons/button.tsx:51,51<br>ui/toggle/toggle.tsx:47 | `rgb(11 143 217)` | `--color-primary-hover` | `--background-color-brand-solid_hover` |  |
| `bg-fg-brand-primary_alt` | 2 | application/pagination/pagination-dot.tsx:39<br>application/pagination/pagination-line.tsx:37 | `rgb(163 163 163)` | `--color-primary` | `--background-color-fg-brand-primary_alt` |  |
| `bg-fg-brand-secondary` | 1 | application/pagination/pagination-dot.tsx:40 | `rgb(20 171 254)` | `--color-primary` | `--background-color-fg-brand-secondary` |  |
| `bg-fg-disabled_subtle` | 2 | ui/avatar/base-components/avatar-online-indicator.tsx:24<br>ui/radio-group/radio-group.tsx:40 | `rgb(64 64 64)` | `--color-state-disabled-fg` | `--background-color-fg-disabled_subtle` |  |
| `bg-fg-success-secondary` | 1 | ui/avatar/base-components/avatar-online-indicator.tsx:24 | `rgb(88 225 166)` | `--color-status-success` | `--background-color-fg-success-secondary` |  |
| `bg-fg-white` | 3 | application/pagination/pagination-dot.tsx:41<br>ui/radio-group/radio-group.tsx:38<br>ui/toggle/toggle.tsx:62 | `rgb(255 255 255)` | `--color-primary-on` | `--background-color-fg-white` | dot/check on filled control — ink, never white on primary |
| `border-fg-brand-primary_alt` | 2 | application/tabs/tabs.tsx:42,47 | `rgb(163 163 163)` | `--color-primary` | `--border-color-fg-brand-primary_alt` |  |
| `border-fg-error-primary` | 2 | foundations/featured-icon/featured-icon.tsx:113,113 | `rgb(229 72 77)` | `--color-status-danger` | `--border-color-fg-error-primary` |  |
| `border-fg-success-primary` | 2 | foundations/featured-icon/featured-icon.tsx:115,115 | `rgb(61 220 151)` | `--color-status-success` | `--border-color-fg-success-primary` |  |
| `border-fg-warning-primary` | 2 | foundations/featured-icon/featured-icon.tsx:114,114 | `rgb(255 94 31)` | `--color-status-warn` | `--border-color-fg-warning-primary` |  |
| `text-brand-secondary` | 5 | application/app-navigation/sidebar-navigation/sidebar-slim.tsx:139<br>application/tabs/tabs.tsx:21,42,47<br>ui/buttons/button.tsx:87 | `rgb(163 163 163)` | `--color-primary-text` | `--text-color-brand-secondary` |  |
| `text-brand-secondary_hover` | 1 | ui/buttons/button.tsx:87 | `rgb(224 222 220)` | `--color-primary-hover` | `--text-color-brand-secondary_hover` |  |
| `text-brand-tertiary` | 1 | ui/input/label.tsx:29 | `rgb(163 163 163)` | `--color-primary-text` | `--text-color-brand-tertiary` |  |
| `text-brand-tertiary_alt` | 1 | ui/pin-input/pin-input.tsx:96 | `rgb(255 255 255)` | `--color-primary-text` | `--text-color-brand-tertiary_alt` |  |
| `text-button-destructive-primary-icon` | 1 | ui/buttons/button.tsx:102 | `rgb(237 131 134)` | `--color-status-danger-on` | `--text-color-button-destructive-primary-icon` |  |
| `text-button-destructive-primary-icon_hover` | 1 | ui/buttons/button.tsx:102 | `rgb(243 167 170)` | `--color-status-danger-on` | `--text-color-button-destructive-primary-icon_hover` |  |
| `text-button-primary-icon` | 1 | ui/buttons/button.tsx:57 | `rgb(26 26 26)` | `--color-primary-on` | `--text-color-button-primary-icon` |  |
| `text-button-primary-icon_hover` | 1 | ui/buttons/button.tsx:57 | `rgb(26 26 26)` | `--color-primary-on` | `--text-color-button-primary-icon_hover` |  |
| `text-featured-icon-light-fg-brand` | 1 | foundations/featured-icon/featured-icon.tsx:23 | `rgb(142 215 255)` | `--color-primary-text` | `--text-color-featured-icon-light-fg-brand` |  |
| `text-featured-icon-light-fg-error` | 1 | foundations/featured-icon/featured-icon.tsx:25 | `rgb(243 167 170)` | `--color-status-danger` | `--text-color-featured-icon-light-fg-error` |  |
| `text-featured-icon-light-fg-gray` | 1 | foundations/featured-icon/featured-icon.tsx:24 | `rgb(224 222 220)` | `--color-text-tertiary` | `--text-color-featured-icon-light-fg-gray` |  |
| `text-featured-icon-light-fg-success` | 1 | foundations/featured-icon/featured-icon.tsx:27 | `rgb(162 238 205)` | `--color-status-success` | `--text-color-featured-icon-light-fg-success` |  |
| `text-featured-icon-light-fg-warning` | 1 | foundations/featured-icon/featured-icon.tsx:26 | `rgb(255 178 147)` | `--color-status-warn` | `--text-color-featured-icon-light-fg-warning` |  |
| `text-fg-brand-secondary_alt` | 1 | ui/buttons/button.tsx:91 | `rgb(64 64 64)` | `--color-primary-text` | `--text-color-fg-brand-secondary_alt` |  |
| `text-fg-brand-secondary_hover` | 1 | ui/buttons/button.tsx:91 | `rgb(163 163 163)` | `--color-primary-hover` | `--text-color-fg-brand-secondary_hover` |  |
| `text-fg-disabled_subtle` | 7 | ui/button-group/button-group.tsx:22<br>ui/buttons/button-utility.tsx:90<br>ui/buttons/button.tsx:17<br>ui/checkbox/checkbox.tsx:34,48<br>ui/pin-input/pin-input.tsx:97<br>ui/tags/base-components/tag-checkbox.tsx:35 | `rgb(64 64 64)` | `--color-text-disabled` | `--text-color-fg-disabled_subtle` |  |
| `text-fg-error-primary` | 5 | application/file-upload/file-upload-base.tsx:292<br>foundations/featured-icon/featured-icon.tsx:113<br>ui/buttons/button.tsx:111,118,127 | `rgb(229 72 77)` | `--color-status-danger` | `--text-color-fg-error-primary` |  |
| `text-fg-error-secondary` | 4 | ui/buttons/button.tsx:111,118,127<br>ui/input/input.tsx:152 | `rgb(233 98 102)` | `--color-status-danger` | `--text-color-fg-error-secondary` |  |
| `text-fg-quaternary` | 40 | application/app-navigation/base-components/nav-account-card.tsx:144,186<br>application/app-navigation/base-components/nav-item-button.tsx:56<br>application/app-navigation/base-components/nav-item.tsx:36,60,71<br>application/app-navigation/sidebar-navigation/sidebar-slim.tsx:216<br>application/file-upload/file-upload-base.tsx:289,354<br>application/table/table.tsx:192,200,202<br>marketing/header-navigation/header.tsx:58,131<br>ui/avatar/avatar-profile-photo.tsx:86,93<br>ui/avatar/avatar.tsx:90,93<br>ui/avatar/base-components/avatar-add-button.tsx:24<br>ui/button-group/button-group.tsx:22<br>ui/buttons/button-utility.tsx:12,13<br>ui/buttons/button.tsx:66,73,82<br>ui/buttons/close-button.tsx:13<br>ui/buttons/social-button.tsx:34<br>ui/dropdown/dropdown.tsx:61,140<br>ui/input/input.tsx:109,137<br>ui/input/label.tsx:38<br>ui/select/combobox.tsx:54<br>ui/select/multi-select.tsx:339<br>ui/select/select-item.tsx:52<br>ui/select/select-native.tsx:34,56<br>ui/select/select.tsx:69,97<br>ui/tags/base-components/tag-close-x.tsx:23 | `rgb(64 64 64)` | `--color-text-tertiary` | `--text-color-fg-quaternary` |  |
| `text-fg-quaternary_hover` | 22 | application/app-navigation/base-components/nav-account-card.tsx:186,186<br>application/app-navigation/base-components/nav-item-button.tsx:56,57<br>application/app-navigation/sidebar-navigation/sidebar-slim.tsx:216<br>application/table/table.tsx:192,192<br>ui/avatar/base-components/avatar-add-button.tsx:24<br>ui/button-group/button-group.tsx:22<br>ui/buttons/button-utility.tsx:12,13<br>ui/buttons/button.tsx:66,73,82<br>ui/buttons/close-button.tsx:13<br>ui/buttons/social-button.tsx:34<br>ui/dropdown/dropdown.tsx:141<br>ui/input/input.tsx:137,137<br>ui/input/label.tsx:38,38<br>ui/tags/base-components/tag-close-x.tsx:23 | `rgb(163 163 163)` | `--color-text-secondary` | `--text-color-fg-quaternary_hover` | hover = one step stronger text |
| `text-fg-secondary_hover` | 1 | application/app-navigation/base-components/mobile-header.tsx:21 | `rgb(224 222 220)` | `--color-text-primary` | `--text-color-fg-secondary_hover` | hover of fg-secondary |
| `text-fg-success-primary` | 3 | application/file-upload/file-upload-base.tsx:286,353<br>foundations/featured-icon/featured-icon.tsx:115 | `rgb(61 220 151)` | `--color-status-success` | `--text-color-fg-success-primary` |  |
| `text-fg-success-secondary` | 1 | ui/tags/tags.tsx:110 | `rgb(88 225 166)` | `--color-status-success` | `--text-color-fg-success-secondary` |  |
| `text-fg-warning-primary` | 1 | foundations/featured-icon/featured-icon.tsx:114 | `rgb(255 94 31)` | `--color-status-warn` | `--text-color-fg-warning-primary` |  |
| `text-fg-white` | 23 | application/app-navigation/base-components/mobile-header.tsx:43,43<br>foundations/featured-icon/featured-icon.tsx:32,49<br>foundations/rating-badge.tsx:130,141<br>shared-assets/illustrations/box.tsx:87,168,242<br>shared-assets/illustrations/cloud.tsx:89,173,266<br>shared-assets/illustrations/credit-card.tsx:101,194,288<br>shared-assets/illustrations/documents.tsx:178,350,523<br>ui/buttons/close-button.tsx:14,14<br>ui/checkbox/checkbox.tsx:31,45<br>ui/tags/base-components/tag-checkbox.tsx:30 | `rgb(255 255 255)` | `--color-text-primary` | `--text-color-fg-white` | SPLIT RULING — one class can't map two ways: 17 sites are white-over-dark (illustrations, close-button, mobile-header, rating-badge) → text-primary; 5 filled-control sites (checkbox ×2, tag-checkbox, featured-icon ×2) need --color-primary-on when those components convert |
| `text-placeholder` | 5 | ui/input/input.tsx:124<br>ui/select/combobox.tsx:66<br>ui/select/multi-select.tsx:289<br>ui/select/select.tsx:92<br>ui/textarea/textarea.tsx:30 | `rgb(163 163 163)` | `--color-text-secondary` | `--text-color-placeholder` | bible §2: secondary = placeholders |
| `text-placeholder_subtle` | 2 | ui/pin-input/pin-input.tsx:93,120 | `rgb(64 64 64)` | `--color-text-tertiary` | `--text-color-placeholder_subtle` |  |
| `text-tertiary_hover` | 2 | ui/buttons/button.tsx:71,78 | `rgb(163 163 163)` | `--color-text-secondary` | `--text-color-tertiary_hover` |  |

## Brand, status & focus

| Class | Uses | Sites | Old (pre-bible) | Token | Alias | Notes |
|---|---|---|---|---|---|---|
| `bg-error-primary` | 4 | ui/buttons/button.tsx:107,107,116,116 | `rgb(46 14 15)` | `--color-status-danger-muted` | `--background-color-error-primary` |  |
| `bg-error-secondary` | 1 | foundations/featured-icon/featured-icon.tsx:25 | `rgb(188 59 63)` | `--color-status-danger-muted` | `--background-color-error-secondary` |  |
| `bg-error-solid` | 3 | foundations/featured-icon/featured-icon.tsx:42,59<br>ui/buttons/button.tsx:96 | `rgb(188 59 63)` | `--color-status-danger` | `--background-color-error-solid` |  |
| `bg-error-solid_hover` | 2 | ui/buttons/button.tsx:96,96 | `rgb(229 72 77)` | `--color-status-danger-hover` | `--background-color-error-solid_hover` | danger hover token (amendment) |
| `bg-success-secondary` | 1 | foundations/featured-icon/featured-icon.tsx:27 | `rgb(50 180 124)` | `--color-status-success-muted` | `--background-color-success-secondary` |  |
| `bg-success-solid` | 2 | foundations/featured-icon/featured-icon.tsx:44,61 | `rgb(50 180 124)` | `--color-status-success` | `--background-color-success-solid` |  |
| `bg-warning-secondary` | 1 | foundations/featured-icon/featured-icon.tsx:26 | `rgb(209 77 25)` | `--color-status-warn-muted` | `--background-color-warning-secondary` |  |
| `bg-warning-solid` | 2 | foundations/featured-icon/featured-icon.tsx:43,60 | `rgb(209 77 25)` | `--color-status-warn` | `--background-color-warning-solid` |  |
| `border-brand` | 1 | shared-assets/qr-code.tsx:15 | `rgb(20 171 254)` | `--color-border-focus` | `--border-color-brand` |  |
| `border-brand_alt` | 1 | shared-assets/qr-code.tsx:9 | `rgb(11 143 217)` | `--color-primary` | `--border-color-brand_alt` |  |
| `outline-brand` | 3 | ui/button-group/button-group.tsx:14<br>ui/buttons/button.tsx:11<br>ui/pin-input/pin-input.tsx:95 | `rgb(20 171 254)` | `--color-border-focus` | `--outline-color-brand` | focus ring |
| `ring-bg-brand-solid` | 3 | ui/checkbox/checkbox.tsx:20<br>ui/radio-group/radio-group.tsx:30<br>ui/tags/base-components/tag-checkbox.tsx:19 | `rgb(20 171 254)` | `--color-primary` | `--ring-color-bg-brand-solid` |  |
| `ring-border-error_subtle` | 1 | ui/input/input-group.tsx:106 | `rgb(229 72 77)` | `--color-status-danger` | `--ring-color-border-error_subtle` |  |
| `ring-brand` | 9 | application/file-upload/file-upload-base.tsx:203<br>ui/input/input.tsx:86<br>ui/pin-input/pin-input.tsx:95,96<br>ui/select/combobox.tsx:47<br>ui/select/multi-select.tsx:332<br>ui/select/select-native.tsx:34<br>ui/select/select.tsx:60<br>ui/textarea/textarea.tsx:35 | `rgb(20 171 254)` | `--color-border-focus` | `--ring-color-brand` | focus ring |
| `ring-error_subtle` | 4 | ui/buttons/button.tsx:107<br>ui/input/input.tsx:93,94<br>ui/textarea/textarea.tsx:37 | `rgb(229 72 77)` | `--color-status-danger-border` | `--ring-color-error_subtle` | badge/field border token (amendment) |
| `text-error-primary` | 7 | application/file-upload/file-upload-base.tsx:231,293<br>ui/buttons/button.tsx:107,116,123<br>ui/input/hint-text.tsx:22,23 | `rgb(233 98 102)` | `--color-status-danger` | `--text-color-error-primary` |  |
| `text-error-primary_hover` | 3 | ui/buttons/button.tsx:107,116,123 | `rgb(237 131 134)` | `--color-status-danger` | `--text-color-error-primary_hover` | hover keeps hue (§9) |
| `text-success-primary` | 1 | application/file-upload/file-upload-base.tsx:287 | `rgb(88 225 166)` | `--color-status-success` | `--text-color-success-primary` |  |
| `text-warning-400` | 1 | foundations/rating-stars.tsx:30 | `rgb(255 117 62)` | `--color-status-warn` | `--text-color-warning-400` | rating stars |

## Utility palette (badges, illustrations)

| Class | Uses | Sites | Old (pre-bible) | Token | Alias | Notes |
|---|---|---|---|---|---|---|
| `bg-utility-blue-100` | 1 | ui/badge/badge.tsx:47 | — | `--color-primary-muted` | `--background-color-utility-blue-100` | collapses blue into primary |
| `bg-utility-blue-50` | 1 | ui/badge/badge.tsx:45 | — | `--color-primary-muted` | `--background-color-utility-blue-50` | collapses blue into primary |
| `bg-utility-blue-light-100` | 1 | ui/badge/badge.tsx:42 | — | `--color-primary-muted` | `--background-color-utility-blue-light-100` | collapses blue-light into primary |
| `bg-utility-blue-light-50` | 1 | ui/badge/badge.tsx:40 | — | `--color-primary-muted` | `--background-color-utility-blue-light-50` | collapses blue-light into primary |
| `bg-utility-brand-100` | 2 | ui/badge/badge-groups.tsx:60<br>ui/badge/badge.tsx:17 | `rgb(4 57 87)` | `--color-primary-muted` | `--background-color-utility-brand-100` |  |
| `bg-utility-brand-50` | 3 | foundations/featured-icon/featured-icon.tsx:40<br>ui/badge/badge-groups.tsx:60<br>ui/badge/badge.tsx:15 | `rgb(3 34 52)` | `--color-primary-muted` | `--background-color-utility-brand-50` |  |
| `bg-utility-brand-500` | 1 | ui/badge/badge-groups.tsx:87 | `rgb(20 171 254)` | `--color-primary` | `--background-color-utility-brand-500` |  |
| `bg-utility-error-100` | 2 | ui/badge/badge-groups.tsx:70<br>ui/badge/badge.tsx:22 | `rgb(78 24 26)` | `--color-status-danger-muted` | `--background-color-utility-error-100` |  |
| `bg-utility-error-50` | 3 | foundations/featured-icon/featured-icon.tsx:42<br>ui/badge/badge-groups.tsx:70<br>ui/badge/badge.tsx:20 | `rgb(46 14 15)` | `--color-status-danger-muted` | `--background-color-utility-error-50` |  |
| `bg-utility-error-500` | 1 | ui/badge/badge-groups.tsx:93 | `rgb(229 72 77)` | `--color-status-danger` | `--background-color-utility-error-500` |  |
| `bg-utility-gray-100` | 3 | ui/badge/badge-groups.tsx:65<br>ui/badge/badge.tsx:12,91 | `rgb(51 51 51)` | `--color-bg-elevated` | `--background-color-utility-gray-100` |  |
| `bg-utility-gray-50` | 3 | foundations/featured-icon/featured-icon.tsx:41<br>ui/badge/badge-groups.tsx:65<br>ui/badge/badge.tsx:10 | `rgb(40 40 40)` | `--color-bg-surface` | `--background-color-utility-gray-50` |  |
| `bg-utility-gray-500` | 1 | ui/badge/badge-groups.tsx:90 | `rgb(163 163 163)` | `--color-text-tertiary` | `--background-color-utility-gray-500` |  |
| `bg-utility-gray-blue-100` | 1 | ui/badge/badge.tsx:37 | — | `--color-bg-elevated` | `--background-color-utility-gray-blue-100` | collapses gray-blue into neutral |
| `bg-utility-gray-blue-50` | 1 | ui/badge/badge.tsx:35 | — | `--color-bg-surface` | `--background-color-utility-gray-blue-50` | collapses gray-blue into neutral |
| `bg-utility-indigo-100` | 1 | ui/badge/badge.tsx:52 | — | `--color-primary-muted` | `--background-color-utility-indigo-100` | collapses indigo into primary |
| `bg-utility-indigo-50` | 1 | ui/badge/badge.tsx:50 | — | `--color-primary-muted` | `--background-color-utility-indigo-50` | collapses indigo into primary |
| `bg-utility-orange-100` | 1 | ui/badge/badge.tsx:67 | — | `--color-status-warn-muted` | `--background-color-utility-orange-100` | collapses orange into warn |
| `bg-utility-orange-50` | 1 | ui/badge/badge.tsx:65 | — | `--color-status-warn-muted` | `--background-color-utility-orange-50` | collapses orange into warn |
| `bg-utility-pink-100` | 1 | ui/badge/badge.tsx:62 | — | `--color-status-danger-muted` | `--background-color-utility-pink-100` | collapses pink into danger |
| `bg-utility-pink-50` | 1 | ui/badge/badge.tsx:60 | — | `--color-status-danger-muted` | `--background-color-utility-pink-50` | collapses pink into danger |
| `bg-utility-purple-100` | 1 | ui/badge/badge.tsx:57 | — | `--color-bg-elevated` | `--background-color-utility-purple-100` | purple → neutral ladder (no Vanyshr purple; not brand cyan) |
| `bg-utility-purple-50` | 1 | ui/badge/badge.tsx:55 | — | `--color-bg-surface` | `--background-color-utility-purple-50` | purple → neutral ladder (no Vanyshr purple; not brand cyan) |
| `bg-utility-success-100` | 2 | ui/badge/badge-groups.tsx:80<br>ui/badge/badge.tsx:32 | `rgb(21 75 51)` | `--color-status-success-muted` | `--background-color-utility-success-100` |  |
| `bg-utility-success-50` | 3 | foundations/featured-icon/featured-icon.tsx:44<br>ui/badge/badge-groups.tsx:80<br>ui/badge/badge.tsx:30 | `rgb(12 44 30)` | `--color-status-success-muted` | `--background-color-utility-success-50` |  |
| `bg-utility-success-500` | 1 | ui/badge/badge-groups.tsx:99 | `rgb(61 220 151)` | `--color-status-success` | `--background-color-utility-success-500` |  |
| `bg-utility-warning-100` | 2 | ui/badge/badge-groups.tsx:75<br>ui/badge/badge.tsx:27 | `rgb(87 32 11)` | `--color-status-warn-muted` | `--background-color-utility-warning-100` |  |
| `bg-utility-warning-50` | 3 | foundations/featured-icon/featured-icon.tsx:43<br>ui/badge/badge-groups.tsx:75<br>ui/badge/badge.tsx:25 | `rgb(51 19 6)` | `--color-status-warn-muted` | `--background-color-utility-warning-50` |  |
| `bg-utility-warning-500` | 1 | ui/badge/badge-groups.tsx:96 | `rgb(255 94 31)` | `--color-status-warn` | `--background-color-utility-warning-500` |  |
| `border-utility-brand-200` | 2 | foundations/featured-icon/featured-icon.tsx:40,57 | `rgb(6 83 126)` | `--color-primary-border` | `--border-color-utility-brand-200` | badge border token (amendment) |
| `border-utility-error-200` | 2 | foundations/featured-icon/featured-icon.tsx:42,59 | `rgb(110 35 37)` | `--color-status-danger-border` | `--border-color-utility-error-200` | badge border token (amendment) |
| `border-utility-gray-200` | 2 | foundations/featured-icon/featured-icon.tsx:41,58 | `rgb(64 64 64)` | `--color-border` | `--border-color-utility-gray-200` |  |
| `border-utility-success-200` | 2 | foundations/featured-icon/featured-icon.tsx:44,61 | `rgb(29 106 72)` | `--color-status-success-border` | `--border-color-utility-success-200` | badge border token (amendment) |
| `border-utility-warning-200` | 2 | foundations/featured-icon/featured-icon.tsx:43,60 | `rgb(122 45 15)` | `--color-status-warn-border` | `--border-color-utility-warning-200` | badge border token (amendment) |
| `fill-utility-gray-100` | 64 | shared-assets/illustrations/box.tsx:27,28,29,30,31,108,109,110,111,112,189,190,191,192,193,194<br>shared-assets/illustrations/cloud.tsx:27,29,30,31,32,110,112,113,114,115,194,195,196,197,198,199<br>shared-assets/illustrations/credit-card.tsx:27,28,29,30,31,122,123,124,125,126,215,216,217,218,219,220<br>shared-assets/illustrations/documents.tsx:27,28,29,30,31,199,200,201,202,203,371,372,373,374,375,376 | `rgb(51 51 51)` | `--color-bg-elevated` | `--fill-utility-gray-100` |  |
| `fill-utility-gray-200` | 21 | shared-assets/illustrations/box.tsx:38,43,119,124,201,206<br>shared-assets/illustrations/credit-card.tsx:44,47,139,142,233,236<br>shared-assets/illustrations/documents.tsx:42,54,66,214,226,238,387,399,411 | `rgb(64 64 64)` | `--color-border` | `--fill-utility-gray-200` |  |
| `fill-utility-gray-300` | 15 | shared-assets/illustrations/credit-card.tsx:46,50,54,58,62,141,145,149,153,157,235,239,243,247,251 | `rgb(64 64 64)` | `--color-border` | `--fill-utility-gray-300` |  |
| `fill-utility-gray-50` | 6 | shared-assets/illustrations/box.tsx:33,40,114,121,196,203 | `rgb(40 40 40)` | `--color-bg-surface` | `--fill-utility-gray-50` | illustration fill |
| `outline-utility-brand-100` | 1 | ui/badge/badge-groups.tsx:87 | `rgb(4 57 87)` | `--color-primary-muted` | `--outline-color-utility-brand-100` |  |
| `outline-utility-error-100` | 1 | ui/badge/badge-groups.tsx:93 | `rgb(78 24 26)` | `--color-status-danger-muted` | `--outline-color-utility-error-100` |  |
| `outline-utility-gray-100` | 1 | ui/badge/badge-groups.tsx:90 | `rgb(51 51 51)` | `--color-border-subtle` | `--outline-color-utility-gray-100` |  |
| `outline-utility-success-100` | 1 | ui/badge/badge-groups.tsx:99 | `rgb(21 75 51)` | `--color-status-success-muted` | `--outline-color-utility-success-100` |  |
| `outline-utility-warning-100` | 1 | ui/badge/badge-groups.tsx:96 | `rgb(87 32 11)` | `--color-status-warn-muted` | `--outline-color-utility-warning-100` |  |
| `ring-utility-blue-200` | 1 | ui/badge/badge.tsx:45 | — | `--color-primary-border` | `--ring-color-utility-blue-200` | blue → primary; badge border token (amendment) |
| `ring-utility-blue-light-200` | 1 | ui/badge/badge.tsx:40 | — | `--color-primary-border` | `--ring-color-utility-blue-light-200` | blue-light → primary; badge border token (amendment) |
| `ring-utility-brand-200` | 3 | ui/badge/badge-groups.tsx:60,61<br>ui/badge/badge.tsx:15 | `rgb(6 83 126)` | `--color-primary-border` | `--ring-color-utility-brand-200` | badge border token (amendment) |
| `ring-utility-error-200` | 3 | ui/badge/badge-groups.tsx:70,71<br>ui/badge/badge.tsx:20 | `rgb(110 35 37)` | `--color-status-danger-border` | `--ring-color-utility-error-200` | badge border token (amendment) |
| `ring-utility-gray-200` | 3 | ui/badge/badge-groups.tsx:65,66<br>ui/badge/badge.tsx:10 | `rgb(64 64 64)` | `--color-border` | `--ring-color-utility-gray-200` |  |
| `ring-utility-gray-blue-200` | 1 | ui/badge/badge.tsx:35 | — | `--color-border` | `--ring-color-utility-gray-blue-200` | collapses gray-blue into neutral |
| `ring-utility-indigo-200` | 1 | ui/badge/badge.tsx:50 | — | `--color-primary-border` | `--ring-color-utility-indigo-200` | indigo → primary; badge border token (amendment) |
| `ring-utility-orange-200` | 1 | ui/badge/badge.tsx:65 | — | `--color-status-warn-border` | `--ring-color-utility-orange-200` | orange → warn; badge border token (amendment) |
| `ring-utility-pink-200` | 1 | ui/badge/badge.tsx:60 | — | `--color-status-danger-border` | `--ring-color-utility-pink-200` | pink → danger; badge border token (amendment) |
| `ring-utility-purple-200` | 1 | ui/badge/badge.tsx:55 | — | `--color-border` | `--ring-color-utility-purple-200` | purple → neutral ladder (no Vanyshr purple; not brand cyan) |
| `ring-utility-success-200` | 3 | ui/badge/badge-groups.tsx:80,81<br>ui/badge/badge.tsx:30 | `rgb(29 106 72)` | `--color-status-success-border` | `--ring-color-utility-success-200` | badge border token (amendment) |
| `ring-utility-warning-200` | 3 | ui/badge/badge-groups.tsx:75,76<br>ui/badge/badge.tsx:25 | `rgb(122 45 15)` | `--color-status-warn-border` | `--ring-color-utility-warning-200` | badge border token (amendment) |
| `text-utility-blue-400` | 1 | ui/badge/badge.tsx:47 | — | `--color-primary` | `--text-color-utility-blue-400` | collapses blue into primary |
| `text-utility-blue-500` | 3 | ui/avatar/base-components/verified-tick.tsx:20<br>ui/badge/badge.tsx:46,47 | — | `--color-primary` | `--text-color-utility-blue-500` | collapses blue into primary |
| `text-utility-blue-700` | 1 | ui/badge/badge.tsx:45 | — | `--color-primary-text` | `--text-color-utility-blue-700` | collapses blue into primary |
| `text-utility-blue-light-400` | 1 | ui/badge/badge.tsx:42 | — | `--color-primary` | `--text-color-utility-blue-light-400` | collapses blue-light into primary |
| `text-utility-blue-light-500` | 2 | ui/badge/badge.tsx:41,42 | — | `--color-primary` | `--text-color-utility-blue-light-500` | collapses blue-light into primary |
| `text-utility-blue-light-700` | 1 | ui/badge/badge.tsx:40 | — | `--color-primary-text` | `--text-color-utility-blue-light-700` | collapses blue-light into primary |
| `text-utility-brand-400` | 1 | ui/badge/badge.tsx:17 | `rgb(11 143 217)` | `--color-primary` | `--text-color-utility-brand-400` |  |
| `text-utility-brand-500` | 3 | ui/badge/badge-groups.tsx:62<br>ui/badge/badge.tsx:16,17 | `rgb(20 171 254)` | `--color-primary` | `--text-color-utility-brand-500` |  |
| `text-utility-brand-700` | 2 | ui/badge/badge-groups.tsx:60<br>ui/badge/badge.tsx:15 | `rgb(95 198 254)` | `--color-primary-text` | `--text-color-utility-brand-700` |  |
| `text-utility-error-400` | 1 | ui/badge/badge.tsx:22 | `rgb(188 59 63)` | `--color-status-danger` | `--text-color-utility-error-400` |  |
| `text-utility-error-500` | 3 | ui/badge/badge-groups.tsx:72<br>ui/badge/badge.tsx:21,22 | `rgb(229 72 77)` | `--color-status-danger` | `--text-color-utility-error-500` |  |
| `text-utility-error-700` | 2 | ui/badge/badge-groups.tsx:70<br>ui/badge/badge.tsx:20 | `rgb(237 131 134)` | `--color-status-danger` | `--text-color-utility-error-700` | no -text variant for status tokens |
| `text-utility-gray-100` | 15 | shared-assets/illustrations/box.tsx:78,159,233<br>shared-assets/illustrations/credit-card.tsx:92,185,279<br>shared-assets/illustrations/documents.tsx:161,165,169,333,337,341,506,510,514 | `rgb(51 51 51)` | `--color-bg-elevated` | `--text-color-utility-gray-100` |  |
| `text-utility-gray-200` | 12 | shared-assets/illustrations/box.tsx:79,160,234<br>shared-assets/illustrations/cloud.tsx:72,76,80,156,160,164,249,253,257 | `rgb(64 64 64)` | `--color-border` | `--text-color-utility-gray-200` |  |
| `text-utility-gray-400` | 2 | ui/badge/badge.tsx:12,91 | `rgb(64 64 64)` | `--color-text-tertiary` | `--text-color-utility-gray-400` |  |
| `text-utility-gray-50` | 21 | shared-assets/illustrations/cloud.tsx:73,77,81,157,161,165,250,254,258<br>shared-assets/illustrations/credit-card.tsx:93,186,280<br>shared-assets/illustrations/documents.tsx:162,166,170,334,338,342,507,511,515 | `rgb(40 40 40)` | `--color-bg-surface` | `--text-color-utility-gray-50` | illustration fill |
| `text-utility-gray-500` | 5 | ui/badge/badge-groups.tsx:20,67<br>ui/badge/badge.tsx:11,12,91 | `rgb(163 163 163)` | `--color-text-tertiary` | `--text-color-utility-gray-500` |  |
| `text-utility-gray-700` | 2 | ui/badge/badge-groups.tsx:65<br>ui/badge/badge.tsx:10 | `rgb(163 163 163)` | `--color-text-secondary` | `--text-color-utility-gray-700` |  |
| `text-utility-gray-blue-400` | 1 | ui/badge/badge.tsx:37 | — | `--color-text-tertiary` | `--text-color-utility-gray-blue-400` | collapses gray-blue into neutral |
| `text-utility-gray-blue-500` | 2 | ui/badge/badge.tsx:36,37 | — | `--color-text-tertiary` | `--text-color-utility-gray-blue-500` | collapses gray-blue into neutral |
| `text-utility-gray-blue-700` | 1 | ui/badge/badge.tsx:35 | — | `--color-text-secondary` | `--text-color-utility-gray-blue-700` | collapses gray-blue into neutral |
| `text-utility-indigo-400` | 1 | ui/badge/badge.tsx:52 | — | `--color-primary` | `--text-color-utility-indigo-400` | collapses indigo into primary |
| `text-utility-indigo-500` | 2 | ui/badge/badge.tsx:51,52 | — | `--color-primary` | `--text-color-utility-indigo-500` | collapses indigo into primary |
| `text-utility-indigo-700` | 1 | ui/badge/badge.tsx:50 | — | `--color-primary-text` | `--text-color-utility-indigo-700` | collapses indigo into primary |
| `text-utility-orange-400` | 1 | ui/badge/badge.tsx:67 | — | `--color-status-warn` | `--text-color-utility-orange-400` | collapses orange into warn |
| `text-utility-orange-500` | 2 | ui/badge/badge.tsx:66,67 | — | `--color-status-warn` | `--text-color-utility-orange-500` | collapses orange into warn |
| `text-utility-orange-700` | 1 | ui/badge/badge.tsx:65 | — | `--color-status-warn` | `--text-color-utility-orange-700` | collapses orange into warn; no -text variant for status tokens |
| `text-utility-pink-400` | 1 | ui/badge/badge.tsx:62 | — | `--color-status-danger` | `--text-color-utility-pink-400` | collapses pink into danger |
| `text-utility-pink-500` | 2 | ui/badge/badge.tsx:61,62 | — | `--color-status-danger` | `--text-color-utility-pink-500` | collapses pink into danger |
| `text-utility-pink-700` | 1 | ui/badge/badge.tsx:60 | — | `--color-status-danger` | `--text-color-utility-pink-700` | collapses pink into danger; no -text variant for status tokens |
| `text-utility-purple-400` | 1 | ui/badge/badge.tsx:57 | — | `--color-text-tertiary` | `--text-color-utility-purple-400` | purple → neutral ladder (no Vanyshr purple; not brand cyan) |
| `text-utility-purple-500` | 2 | ui/badge/badge.tsx:56,57 | — | `--color-text-tertiary` | `--text-color-utility-purple-500` | purple → neutral ladder (no Vanyshr purple; not brand cyan) |
| `text-utility-purple-700` | 1 | ui/badge/badge.tsx:55 | — | `--color-text-secondary` | `--text-color-utility-purple-700` | purple → neutral ladder (no Vanyshr purple; not brand cyan) |
| `text-utility-success-400` | 1 | ui/badge/badge.tsx:32 | `rgb(50 180 124)` | `--color-status-success` | `--text-color-utility-success-400` |  |
| `text-utility-success-500` | 3 | ui/badge/badge-groups.tsx:82<br>ui/badge/badge.tsx:31,32 | `rgb(61 220 151)` | `--color-status-success` | `--text-color-utility-success-500` |  |
| `text-utility-success-700` | 2 | ui/badge/badge-groups.tsx:80<br>ui/badge/badge.tsx:30 | `rgb(123 231 184)` | `--color-status-success` | `--text-color-utility-success-700` | no -text variant for status tokens |
| `text-utility-warning-400` | 1 | ui/badge/badge.tsx:27 | `rgb(209 77 25)` | `--color-status-warn` | `--text-color-utility-warning-400` |  |
| `text-utility-warning-500` | 3 | ui/badge/badge-groups.tsx:77<br>ui/badge/badge.tsx:26,27 | `rgb(255 94 31)` | `--color-status-warn` | `--text-color-utility-warning-500` |  |
| `text-utility-warning-700` | 2 | ui/badge/badge-groups.tsx:75<br>ui/badge/badge.tsx:25 | `rgb(255 146 103)` | `--color-status-warn` | `--text-color-utility-warning-700` | no -text variant for status tokens |

## Component-specific (avatar, slider, toggle, store badge, type size)

| Class | Uses | Sites | Old (pre-bible) | Token | Alias | Notes |
|---|---|---|---|---|---|---|
| `bg-avatar-bg` | 1 | ui/avatar/avatar.tsx:117 | `rgb(51 51 51)` | `--color-bg-elevated` | `--background-color-avatar-bg` |  |
| `bg-slider-handle-bg` | 1 | ui/slider/slider.tsx:55 | `rgb(20 171 254)` | `--color-primary` | `--background-color-slider-handle-bg` | old = cyan |
| `bg-toggle-button-fg_disabled` | 1 | ui/toggle/toggle.tsx:63 | `rgb(64 64 64)` | `--color-state-disabled-fg` | `--background-color-toggle-button-fg_disabled` |  |
| `border-toggle-border` | 1 | ui/toggle/toggle.tsx:66 | `rgb(0 0 0 / 0)` | `--color-border` | `--border-color-toggle-border` |  |
| `border-toggle-slim-border_pressed` | 1 | ui/toggle/toggle.tsx:67 | `rgb(0 0 0 / 0)` | `--color-primary` | `--border-color-toggle-slim-border_pressed` |  |
| `border-toggle-slim-border_pressed-hover` | 1 | ui/toggle/toggle.tsx:68 | `rgb(0 0 0 / 0)` | `--color-primary-hover` | `--border-color-toggle-slim-border_pressed-hover` |  |
| `fill-border-secondary_alt` | 1 | shared-assets/illustrations/cloud.tsx:217 | `rgb(255 255 255 / 0.10)` | `--color-border-subtle` | `--fill-border-secondary_alt` |  |
| `outline-avatar-contrast-border` | 2 | ui/avatar/avatar-profile-photo.tsx:68<br>ui/avatar/avatar.tsx:120 | `rgb(255 255 255 / 0.12)` | `--color-border-subtle` | `--outline-color-avatar-contrast-border` |  |
| `ring-app-store-badge-border` | 5 | ui/buttons/app-store-buttons.tsx:11,161,237,343,468 | `rgb(255 255 255)` | `--color-border-strong` | `--ring-color-app-store-badge-border` | third-party store badge |
| `ring-slider-handle-border` | 1 | ui/slider/slider.tsx:55 | `rgb(30 30 30)` | `--color-primary` | `--ring-color-slider-handle-border` |  |
| `stroke-border-secondary_alt` | 16 | shared-assets/illustrations/box.tsx:36,117,199<br>shared-assets/illustrations/cloud.tsx:41<br>shared-assets/illustrations/credit-card.tsx:39,134,228<br>shared-assets/illustrations/documents.tsx:39,51,63,211,223,235,384,396,408 | `rgb(255 255 255 / 0.10)` | `--color-border-subtle` | `--stroke-border-secondary_alt` |  |
| `text-display-xl` | 4 | ui/avatar/avatar-profile-photo.tsx:29<br>ui/pin-input/pin-input.tsx:80,112,120 | `calc(0.25rem * 15)` | `--size-display` | `--text-display-xl` | font-size, not color: add --text-display-xl alias like the other display sizes |

---
201 transitional aliases.
