# Admin app (private repository)

The internal admin UI is **not** in this public monorepo. It lives in a separate private GitHub repo:

**https://github.com/jamesringldr/vanyshr-admin** (private)

| Item | Location |
|------|----------|
| Admin UI | `vanyshr-admin` repo → Vercel → `admin.vanyshr.com` |
| Admin edge functions | `supabase/functions/admin-parse-html`, `admin-send-invite` (this repo) |
| Consumer pre-profile / invite gate | `apps/app` (this repo) |

When changing invite or parse behavior, coordinate changes across both repos and deploy edge functions from this monorepo.
