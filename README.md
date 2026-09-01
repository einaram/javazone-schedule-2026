# JavaZone Shareable Schedule Clone

A lightweight static web application clone of the [JavaZone 2026 Program](https://2026.javazone.no/program/) that lets you star sessions and encode your favorited schedule directly into a shareable URL (`?s=...`).

## Features

- **JavaZone Schedule & Design**: Styled to match JavaZone's dark theme, format badges, and time slots.
- **Shareable URLs**: Starred sessions are compressed into a query parameter `?s=...` in the URL bar. Copy and send your URL to share your custom schedule with friends or colleagues!
- **"My Schedule" View**: Toggle between full conference program and your starred sessions.
- **Search & Multi-filtering**: Search by title, abstract, or speaker name, and filter by day, format (Presentation, Workshop, Lightning Talk), or language (EN, NO).
- **SleepingPill API Integration**: Automatically fetches live conference session data with bundled offline fallbacks.

## Local Running

You can serve the files with any simple HTTP server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve .
```

Open `http://localhost:8000` in your browser.

## Publishing to GitHub Pages

1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Initialize JavaZone shareable schedule app"
   git push origin main
   ```
2. In your GitHub repository settings, navigate to **Settings > Pages**.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically build and publish your site!
