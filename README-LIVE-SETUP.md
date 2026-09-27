# 2-Wheeler Parking — Live Safari/Chrome Website

The website is configured for the Supabase project supplied by the society admin.

## Files to publish

Publish only:
- index.html
- admin.html
- app.js
- admin.js
- styles.css
- config.js
- parking-map.jpg

Do NOT publish:
- private_setup.sql
- member_access_codes.csv
- any database password or Supabase secret/service-role key

## GitHub Pages

1. Create a GitHub repository (public is fine for this application code).
2. Upload the seven files above.
3. Repository → Settings → Pages.
4. Under Build and deployment, select **Deploy from a branch**.
5. Select `main` and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish.
7. Open the resulting `https://...github.io/.../` address in Safari or Chrome.

## Website addresses

Member page:
`https://YOUR-GITHUB-PAGES-ADDRESS/`

Admin page:
`https://YOUR-GITHUB-PAGES-ADDRESS/admin.html`

## Important

The Supabase publishable key is intended for browser use. Never replace it with a Supabase secret/service-role key.

Before the real allocation, test with two phones and the admin page. Confirm:
- member login works
- current-turn member can select
- the selected slot becomes unavailable to everyone
- the current index advances automatically
- the next member's page changes to "YOUR TURN"
- admin pause/resume works
- admin undo works

## Member access codes

Keep `member_access_codes.csv` private and send each member only their own access code.
