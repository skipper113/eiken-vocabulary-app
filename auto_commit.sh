#!/bin/bash

# Auto commit and push script
# This is called automatically by Claude when making changes

# Get commit message from argument or use default
MESSAGE="${1:-"Update: $(date +"%Y-%m-%d %H:%M:%S")"}"

# Add all changes
git add -A

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "No changes to commit"
    exit 0
fi

# Commit with message
git commit -m "$MESSAGE" -m "🤖 Generated with Claude Code" -m "Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
git push origin main

echo "✅ Changes committed and pushed to GitHub"