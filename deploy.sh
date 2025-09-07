#!/bin/bash

# Eiken Vocabulary App - GitHub & Netlify Deployment Script
# This script commits changes to GitHub which triggers Netlify deployment

echo "🚀 Starting deployment process..."

# Check if GitHub remote is configured
if ! git remote | grep -q origin; then
    echo "❌ No GitHub remote found!"
    echo "Please set up your GitHub repository first:"
    echo ""
    echo "1. Create a new PRIVATE repository on GitHub.com"
    echo "2. Run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "3. Run this script again"
    exit 1
fi

# Get current date for commit message
DATE=$(date +"%Y-%m-%d %H:%M:%S")

# Add all changes
echo "📦 Adding all changes..."
git add -A

# Commit with timestamp
echo "💾 Committing changes..."
git commit -m "Update: $DATE" -m "Automated deployment commit"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push -u origin main || git push -u origin master

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🌐 Netlify will automatically deploy from your GitHub repository"
    echo ""
    echo "If you haven't connected Netlify yet:"
    echo "1. Go to https://app.netlify.com"
    echo "2. Click 'Add new site' → 'Import an existing project'"
    echo "3. Choose GitHub and select your repository"
    echo "4. Deploy settings:"
    echo "   - Build command: (leave empty)"
    echo "   - Publish directory: ."
    echo "5. Click 'Deploy site'"
else
    echo "❌ Failed to push to GitHub. Please check your credentials and try again."
    exit 1
fi