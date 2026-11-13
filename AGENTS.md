# Agent notes for patcox.net

Instructions for any agent (Claude Code or otherwise) working in this repo.
If you discover something new while working here that a future agent would
want to know, add it to this file.

## Hosting

The site is built and served by Vercel (Git integration; production deploys
from `main`, preview deploys on PRs) at patcox.net. GitHub Pages is turned
off — don't add a Pages workflow, `CNAME`, or `.nojekyll`. The repo was
renamed from `patcox.github.io` to `personal-website` in October 2026, so
local clones may still sit in a `patcox.github.io` directory.

## /now page

Whenever you edit `src/content/pages/now.md`, update the `lastUpdated` field
in its frontmatter to the current date (format: `"Month D, YYYY"`, e.g.
`"July 2, 2026"`). This is a manual /now page — the date is the only signal
readers have that it's current, so don't leave it stale after a content edit.

## Images

Don't drop image files straight into `public/`. Put them in `src/assets/`
and reference them with Astro's `<Image>` component from `astro:assets`
(see `src/layouts/Base.astro` and `src/pages/index.astro` for examples).
This gets them resized/compressed/content-hashed at build time, which
matters a lot for perf — the header headshot went from a 445KB PNG served
raw on every navigation to a ~1KB hashed webp.

## Site config

`src/config/site.ts` has `showNow` / `showWriting` / `showNewsletter` flags
that gate whole pages/sections. Check these before assuming a page is live
in production — `showWriting` is currently `false`, so `/writing` and the
homepage "Recent writing" section don't render even though the code exists.

## CSS gotcha: `.section-label`

`.page-header p` (used on Connect/Now/Writing) has higher specificity than
the bare `.section-label` class, so `.page-header .section-label` carries
an explicit color override to win the cascade. If you touch either rule,
check both — it's easy to change the base class and have it silently
overridden in the page-header context.

## Contact form

The "Send a note" card on `/connect` posts to `api/contact.ts`. That's a
Vercel Function in the **repo-root `api/` directory**, not an Astro route.
Vercel deploys it alongside the static Astro build, so the site stays
`output: 'static'` with no adapter. Don't switch to `@astrojs/vercel`
without upgrading Astro first: the adapter version that supports Astro 4
(v7) only knows Node 18/20 and falls back to the retired `nodejs18.x`
runtime.

The handler checks the honeypot field, validates the input, verifies the
Cloudflare Turnstile token (siteverify, expected action `contact`, hostname
allowlist), then sends the message through Resend's REST API with
`reply_to` set to the visitor's address.

Env vars (set in Vercel → Project → Settings → Environment Variables):

| Name | Scope | What |
|---|---|---|
| `PUBLIC_TURNSTILE_SITEKEY` | build | Turnstile site key. If unset, the card and form are left out of the build. |
| `TURNSTILE_SECRET` | runtime | Turnstile secret key. |
| `TURNSTILE_HOSTNAMES` | runtime | Comma-separated hostnames siteverify must report, e.g. `patcox.net,www.patcox.net`. |
| `RESEND_API_KEY` | runtime | Resend key, sending-only. |
| `CONTACT_FROM` | runtime | Sender on a Resend-verified domain, e.g. `patcox.net <contact@mail.patcox.net>`. |
| `CONTACT_TO` | runtime | Where messages are delivered. |

For Preview and local runs, use Cloudflare's always-pass test keys (site key
`1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`)
with `TURNSTILE_HOSTNAMES=example.com`. Test tokens carry no action, and the
handler accepts them only when `VERCEL_ENV` isn't `production`.

`astro dev` doesn't serve `api/`. To test locally without the Vercel CLI,
build the site and run a small Node server that serves `dist/` and passes
`POST /api/contact` to the exported `POST(request)` (Node 23+ runs the `.ts`
directly). Set `CONTACT_TO=delivered@resend.dev` (Resend's test inbox) so
no real mail is sent. Turnstile's widget iframe renders blank in headless
Chromium, but it still issues the token.

## Screenshots / verification

Playwright isn't a project dependency. To visually verify a change:
```
npm install -D playwright
npm run dev -- --port 4321   # run in background
node your-screenshot-script.cjs   # launch with executablePath: '/opt/pw-browsers/chromium'
```
Then clean up afterward — kill the dev server, delete the script, and
`git checkout -- package.json package-lock.json` to drop the temporary
playwright dependency before committing.

## Pull requests

This repo squash-merges PRs, so the PR description becomes the permanent
commit message on `main` — it's the record, not the last commit's message.
**Every time you push additional commits to an already-open PR's branch,
update the PR title/body (`update_pull_request`) before ending your turn**
so it describes the full current diff, not just what was true when the PR
was first opened.
