# UI Comparison: Dense vs. Simple

## Side-by-Side Comparison

### Home Screen

**Dense UI (`/dashboard/home`)**
```
┌─────────────────────────────────────────┐
│ [Profile Avatar] ▼         [Settings] │
├─────────────────────────────────────────┤
│ Exposure Summary              [30D ▼]  │
│                                         │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │BROKER│ │BREACH│ │REMOV.│ │REMOV.│  │
│ │  14  │ │  2   │ │ SUBD │ │CONFD │  │
│ │  +3  │ │  +2  │ │  12  │ │  31  │  │
│ └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│ Updates                      2 new      │
│ ┌─────────────────────────────────────┐│
│ │ [!] New breach detected              ││
│ │ Your data found in Example Breach    ││
│ │ [View Details]         [Dismiss]    ││
│ └─────────────────────────────────────┘│
│                                         │
│ Scan Status               [View All]   │
│ ┌─────────────────────────────────────┐│
│ │ [📊] Dark Web Scan    IN PROGRESS  ││
│ │     Searching breach dumps    10m  ││
│ └─────────────────────────────────────┘│
│ ┌─────────────────────────────────────┐│
│ │ [🔍] Broker Scan      COMPLETE     ││
│ │     253 sources scanned       2h   ││
│ └─────────────────────────────────────┘│
│                                         │
│ Recent Activity          [View All]    │
│ ┌─────────────────────────────────────┐│
│ │ [✓] Spokeo           COMPLETE      ││
│ │     Record removed           1d    ││
│ └─────────────────────────────────────┘│
│                                         │
│ Brokers & Breaches       [View All]    │
│ ┌─────────────────────────────────────┐│
│ │ [AC] Acxiom                    →   ││
│ │     • Exposed · High Risk          ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌───────────────────────────────────┐  │
│ │[Home][Exposures][Tasks][Activity] │  │
│ └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Simple UI (`/simple/home`)**
```
┌─────────────────────────────────────────┐
│ [🛡️] Vanyshr              Settings    │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│ Hi, James                              │
│ Everything looks good.                  │
│ We're keeping watch.                   │
│                                         │
│                                         │
│ Your status                            │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ Protection active                  │  │
│ │                                    │  │
│ │ We're monitoring for exposures     │  │
│ │ and working on removals.          →│  │
│ └───────────────────────────────────┘  │
│                                         │
│                                         │
│ Quick actions                          │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ Run a new scan                   →│  │
│ └───────────────────────────────────┘  │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ View removal requests            →│  │
│ └───────────────────────────────────┘  │
│                                         │
│                                         │
│                                         │
│                                         │
│ Need help? Chat with us               │
└─────────────────────────────────────────┘
```

### Onboarding

**Dense UI (`/onboarding/primary-info`)**
```
┌─────────────────────────────────────────┐
│          What we'll need from you       │
│                                         │
│ To find and remove your data, confirm: │
│ • Legal name and date of birth         │
│ • Phone numbers associated with you    │
│ • Any aliases or alternate names       │
│ • Current and past addresses           │
│ • Email addresses linked to identity   │
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ First name                          ││
│ │ [________________________]          ││
│ │                                     ││
│ │ Last name                           ││
│ │ [________________________]          ││
│ │                                     ││
│ │ Date of birth                       ││
│ │ [________________________]          ││
│ │                                     ││
│ │          [Continue]                 ││
│ └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Simple UI (`/simple/onboarding/name`)**
```
┌─────────────────────────────────────────┐
│ ← Back       [🛡️] Vanyshr              │
├─────────────────────────────────────────┤
│                                         │
│ ① of 4                                 │
│                                         │
│ What's your legal name?                │
│                                         │
│ We need this to find where your        │
│ data is listed.                        │
│                                         │
│                                         │
│ First name                             │
│ ┌───────────────────────────────────┐  │
│ │ Jane                              │  │
│ └───────────────────────────────────┘  │
│                                         │
│ Last name                              │
│ ┌───────────────────────────────────┐  │
│ │ Doe                               │  │
│ └───────────────────────────────────┘  │
│                                         │
│ Date of birth                          │
│ ┌───────────────────────────────────┐  │
│ │ 01/15/1990                        │  │
│ └───────────────────────────────────┘  │
│                                         │
│                                         │
│                                         │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │      Continue →                   │  │
│ └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Key Differences

### Information Density
- **Dense:** 4 metrics + 3 activity sections + navigation = ~15 elements on screen
- **Simple:** 1 status card + 2 actions + footer = 4 elements on screen

### Copy Style
- **Dense:** "Exposure Summary", "Brokers & Breaches", "Recent Activity"
- **Simple:** "Hi, James", "Everything looks good", "We're keeping watch"

### Chrome
- **Dense:** Profile dropdown, time filter, info icons, multiple nav tabs
- **Simple:** Single header, back button, minimal nav

### White Space
- **Dense:** Tight 4px-8px gaps, packed layouts
- **Simple:** Generous 16px-32px gaps, breathing room

### Actions
- **Dense:** Multiple CTAs per section (View Details, Dismiss, View All)
- **Simple:** One primary action per card

### Color
- **Dense:** Dark theme (#0B1B2B), colored status indicators
- **Simple:** White background, minimal color (blue accent only)

## Use Cases

### Dense UI Best For:
- Power users who want all info at once
- Desktop/laptop primary usage
- Data-heavy workflows (reviewing breaches, tracking removals)
- Users comfortable with dashboards

### Simple UI Best For:
- First-time users / onboarding
- Mobile-first usage
- Quick status checks
- Users who prefer simplicity over density
- Conversational, guided experience

## Testing Strategy

1. **A/B split:** Route 50% new signups to each variant
2. **Track metrics:**
   - Onboarding completion rate
   - Time to first action
   - Feature discovery
   - Daily active usage
3. **User preference:** Allow switching via settings
4. **Measure outcomes:** Which UI drives better engagement and retention?

---

Both UIs access the same data, auth, and business logic. This is purely a presentation layer experiment.
