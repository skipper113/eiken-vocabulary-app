# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains educational materials for English language learning, specifically vocabulary for the Eiken Grade 2 (英検2級) English proficiency test.

## File Structure

- `eiken2.csv`: CSV file containing English-Japanese vocabulary pairs
  - Format: `en,jp` (English word/phrase, Japanese translation)
  - Contains approximately 1,900+ vocabulary entries
  - Includes parts of speech and usage notes in Japanese

## Working with the Vocabulary Data

The CSV file can be processed for various educational purposes:
- Creating flashcard applications
- Generating vocabulary quizzes
- Building study tools or apps
- Data analysis of vocabulary patterns

When manipulating the CSV:
- Preserve the UTF-8 encoding for Japanese characters
- The format is: English term, Japanese translation (with part of speech)
- Some entries include multiple meanings separated by commas in the Japanese column

## Auto-commit and Push Instructions

IMPORTANT: After creating new diary entries or making bug fixes, automatically:
1. Stage all changes: `git add -A`
2. Commit with descriptive message including what was changed
3. Push to GitHub: `git push origin main`

This ensures all changes are immediately backed up to GitHub and deployed via Netlify.