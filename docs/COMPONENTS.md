# Vanyshr components

Seeded catalog — every row names its owning library per DESIGN.md §12. Export names ground-truthed 2026-09-17 against the installed versions (konsta 5.4.0, react 19.3, tailwindcss 4.3.3, lucide-react 0.563.0, recharts 2.15.4); all Konsta / Recharts / Lucide names verified present.

## Chrome (Konsta)

| Name | Library | Import | Variants | When to use | When not to use |
|---|---|---|---|---|---|
| Page | Konsta | `konsta/react` | — | Every screen root | — |
| Navbar | Konsta | `konsta/react` | with back link | Per-screen top bar | Never build a custom top bar |
| Tabbar / TabbarLink | Konsta | `konsta/react` | — | App bottom navigation | Never build custom tabs |
| Sheet | Konsta | `konsta/react` | snap points | Any overlay covering the screen | Never use Radix Dialog for screen overlays |
| Actions (action sheet) | Konsta | `konsta/react` | — | Choice lists, destructive confirmations | — |
| Dialog | Konsta | `konsta/react` | — | Small alerts | For full-screen flows use Sheet |
| List / ListItem | Konsta | `konsta/react` | grouped, media | Settings rows, menus | Not for data tables — use shadcn Table |
| Segmented | Konsta | `konsta/react` | — | 2–4 mutually exclusive view switches | Not for form input |
| Toggle | Konsta | `konsta/react` | — | Binary settings in chrome | Inside forms use shadcn Switch |
| Searchbar | Konsta | `konsta/react` | — | Screen-level search | Not inside forms |
| Toast | Konsta | `konsta/react` | — | Transient confirmations | Not for errors that need action |
| Preloader | Konsta | `konsta/react` | — | Blocking waits | Not for content skeletons — use shadcn Skeleton |

## Content (shadcn / Radix)

Repo layout, ground-truthed 2026-09-17. **shadcn-convention rename completed 2026-09-17** (mechanical `git mv`): `packages/ui/src/components/base/` → `packages/ui/src/components/ui/`, with canonical singular names (`badges` → `badge`, `radio-buttons` → `radio-group`). All 64 import sites updated; typecheck passes across all 8 packages.

Import pattern used in `apps/app`: `@vanyshr/ui/components/ui/<component>/<component>` (explicit path). Everything is also top-level exported from `@vanyshr/ui` **except** Table and Tabs — name collision with `packages/ui/src/components/application/{table,tabs}`, so import those two via full path only.

**Scaffolded 2026-09-17:** card, switch, table, tabs, separator, skeleton are hand-written (shadcn CLI could not run against this monorepo / Tailwind v4 config) and theme-verified — zero hardcoded hex colors, all use theme CSS variables. Notes: Switch is built on Radix Switch (`@radix-ui/react-switch`); Tabs is built on Radix Tabs (`@radix-ui/react-tabs`) — both reverted to Radix on 2026-09-17 per DESIGN.md §12 (the first hand-scaffold used react-aria-components / a custom input; caught and reverted before the bible port); Table exports Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell. Combobox and EmptyState are §12-owned but not yet in the repo — adopt during conversion (marked in the table).

| Name | Library | Import | Variants | When to use | When not to use |
|---|---|---|---|---|---|
| Button | shadcn | `packages/ui/src/components/ui/button` | primary, secondary, ghost, destructive | Content actions | Not for tab bar / nav chrome |
| Card | shadcn | `packages/ui/src/components/ui/card` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter | Content grouping, chart containers | Not for full-screen overlays |
| EmptyState | shadcn | `packages/ui/src/components/ui/empty-state` — adopt during conversion | — | Empty list / empty screen placeholders | Not for loading states — use Skeleton |
| Input / Textarea | shadcn | `packages/ui/src/components/ui/input` | — | Form fields (min 44px height, §14) | — |
| Label | shadcn | `packages/ui/src/components/ui/label` | — | Every field gets one | Never placeholder-as-label |
| Select | shadcn | `packages/ui/src/components/ui/select` | — | 5+ option choices | 2–4 options → Konsta Segmented |
| Combobox | shadcn | `packages/ui/src/components/ui/combobox` — adopt during conversion | — | Searchable option pickers in forms | — |
| Checkbox / RadioGroup | shadcn | `packages/ui/src/components/ui/checkbox`, `packages/ui/src/components/ui/radio-group` | — | Multi / single choice in forms | — |
| Switch | shadcn | `packages/ui/src/components/ui/switch` | — | Binary input inside forms | Settings chrome → Konsta Toggle |
| Table | shadcn | `packages/ui/src/components/ui/table` — full-path import only | — | Data tables | Not for settings rows — use Konsta List |
| Badge | shadcn | `packages/ui/src/components/ui/badge` | status variants | Status pills, counts | Colors from status tokens only |
| Tabs | shadcn | `packages/ui/src/components/ui/tabs` — full-path import only | TabsList, TabsTrigger, TabsContent | Content-level tabbed panels | Not for app navigation |
| Separator | shadcn | `packages/ui/src/components/ui/separator` | horizontal / vertical | Dividers in content | — |
| Skeleton | shadcn | `packages/ui/src/components/ui/skeleton` | — | Content loading states | Not for blocking waits |

## Data visualization

| Name | Library | Import | Variants | When to use | When not to use |
|---|---|---|---|---|---|
| Chart | viz (Recharts) | `recharts` | Line, Bar, Area | Data visualization inside shadcn Cards | Never invent series colors — §13 palette |

## Icons

| Name | Library | Import | Variants | When to use | When not to use |
|---|---|---|---|---|---|
| Icon | lucide-react | `lucide-react` | — | Every icon in the app | No other icon package, no emoji-as-icons |
