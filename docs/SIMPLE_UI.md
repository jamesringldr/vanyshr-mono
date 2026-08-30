# Simple UI Variant

A clean, minimal alternate UI for Vanyshr — designed for A/B testing against the current dense dashboard.

## Overview

The simple UI variant is a messenger-style interface with:
- Lots of whitespace
- Short, conversational copy
- One action at a time
- Calm, minimal chrome
- Simple cards instead of data-dense panels

## Routes

### Main Routes
- `/simple/home` — Main home screen (status, quick actions)
- `/simple/welcome` — Welcome/onboarding entry point

### Onboarding Flow
1. `/simple/onboarding/name` — Name & date of birth
2. `/simple/onboarding/phone` — Phone numbers (optional)
3. `/simple/onboarding/address` — Current address
4. `/simple/onboarding/complete` — Completion screen

### Feature Pages
- `/simple/status` — Protection status details
- `/simple/breaches` — Data breach alerts
- `/simple/scan` — Run a new scan
- `/simple/removals` — Removal request status
- `/simple/settings` — Settings (includes link to switch to dense UI)

## Design Principles

### Grok Bot Inspiration
The design borrows from Grok Bot's calm, conversational approach:
- **Messenger-simple:** Not a dashboard
- **Lots of air:** Generous spacing
- **Short copy:** One idea per screen
- **One action:** Single primary CTA
- **Calm chrome:** Minimal navigation

### What's Different from Dense UI

| Dense UI | Simple UI |
|----------|-----------|
| Information-dense cards | Minimal cards with breathing room |
| Multi-column layouts | Single-column, mobile-first |
| Metrics, charts, tables | Simple status messages |
| Complex navigation | Clean header + back buttons |
| Detailed copy | Conversational, brief |

## Development

### Local Setup
```bash
# Start dev server
pnpm dev

# Visit simple UI
open http://localhost:5173/simple/home

# Visit dense UI (unchanged)
open http://localhost:5173/dashboard
```

### File Structure
```
apps/app/src/pages/simple/
├── home.tsx                    # Main home screen
├── welcome.tsx                 # Welcome/entry
├── onboarding-name.tsx         # Step 1: Name & DOB
├── onboarding-phone.tsx        # Step 2: Phone numbers
├── onboarding-address.tsx      # Step 3: Address
├── onboarding-complete.tsx     # Completion
├── status.tsx                  # Protection status
├── breaches.tsx                # Breach alerts
├── scan.tsx                    # New scan
├── removals.tsx                # Removal requests
└── settings.tsx                # Settings
```

### Tech Stack
- **Same as main app:** React 19, Vite, TailwindCSS, Framer Motion
- **Reuses:** Auth, data models, Supabase integration, business logic
- **No new dependencies**

## A/B Testing

### Routing Users
To A/B test, route users to different entry points:

```typescript
// Example: Route based on user cohort
const shouldUseSimpleUI = user.cohort === 'simple-ui-test';
navigate(shouldUseSimpleUI ? '/simple/home' : '/dashboard');
```

### Metrics to Track
- **Onboarding completion rate**
- **Time to complete onboarding**
- **Engagement with quick actions**
- **Feature discovery (scan, removals, etc.)**
- **User preference (switching between UIs)**

### Switching Between UIs
Users can switch between UIs via settings:
- Simple → Dense: `/simple/settings` → "Switch to detailed view"
- Dense → Simple: Add similar link in dashboard settings

## What's Unchanged

✅ **All existing routes work**  
✅ **Dense dashboard UI untouched**  
✅ **Auth, data models, business logic**  
✅ **Supabase integration**  
✅ **Build process**

The simple UI is purely a presentation/IA variant — same product, different skin.

## Next Steps

1. **User testing:** Route cohort to `/simple/home` on signup
2. **Track metrics:** Compare completion rates, engagement
3. **Iterate:** Adjust based on user feedback
4. **Decide:** Choose winner or offer both as user preference

## Notes

- This is a **draft PR** — ready for review and testing
- All pages have proper loading, empty, and error states
- Real data integration (breaches, removals, etc.)
- Mobile-first, responsive design
- No new external dependencies

---

**Design inspiration:** Grok Bot  
**Goal:** A/B test simple vs. dense UI  
**Status:** Ready for user testing
