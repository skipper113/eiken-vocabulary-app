# GitHub Pages Setup Instructions

## Enable GitHub Pages (One-time setup)

1. Go to your repository: https://github.com/skipper113/eiken-vocabulary-app
2. Click on **Settings** (top menu)
3. Scroll down to **Pages** section (left sidebar)
4. Under **Source**, select:
   - **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
5. Click **Save**

## Your Site URL

After enabling, your site will be available at:
```
https://skipper113.github.io/eiken-vocabulary-app/
```

It takes 2-10 minutes for the first deployment.

## Advantages over Netlify

- **No separate account needed** - Uses your GitHub account
- **Automatic deployment** - Every push to main updates the site
- **Free hosting** - No limits for public repos
- **Simple** - No build process needed for static sites
- **Custom domain support** - Can add your own domain if desired

## Check Deployment Status

1. Go to repository main page
2. Look for green checkmark ✓ next to latest commit
3. Click on it to see deployment details
4. Or visit Actions tab to see all deployments

## Troubleshooting

If site doesn't load:
1. Check Settings → Pages to ensure it's enabled
2. Wait 10 minutes for first deployment
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
4. Check Actions tab for any errors

## Note

Since we already have the site files in the root directory (index.html, etc.), GitHub Pages will serve them directly. No additional configuration needed!