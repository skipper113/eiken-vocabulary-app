# Mina's K-pop Dream Diary - 英検2級 Vocabulary Learning App

An interactive web application for learning Eiken Grade 2 vocabulary through an engaging diary story of an 11-year-old girl pursuing her K-pop dreams.

## Features

- 📖 30-day diary story incorporating all 2,300 Eiken Grade 2 vocabulary words
- 🎯 Bold vocabulary words are highlighted in the text
- 📚 Left sidebar shows vocabulary words with Japanese translations
- 🔄 Navigate between days with Previous/Next buttons or arrow keys
- 🌏 Both English diary entries and Japanese translations
- 📱 Responsive design for mobile and desktop

## How to Run

### Option 1: Using Python (Recommended)
```bash
# Navigate to the project directory
cd /Users/yohei/eiken2

# Run the server
python3 server.py

# Open your browser to http://localhost:8000
```

### Option 2: Using Node.js
```bash
# If you have Node.js installed
npx http-server -p 8000

# Open your browser to http://localhost:8000
```

### Option 3: Direct File Opening
Some browsers may allow you to open the HTML file directly, but this might not work due to CORS restrictions when loading the .md and .csv files.

## Files

- `index.html` - Main web page
- `diary-app.js` - JavaScript application logic
- `mina_kpop_diary.md` - The diary content with all vocabulary
- `eiken2.csv` - Vocabulary list with Japanese translations
- `server.py` - Simple Python server for local development

## Navigation

- **Arrow Keys**: Use ← and → to navigate between days
- **Buttons**: Click "Previous Day" or "Next Day"
- **Vocabulary Panel**: Scroll to see all vocabulary words for the current day
- **Diary Panel**: Scroll to read the full diary entry and Japanese translation

## Learning Tips

1. Read the English diary entry first
2. Try to understand the bold vocabulary words from context
3. Check the vocabulary panel for translations
4. Read the Japanese translation to confirm understanding
5. Move to the next day when ready

Enjoy learning with Mina's K-pop journey! 🎤✨