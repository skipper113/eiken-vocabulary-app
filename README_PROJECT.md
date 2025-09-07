# Eiken Vocabulary Learning App

An interactive web application for learning Eiken vocabulary through engaging story-based lessons.

## Features

- 📚 Multiple Eiken levels (Grade 1, Pre-1, 2, and 3)
- 📖 Story-based learning with contextual vocabulary
- ✏️ Interactive quiz modes
- ⌨️ Typing practice games
- 🎯 Missed words tracking and focused practice
- 🌓 Dark/Light theme support
- 📱 Mobile-responsive design

## Setup Instructions

### 1. GitHub Setup

1. Create a new **private** repository on GitHub:
   - Go to https://github.com/new
   - Name it something like `eiken-vocabulary-app`
   - Set it to **Private**
   - Don't initialize with README (we already have files)

2. Connect your local repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   ```

3. Initial push:
   ```bash
   git add -A
   git commit -m "Initial commit"
   git branch -M main
   git push -u origin main
   ```

### 2. Netlify Setup

1. Go to [Netlify](https://app.netlify.com)
2. Sign up/Login (you can use your GitHub account)
3. Click "Add new site" → "Import an existing project"
4. Choose GitHub and authorize Netlify
5. Select your repository
6. Configure deployment:
   - **Build command**: (leave empty)
   - **Publish directory**: `.`
7. Click "Deploy site"

### 3. Automatic Deployment

After initial setup, use the deploy script:

```bash
./deploy.sh
```

This will:
- Commit all changes
- Push to GitHub
- Trigger automatic Netlify deployment

## File Structure

```
.
├── index.html           # Main application
├── diary-app.js         # Core JavaScript logic
├── *.csv               # Vocabulary data files
├── *.md                # Story content files
├── deploy.sh           # Deployment script
└── netlify.toml        # Netlify configuration
```

## Local Development

Simply open `index.html` in a web browser. No build process required!

## Custom Domain (Optional)

1. In Netlify, go to Site settings → Domain management
2. Add a custom domain
3. Follow DNS configuration instructions

## Environment

- Pure HTML/CSS/JavaScript (no build tools required)
- Static file hosting compatible
- Works offline after initial load

## Privacy Note

Keep your repository **private** if it contains personal learning data or customized content.