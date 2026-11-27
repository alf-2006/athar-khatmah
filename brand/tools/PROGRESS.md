# PROGRESS NOTES (working file — delete before shipping if desired)

## Task (user, Arabic)
Apply the proposed design system to the Athar site for real + make logo, brand, favicon.
User mentioned skills: /muapi-3d-logo-animation and /favicon-gen.
Project: C:\Users\aboha\Desktop\ather (Vite + React, RTL Arabic). Memorial khatma for martyrs of a FIRE accident -> solemn tone, NO flame imagery, no red/orange celebratory feel.
Do not read/touch .env* files. Do not git commit unless asked.

## External sources (design research)
- Majlis Al-Qurra site CSS (Next.js/Tailwind): https://minshawihighcouncil.com/_next/static/css/51a8f5e4c14b4631.css
  :root --background #fdfbf7; --foreground #4a3b2a; --accent #b8860b; --accent-light #d4af37; --card-bg #ffffffb3; --card-border #d4af374d; --player-border #b8860b66; --player-shadow 0 20px 60px #b8860b26; --selection #d4af37; fonts: Cairo, Amiri, KFGQPC Naskh, UthmaniHafs; dark: #1a120b, #0f0a05, #3d342b, #c9a040 (12-15% borders), #4a3c1e; green #1a4a3b/#155e37; maroon (screenshots) #981818.
  Page: https://minshawihighcouncil.com/share
- App Store listings (screenshots measured): Wahy https://apps.apple.com/us/app/wahy-holy-quran/id1615454207 ; Majlis https://apps.apple.com/sa/app/6798995102?l=ar
  Wahy (±4): bg #f0e8d4, header bar #e8e0c8, toolbar green #305434/#508c54, CTA green #64b468, mint chip #d8e3d3, tan #b39465.
- Contrast findings: #d4af37 on #fdfbf7 = 2.03 (fail); #b8860b = 3.15 (large only); safe gold text #8a6508 = 5.15; white on #64b468 = 2.54 (fail, use dark text #173d34 = 4.72); white on #305434 = 8.59.
- Fonts: Cairo (UI), Amiri (display). Amiri-Bold/Regular + OFL downloaded to brand/tools/fonts from github.com/google/fonts ofl/amiri.

## Already created
- design-system/design-system.html, design-system/tokens.css, design-system/DESIGN.md (showcase, verified light+dark with headless Edge).
- brand/tools/fonts/Amiri-*.ttf ; python uharfbuzz + fontTools + PIL installed. No ImageMagick, no cairosvg, no muapi CLI/key.

## Plan
1. Logo: "Ripple of Beads" mark = gold diamond core + thin ring + ring of 30 beads (30 parts). Wordmark "أثر" from Amiri Bold via harfbuzz->SVG paths (ث dots gold). Tagline "خير يبقى وأثر لا ينقطع" Amiri Regular. Variants: color, reversed, mono; horizontal + stacked.
   Output to public/ (Vite): favicon.svg, favicon.ico (16/32/48), apple-touch-icon.png(180 solid), icon-192/512, icon-maskable-512, og-image.png(1200x630), site.webmanifest, logo-*.svg. Render PNG via headless Edge (C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe) + PIL downscale.
   Build script: brand/tools/build_brand.py
2. brand/brand-guidelines.html (Arabic).
3. Move tokens to src/tokens.css (single source), import in main.jsx; design-system html links ../src/tokens.css; remove design-system/tokens.css; update DESIGN.md.
4. Rewrite src/styles.css (readable, uses tokens, same class names), min font-size 11px, focus-visible, reduced motion, dark mode (data-theme + toggle, inline script in index.html), progress bar, diamond ornament, logo mark in topbar/hero/footer.
5. index.html: icons, manifest, theme-color, OG/Twitter tags (og:image absolute URL unknown -> check Vercel MCP for domain, else relative + note).
6. npm run build; verify with temp mock server + headless Edge screenshots (light/dark/mobile).
7. 3D logo animation: muapi CLI unavailable -> use manus-tools generate_image (3D logo from PNG ref; dignified material: satin gold + deep green enamel, NOT glossy chrome) then generate_video from image. Save to brand/3d/.
8. Final answer in Arabic (Egyptian-friendly MSA), link files, mention substitutions/limits.


---
# STATUS UPDATE (15:33) — supersedes Plan above where different
Production domain (Vercel MCP list_project_domains; project athar-khatmah prj_KFtRiBvlIk6gSDGlQ6odu4EryCHS): https://athar-khatmah.vercel.app

## DONE
- brand/tools/build_brand.py generates everything: brand/logo/*.svg (mark/wordmark/horizontal/stacked x color/reversed/mono/mono-white + app-icon, maskable, apple-touch, og), public/favicon.svg, logo-mark(.reversed).svg, logo-horizontal(.reversed).svg, favicon.ico (16/32/48), apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png, og-image.png, site.webmanifest. Run: python brand/tools/build_brand.py all
- Logo "Ripple of Beads": 30 beads (gold imam bead top), 2 rings, gold diamond w/ hole; wordmark Amiri Bold outlines (thaa dots gold); favicon simplified (ring + imam bead + diamond on forest rounded square).
- Site: src/tokens.css (single source), src/Logo.jsx (Logo, Ornament), src/styles.css rewritten, src/main.jsx updated (logo, theme toggle, progress bar, skip link, modal aria/Escape), index.html (icons, manifest, OG/Twitter absolute domain, theme-color, no-flash theme script).
- npm run build OK. Verified via CDP light/dark desktop + mobile 390 + tablet 768: no horizontal overflow; toggle works (dataset, localStorage athar-theme, meta theme-color); modal OK.
- Temp tools outside project: %TEMP%\ds\mock\server.mjs (port 4173, dist + mock /api/bookings, ?theme=light|dark), cdp.mjs (node cdp.mjs mobile:light modal:dark toggle desktop:dark tablet:light -> %TEMP%\ds\verify), tile2.py. KILL node server.mjs at the end.

## TODO
1. design-system/design-system.html: link ../src/tokens.css (currently ./tokens.css); delete design-system/tokens.css; update DESIGN.md refs.
2. brand/brand-guidelines.html (Arabic) + CDP screenshot check.
3. Quick contrast check of token pairs.
4. 3D logo animation: muapi CLI not installed / no MUAPI_API_KEY -> use manus-tools generate_image (ref png of mark) + generate_video; matte deep-green enamel + satin gold, dignified; save brand/3d/.
5. Cleanup: delete brand/tools/PROGRESS.md, kill mock server, git status (.gitignore had pre-existing change).
6. Final Arabic answer w/ links; mention muapi->Manus tools substitution; ask re commit/deploy.
