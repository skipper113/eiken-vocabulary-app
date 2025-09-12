// Diary data and vocabulary management
let currentDay = 1;
let diaryData = [];
let vocabularyData = {};
let allVocabularyWords = {}; // word -> {japanese: translation, days: [day numbers]}
let currentMode = 'reading'; // 'reading', 'quiz', or 'type'
let currentLevel = 'eiken2'; // 'eiken2', 'eiken3', 'eikenpre1', or 'eiken1'
let currentQuizWord = null;
let quizStats = {
    total: 0,
    correct: 0,
    incorrect: 0,
    currentStreak: 0,
    bestStreak: 0,
    missedWords: {} // word -> count of misses
};

// Type game variables
let typeMode = {
    isActive: false,
    startTime: null,
    endTime: null,
    currentWords: [],
    currentIndex: 0,
    correctCount: 0,
    skippedCount: 0,
    skippedWords: [], // Track which words were skipped
    currentEntry: '', // Store the full entry text
    rankings: [], // Array of {time: seconds, date: timestamp, wordCount: number}
    gameMode: 'typing', // 'typing' or 'multiple-choice'
    // Eiken 3 specific
    currentPhase: 'choice', // 'choice' or 'typing' for Eiken 3
    currentQuestion: null,
    isAnswered: false,
    choiceCorrect: false
};

// Load from localStorage (level-specific)
function loadStats() {
    const saved = localStorage.getItem(`quizStats_${currentLevel}`);
    if (saved) {
        quizStats = JSON.parse(saved);
        updateStatsDisplay();
    } else {
        // Initialize empty stats for this level
        quizStats = {
            total: 0,
            correct: 0,
            incorrect: 0,
            currentStreak: 0,
            bestStreak: 0,
            missedWords: {}
        };
    }
}

// Save to localStorage (level-specific)
function saveStats() {
    localStorage.setItem(`quizStats_${currentLevel}`, JSON.stringify(quizStats));
}

// Load vocabulary CSV
async function loadVocabulary() {
    try {
        // Clear existing vocabulary data
        vocabularyData = {};
        
        let csvFile;
        if (currentLevel === 'eiken3') {
            csvFile = 'eiken3.csv';
        } else if (currentLevel === 'eikenpre1') {
            csvFile = 'eikenpre1.csv';
        } else if (currentLevel === 'eiken1') {
            csvFile = 'eiken1.csv';
        } else {
            csvFile = 'eiken2.csv';
        }
        const response = await fetch(csvFile);
        const text = await response.text();
        const lines = text.split('\n');
        
        let wordId = 1;
        lines.forEach(line => {
            if (line.trim()) {
                const parts = line.split(',');
                if ((currentLevel === 'eiken3' || currentLevel === 'eikenpre1' || currentLevel === 'eiken1') && parts.length >= 3) {
                    // Eiken 3, Pre-1, and 1 format: en,jp,id
                    const [en, jp, id] = parts;
                    if (en && jp && en !== 'en' && en !== '英語') { // Skip header
                        vocabularyData[en.toLowerCase()] = {
                            japanese: jp,
                            id: parseInt(id) || wordId++
                        };
                    }
                } else if (parts.length >= 2) {
                    // Eiken 2 format: en,jp
                    const [en, jp] = parts;
                    if (en && jp && en !== 'en') { // Skip header
                        vocabularyData[en.toLowerCase()] = {
                            japanese: jp,
                            id: wordId++
                        };
                    }
                }
            }
        });
        
        // Add multi-word phrases and their inflected forms
        // These are from the CSV but need special handling for inflected forms
        if (vocabularyData["stare at"]) vocabularyData["staring at"] = vocabularyData["stare at"];
        if (vocabularyData["hear from"]) vocabularyData["heard from"] = vocabularyData["hear from"];
        if (vocabularyData["get used to"]) vocabularyData["getting used to"] = vocabularyData["get used to"];
        if (vocabularyData["come into being"]) vocabularyData["came into being"] = vocabularyData["come into being"];
        if (vocabularyData["point out"]) vocabularyData["point out"] = vocabularyData["point out"];
        if (vocabularyData["modify"]) vocabularyData["modified"] = vocabularyData["modify"];
        
        // Build word similarity map for harder quiz options
        buildWordSimilarityMap();
    } catch (error) {
        console.error('Error loading vocabulary:', error);
    }
}

// Build similarity map for harder quiz options
let wordSimilarityMap = {};
function buildWordSimilarityMap() {
    const allWords = Object.keys(vocabularyData);
    
    // Group words by common prefixes, suffixes, and patterns
    allWords.forEach(word => {
        // Store words with similar beginnings (first 3-4 letters)
        const prefix = word.substring(0, Math.min(4, word.length));
        if (!wordSimilarityMap[prefix]) wordSimilarityMap[prefix] = [];
        wordSimilarityMap[prefix].push(word);
    });
}

// Load diary content
async function loadDiary() {
    try {
        let diaryFile;
        if (currentLevel === 'eiken3') {
            diaryFile = 'kai_titan_diary_split.md';  // Use the split version
        } else if (currentLevel === 'eikenpre1') {
            diaryFile = 'ayaka_ib_diary_split.md';  // Use the split version
        } else if (currentLevel === 'eiken1') {
            diaryFile = 'reiko_anomaly_diary_split.md';  // Use the split version
        } else {
            diaryFile = 'mina_kpop_diary_split.md';  // Use the split version
        }
        console.log(`Loading diary file: ${diaryFile}`);
        // Add cache busting to ensure fresh content
        const response = await fetch(diaryFile + '?t=' + Date.now());
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        console.log(`Loaded ${text.length} characters from ${diaryFile}`);
        
        // Parse the diary entries - only English content
        // Updated pattern to handle parts (e.g., "Day 8 - Title (Part 1)")
        // Allow for optional extra newlines after header
        const dayPattern = /## Day (\d+) - ([^\n]+)\n+([^#][\s\S]*?)(?=\n---\n|\n## Day \d+|$)/g;
        let match;
        diaryData = []; // Reset as array
        
        while ((match = dayPattern.exec(text)) !== null) {
            const dayNum = parseInt(match[1]);
            const title = match[2].trim();
            const content = match[3].trim();
            
            // Check if title contains a part number
            const partMatch = title.match(/\(Part (\d+)\)$/);
            const partNum = partMatch ? parseInt(partMatch[1]) : null;
            
            // Store each part as a separate entry
            diaryData.push({
                day: dayNum,
                part: partNum,
                title: title,
                english: content
            });
        }
        
        console.log(`Loaded ${diaryData.length} diary entries`);
        // Check specifically for Day 8
        console.log('Day 8 entry:', diaryData[7] ? 'Found' : 'Missing');
        if (diaryData[7]) {
            console.log('Day 8 content preview:', diaryData[7].english.substring(0, 100) + '...');
        }
        
        // Build complete vocabulary list
        buildAllVocabularyWords();
        
        // Initialize with saved day or first day
        if (diaryData.length > 0) {
            // Clear old saved day if we're loading the split version for the first time
            const savedDay = parseInt(localStorage.getItem('currentDiaryDay_' + currentLevel)) || 1;
            
            // If saved day is greater than 30, it's from the old structure, reset to 1
            let dayToLoad = 1;
            if (savedDay <= 30 && currentLevel === 'eiken2') {
                // Old structure - try to find corresponding part in new structure
                const matchingEntry = diaryData.findIndex(entry => entry.day === savedDay && entry.part === 1);
                dayToLoad = matchingEntry >= 0 ? matchingEntry + 1 : 1;
                // Clear the old saved value
                localStorage.removeItem('currentDiaryDay_' + currentLevel);
            } else if (savedDay <= diaryData.length) {
                dayToLoad = savedDay;
            }
            
            console.log(`Initializing with entry ${dayToLoad} (saved: ${savedDay}, total entries: ${diaryData.length})`);
            // Make sure diaryData is properly formed
            for (let i = 0; i < Math.min(10, diaryData.length); i++) {
                const entry = diaryData[i];
                console.log(`Entry ${i+1}: Day ${entry?.day} ${entry?.part ? `Part ${entry.part}` : ''}`);
            }
            displayDay(dayToLoad);
        } else {
            document.getElementById('diary-entry').innerHTML = '<div class="loading">No diary entries found. Please check the file format.</div>';
        }
    } catch (error) {
        console.error('Error loading diary:', error);
        console.error('Error details:', error.message, error.stack);
        // Try fallback to original file
        console.log(`Trying fallback to original diary file for ${currentLevel}`);
        let fallbackFile;
        if (currentLevel === 'eiken3') {
            fallbackFile = 'kai_titan_diary.md';
        } else if (currentLevel === 'eikenpre1') {
            fallbackFile = 'ayaka_ib_diary.md';
        } else if (currentLevel === 'eiken1') {
            fallbackFile = 'reiko_anomaly_diary.md';
        } else {
            fallbackFile = 'mina_kpop_diary.md';
        }
        
        if (fallbackFile) {
            try {
                const response = await fetch(fallbackFile + '?t=' + Date.now());
                if (response.ok) {
                    console.log('Fallback successful, using original diary file');
                    const text = await response.text();
                    // Continue with parsing...
                    const dayPattern = /## Day (\d+) - ([^\n]+)\n+([^#][\s\S]*?)(?=\n---\n|\n## Day \d+|$)/g;
                    let match;
                    diaryData = [];
                    while ((match = dayPattern.exec(text)) !== null) {
                        const dayNum = parseInt(match[1]);
                        const title = match[2].trim();
                        const content = match[3].trim();
                        const partMatch = title.match(/\(Part (\d+)\)$/);
                        const partNum = partMatch ? parseInt(partMatch[1]) : null;
                        diaryData.push({
                            day: dayNum,
                            part: partNum,
                            title: title,
                            english: content
                        });
                    }
                    console.log(`Loaded ${diaryData.length} diary entries from fallback`);
                    buildAllVocabularyWords();
                    if (diaryData.length > 0) {
                        const savedDay = parseInt(localStorage.getItem('currentDiaryDay_' + currentLevel)) || 1;
                        const dayToLoad = savedDay <= diaryData.length ? savedDay : 1;
                        displayDay(dayToLoad);
                        return;
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }
        document.getElementById('diary-entry').innerHTML = `<div class="loading">Error loading diary content: ${error.message}<br>Please make sure all files are in the same directory.</div>`;
    }
}

// Extract vocabulary words from text
function extractVocabularyWords(text) {
    // Match bold words in markdown format
    const boldPattern = /\*\*([^*]+)\*\*/g;
    const matches = [];
    let match;
    
    while ((match = boldPattern.exec(text)) !== null) {
        matches.push(match[1]);
    }
    
    // Create word list with translations
    const words = matches.map(word => {
        let translation = findTranslation(word);
        
        return {
            english: word,
            japanese: translation || '翻訳が見つかりません'
        };
    });
    
    // Remove duplicates
    const uniqueWords = [];
    const seen = new Set();
    words.forEach(word => {
        const key = word.english.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            uniqueWords.push(word);
        }
    });
    
    return uniqueWords;
}

// Build complete vocabulary list from all diary entries
function buildAllVocabularyWords() {
    allVocabularyWords = {};
    
    diaryData.forEach((entry, index) => {
        if (entry && entry.english) {
            const words = extractVocabularyWords(entry.english);
            words.forEach(word => {
                const lowerWord = word.english.toLowerCase();
                if (!allVocabularyWords[lowerWord]) {
                    allVocabularyWords[lowerWord] = {
                        english: word.english,
                        japanese: word.japanese,
                        days: []
                    };
                }
                // Add the day number (1-indexed)
                if (!allVocabularyWords[lowerWord].days.includes(index + 1)) {
                    allVocabularyWords[lowerWord].days.push(index + 1);
                }
            });
        }
    });
    
    console.log('Built vocabulary list with', Object.keys(allVocabularyWords).length, 'unique words');
}

// Find base form of an inflected word
function findBaseForm(word) {
    const wordLower = word.toLowerCase();
    
    // Direct match
    if (vocabularyData[wordLower] && vocabularyData[wordLower].id) {
        return wordLower;
    }
    
    // Check for common inflections and find base form
    // Plural forms
    if (wordLower.endsWith('ies')) {
        const base = wordLower.slice(0, -3) + 'y';
        if (vocabularyData[base] && vocabularyData[base].id) return base;
    }
    if (wordLower.endsWith('es')) {
        const base = wordLower.slice(0, -2);
        if (vocabularyData[base] && vocabularyData[base].id) return base;
        const baseWithE = wordLower.slice(0, -1);
        if (vocabularyData[baseWithE] && vocabularyData[baseWithE].id) return baseWithE;
    }
    if (wordLower.endsWith('s') && !wordLower.endsWith('ss')) {
        const base = wordLower.slice(0, -1);
        if (vocabularyData[base] && vocabularyData[base].id) return base;
    }
    
    // Past tense forms
    if (wordLower.endsWith('ied')) {
        const base = wordLower.slice(0, -3) + 'y';
        if (vocabularyData[base] && vocabularyData[base].id) return base;
    }
    if (wordLower.endsWith('ed')) {
        let base = wordLower.slice(0, -2);
        if (vocabularyData[base] && vocabularyData[base].id) return base;
        base = wordLower.slice(0, -1);
        if (vocabularyData[base] && vocabularyData[base].id) return base;
        // Check for doubled consonant (e.g., 'stopped' -> 'stop')
        if (wordLower.length > 4 && wordLower[wordLower.length - 3] === wordLower[wordLower.length - 4]) {
            base = wordLower.slice(0, -4);
            if (vocabularyData[base] && vocabularyData[base].id) return base;
        }
    }
    
    // -ing forms
    if (wordLower.endsWith('ing')) {
        let base = wordLower.slice(0, -3);
        if (vocabularyData[base] && vocabularyData[base].id) return base;
        base = wordLower.slice(0, -3) + 'e';
        if (vocabularyData[base] && vocabularyData[base].id) return base;
        // Check for doubled consonant
        if (wordLower.length > 5 && wordLower[wordLower.length - 4] === wordLower[wordLower.length - 5]) {
            base = wordLower.slice(0, -4);
            if (vocabularyData[base] && vocabularyData[base].id) return base;
        }
    }
    
    // Adverb forms
    if (wordLower.endsWith('ly')) {
        const base = wordLower.slice(0, -2);
        if (vocabularyData[base] && vocabularyData[base].id) return base;
    }
    
    return null;
}

// Find translation with support for word variations
function findTranslation(word) {
    const wordLower = word.toLowerCase();
    
    // Try exact match first
    if (vocabularyData[wordLower]) {
        return vocabularyData[wordLower].japanese;
    }
    
    // Handle common variations
    let baseWord = wordLower;
    
    // Remove common suffixes and try to find base form
    const suffixPatterns = [
        // Plurals
        { suffix: 'ies', replacement: 'y' },      // companies -> company
        { suffix: 'ves', replacement: 'f' },      // leaves -> leaf
        { suffix: 'ves', replacement: 'fe' },     // knives -> knife
        { suffix: 'es', replacement: '' },        // produces -> produce
        { suffix: 's', replacement: '' },         // millions -> million
        
        // Past tense and past participle
        { suffix: 'ied', replacement: 'y' },      // tried -> try, studied -> study
        { suffix: 'ed', replacement: '' },        // discovered -> discover
        { suffix: 'ed', replacement: 'e' },       // reduced -> reduce
        { suffix: 'd', replacement: '' },         // told -> tell
        { suffix: 'd', replacement: 'e' },        // made -> make
        
        // Present participle/gerund
        { suffix: 'ying', replacement: 'ie' },    // dying -> die
        { suffix: 'ing', replacement: '' },       // discovering -> discover
        { suffix: 'ing', replacement: 'e' },      // reducing -> reduce, noticing -> notice
        
        // Adverbs
        { suffix: 'ly', replacement: '' },        // recently -> recent, carefully -> careful
        { suffix: 'ily', replacement: 'y' },      // happily -> happy
        { suffix: 'ically', replacement: 'ic' },  // automatically -> automatic
        { suffix: 'ally', replacement: 'al' },    // accidentally -> accidental
        
        // Other suffixes
        { suffix: 'ful', replacement: '' },       // harmful -> harm
        { suffix: 'less', replacement: '' },      // harmless -> harm
        { suffix: 'ness', replacement: '' },      // happiness -> happy
        { suffix: 'ment', replacement: '' },      // development -> develop
        { suffix: 'tion', replacement: '' },      // production -> produce
        { suffix: 'tion', replacement: 'te' },    // celebration -> celebrate
        { suffix: 'sion', replacement: '' },      // confusion -> confuse
        { suffix: 'er', replacement: '' },        // producer -> produce, stronger -> strong
        { suffix: 'est', replacement: '' },       // strongest -> strong
        { suffix: 'or', replacement: '' },        // creator -> create
        { suffix: 'ist', replacement: '' },       // scientist -> science
        { suffix: 'ize', replacement: '' },       // organize -> organ
        { suffix: 'ise', replacement: '' },       // organise -> organ
    ];
    
    // Try removing suffixes (try longer suffixes first)
    suffixPatterns.sort((a, b) => b.suffix.length - a.suffix.length);
    
    for (let pattern of suffixPatterns) {
        if (wordLower.endsWith(pattern.suffix)) {
            const base = wordLower.slice(0, -pattern.suffix.length) + pattern.replacement;
            if (vocabularyData[base]) {
                return vocabularyData[base].japanese;
            }
        }
    }
    
    // Handle consonant doubling (e.g., stopped -> stop, running -> run)
    if (wordLower.match(/([bcdfghjklmnpqrstvwxyz])\1(ed|ing)$/)) {
        const base = wordLower.replace(/([bcdfghjklmnpqrstvwxyz])\1(ed|ing)$/, '$1');
        if (vocabularyData[base]) {
            return vocabularyData[base].japanese;
        }
    }
    
    // Check for phrases (like "interested in", "proud of")
    // Try checking if this word is part of a known phrase
    const phrasesToCheck = [
        'be interested in',
        'be proud of',
        'have to',
        'need to',
        'look for',
        'take care of',
        'come down with',
        'help with',
        'all day long',
        'at first',
        'from now on',
        'right away',
        'one day',
        'every year'
    ];
    
    // For words like "interested" or "proud", check if they're part of a phrase
    if (wordLower === 'interested' && vocabularyData['be interested in']) {
        return vocabularyData['be interested in'].japanese;
    }
    if (wordLower === 'proud' && vocabularyData['be proud of']) {
        return vocabularyData['be proud of'].japanese;
    }
    
    // Handle irregular forms
    const irregularForms = {
        'began': 'begin',
        'begun': 'begin',
        'broke': 'break',
        'broken': 'break',
        'brought': 'bring',
        'built': 'build',
        'bought': 'buy',
        'caught': 'catch',
        'chose': 'choose',
        'chosen': 'choose',
        'came': 'come',
        'done': 'do',
        'drew': 'draw',
        'drawn': 'draw',
        'drank': 'drink',
        'drunk': 'drink',
        'drove': 'drive',
        'driven': 'drive',
        'ate': 'eat',
        'eaten': 'eat',
        'fell': 'fall',
        'fallen': 'fall',
        'felt': 'feel',
        'fought': 'fight',
        'found': 'find',
        'flew': 'fly',
        'flown': 'fly',
        'forgot': 'forget',
        'forgotten': 'forget',
        'froze': 'freeze',
        'frozen': 'freeze',
        'got': 'get',
        'gotten': 'get',
        'gave': 'give',
        'given': 'give',
        'went': 'go',
        'gone': 'go',
        'grew': 'grow',
        'grown': 'grow',
        'had': 'have',
        'heard': 'hear',
        'held': 'hold',
        'kept': 'keep',
        'knew': 'know',
        'known': 'know',
        'left': 'leave',
        'lost': 'lose',
        'made': 'make',
        'met': 'meet',
        'paid': 'pay',
        'put': 'put',
        'read': 'read',
        'ran': 'run',
        'said': 'say',
        'saw': 'see',
        'seen': 'see',
        'sold': 'sell',
        'sent': 'send',
        'shook': 'shake',
        'shaken': 'shake',
        'shot': 'shoot',
        'showed': 'show',
        'shown': 'show',
        'signed': 'sign',
        'decided': 'decide',
        'told': 'tell',
        'noticed': 'notice',
        'noticing': 'notice',
        'promised': 'promise',
        'practiced': 'practice',
        'practicing': 'practice',
        'stayed': 'stay',
        'finished': 'finish',
        'tried': 'try',
        'believed': 'believe',
        'believes': 'believe',
        'finds': 'find',
        'sang': 'sing',
        'sung': 'sing',
        'sat': 'sit',
        'slept': 'sleep',
        'spoke': 'speak',
        'spoken': 'speak',
        'spent': 'spend',
        'stood': 'stand',
        'stole': 'steal',
        'stolen': 'steal',
        'swam': 'swim',
        'swum': 'swim',
        'took': 'take',
        'taken': 'take',
        'taught': 'teach',
        'told': 'tell',
        'thought': 'think',
        'threw': 'throw',
        'thrown': 'throw',
        'understood': 'understand',
        'woke': 'wake',
        'woken': 'wake',
        'wore': 'wear',
        'worn': 'wear',
        'won': 'win',
        'wrote': 'write',
        'written': 'write'
    };
    
    if (irregularForms[wordLower]) {
        const baseForm = irregularForms[wordLower];
        if (vocabularyData[baseForm]) {
            return vocabularyData[baseForm].japanese;
        }
    }
    
    // If still not found, try fuzzy matching
    for (let key in vocabularyData) {
        if (vocabularyData[key] && (key.includes(wordLower) || wordLower.includes(key))) {
            return vocabularyData[key].japanese;
        }
    }
    
    return null;
}

// Display diary entry for a specific day/part
function displayDay(index) {
    console.log(`Attempting to display entry ${index}, diaryData.length = ${diaryData.length}`);
    if (!diaryData || diaryData.length === 0) {
        console.error('No diary data loaded');
        document.getElementById('diary-entry').innerHTML = '<div class="loading">No diary data available. Please refresh the page.</div>';
        return;
    }
    if (index < 1 || index > diaryData.length || isNaN(index)) {
        console.error(`Entry ${index} is out of range (1-${diaryData.length}), resetting to 1`);
        index = 1; // Reset to first entry instead of returning
    }
    
    currentDay = index;  // This now represents the entry index, not the day number
    const entry = diaryData[index - 1];
    
    // Save current entry index to localStorage (level-specific)
    localStorage.setItem('currentDiaryDay_' + currentLevel, index);
    
    if (!entry) {
        console.error(`No entry found at index ${index}`);
        document.getElementById('diary-entry').innerHTML = `<div class="loading">Error: Entry ${index} not found</div>`;
        return;
    }
    
    // Update diary content based on mode
    if (currentMode === 'quiz') {
        displayQuizMode(entry, index);
    } else if (currentMode === 'type') {
        displayTypeMode(entry, index);
    } else {
        displayReadingMode(entry, index);
    }
    
    // Update vocabulary list
    const words = extractVocabularyWords(entry.english);
    updateVocabularyPanel(words);
    
    // Update statistics
    updateVocabularyStats(words);
    
    // Update navigation
    updateDaySelector(index);
    document.getElementById('prev-btn').disabled = index === 1;
    document.getElementById('next-btn').disabled = index === diaryData.length;
    
    // Scroll diary content to top when changing days
    const diaryContent = document.getElementById('diary-entry');
    if (diaryContent) {
        diaryContent.scrollTop = 0;
        
        // Add scroll listener to hide tooltips on diary scroll
        if (!diaryContent.hasScrollListener) {
            diaryContent.addEventListener('scroll', hideTooltip);
            diaryContent.hasScrollListener = true;
        }
    }
    
    // Scroll to top (but preserve scroll position if in All Words tab)
    const panelContent = document.querySelector('.panel-content');
    
    // Only reset panel content scroll if we're on the "Today" tab
    // Keep scroll position if we're on "All Words" tab
    const activeTab = document.querySelector('.tab-btn.active');
    const isAllWordsTab = activeTab && activeTab.textContent === 'All Words';
    if (panelContent && !isAllWordsTab) {
        panelContent.scrollTop = 0;
    }
}

// Display reading mode
function displayReadingMode(entry, index) {
    const englishContent = formatDiaryText(entry.english || '');
    
    const diaryHtml = `
        <div class="content-wrapper">
            <h2 class="day-title">${entry.title ? `Day ${entry.day} - ${entry.title}` : `Day ${entry.day}`}</h2>
            <div class="diary-text">${englishContent}</div>
        </div>
    `;
    document.getElementById('diary-entry').innerHTML = diaryHtml;
}

// Display quiz mode
function displayQuizMode(entry, index) {
    const quizText = formatQuizText(entry.english);
    const diaryHtml = `
        <div class="content-wrapper">
            <h2 class="day-title">${entry.title ? `Day ${entry.day} - ${entry.title}` : `Day ${entry.day}`} [Quiz Mode]</h2>
            <div class="diary-text" id="quiz-text">${quizText}</div>
        </div>
    `;
    document.getElementById('diary-entry').innerHTML = diaryHtml;
    
    // Add click handlers to blanks
    setTimeout(() => {
        document.querySelectorAll('.blank-word').forEach(blank => {
            blank.addEventListener('click', (e) => handleBlankClick(e));
        });
    }, 100);
}

// Format text for quiz mode (replace bold words with blanks)
function formatQuizText(text) {
    return text
        .replace(/\*\*([^*]+)\*\*/g, (match, word) => {
            // Create blank spaces approximately the length of the word
            const blankLength = Math.max(word.length, 8);
            const spaces = '&nbsp;'.repeat(blankLength);
            return `<span class="blank-word" data-answer="${word}" data-answered="false">${spaces}</span>`;
        })
        .replace(/\n\n/g, '</p><p>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

// Handle blank click in quiz mode
function handleBlankClick(event) {
    const blank = event.target;
    
    // Close any existing popup first
    const existingPopup = document.getElementById('quiz-popup');
    if (existingPopup && existingPopup.classList.contains('active')) {
        closeQuizPopup();
    }
    
    // Don't show quiz if already answered
    if (blank.dataset.answered === 'true') return;
    
    const correctAnswer = blank.dataset.answer;
    currentQuizWord = { blank, correctAnswer };
    
    // Get word type (noun, verb, etc.) from vocabulary data
    const wordType = getWordType(correctAnswer);
    
    // Generate options
    const options = generateQuizOptions(correctAnswer, wordType);
    
    // Show quiz popup
    showQuizPopup(blank, options);
}

// Get word type from Japanese translation
function getWordType(word) {
    const translation = vocabularyData[word.toLowerCase()]?.japanese || '';
    
    if (translation.includes('(名詞)')) return 'noun';
    if (translation.includes('(動詞)')) return 'verb';
    if (translation.includes('(形容詞)')) return 'adjective';
    if (translation.includes('(副詞)')) return 'adverb';
    if (translation.includes('(熟語)')) return 'phrase';
    if (translation.includes('(接続詞)')) return 'conjunction';
    if (translation.includes('(前置詞)')) return 'preposition';
    
    return 'other';
}

// Generate quiz options
function generateQuizOptions(correctAnswer, wordType) {
    const correctLower = correctAnswer.toLowerCase();
    const options = new Set(); // Use Set to avoid duplicates
    const allWords = Object.keys(vocabularyData);
    
    // Add the correct answer
    options.add(correctLower);
    
    // Detect the grammatical form of the correct answer
    const grammarForm = detectGrammarForm(correctLower);
    
    // Check if the correct answer is an adverb (-ly ending)
    const isAdverb = grammarForm.isAdverb;
    
    // Find similar words for harder quiz
    const similarWords = [];
    
    if (isAdverb) {
        // For adverbs, look for other adverbs in the vocabulary
        const adverbs = allWords.filter(w => w.endsWith('ly') && w !== correctLower);
        similarWords.push(...adverbs);
        
        // If not enough adverbs, add adjectives (without -ly)
        if (similarWords.length < 3) {
            const baseWord = correctLower.replace(/ly$/, '').replace(/i$/, 'y');
            const adjectives = allWords.filter(w => 
                !w.endsWith('ly') && 
                w !== correctLower && 
                (getWordType(w) === 'adjective' || w.endsWith('ful') || w.endsWith('less') || w.endsWith('ous'))
            );
            similarWords.push(...adjectives.slice(0, 5));
        }
    } else {
        // For non-adverbs, use the original logic
        
        // 1. Words with same prefix (first 3-4 letters)
        const prefix = correctLower.substring(0, Math.min(4, correctLower.length));
        const prefixMatches = allWords.filter(w => 
            w.startsWith(prefix) && w !== correctLower
        );
        
        // 2. Words with similar length (within 2 characters)
        const lengthMatches = allWords.filter(w => 
            Math.abs(w.length - correctLower.length) <= 2 && w !== correctLower
        );
        
        // 3. Words of same type
        const typeMatches = allWords.filter(w => 
            getWordType(w) === wordType && w !== correctLower
        );
        
        // 4. Commonly confused words
        const confusableWords = getConfusableWords(correctLower);
        
        // Combine all similar words
        similarWords.push(...confusableWords);
        similarWords.push(...prefixMatches.slice(0, 5));
        similarWords.push(...typeMatches.slice(0, 10));
        similarWords.push(...lengthMatches.slice(0, 5));
    }
    
    // Try to apply the same grammatical form, but check if result exists
    const validOptions = [];
    
    for (let word of similarWords) {
        if (validOptions.length >= 10) break; // Get more candidates
        
        // Try to transform the word
        const transformedWord = applyGrammarForm(word, grammarForm);
        
        // Check if the transformed word exists in vocabulary or is the base word
        if (vocabularyData[transformedWord] || transformedWord === word) {
            validOptions.push(transformedWord);
        } else if (!grammarForm.isAdverb && !grammarForm.isPlural && !grammarForm.isPastTense) {
            // If no special form needed, just use the base word
            validOptions.push(word);
        }
    }
    
    // Remove duplicates and select 3 options
    const uniqueOptions = [...new Set(validOptions)].filter(w => w !== correctLower);
    
    // Add up to 3 wrong options
    for (let i = 0; i < Math.min(3, uniqueOptions.length); i++) {
        options.add(uniqueOptions[i]);
    }
    
    // If we still need more options, add similar words from vocabulary
    if (options.size < 4) {
        // Get words that are commonly used in the diary
        const commonWords = ['sudden', 'careful', 'certain', 'complete', 'different', 'difficult', 
                            'important', 'possible', 'terrible', 'wonderful', 'beautiful', 'powerful'];
        
        for (let word of commonWords) {
            if (options.size >= 4) break;
            
            // Apply same form if it makes sense
            let candidate = word;
            if (isAdverb && !word.endsWith('ly')) {
                // Convert to adverb form if it exists
                const adverbForm = word + 'ly';
                if (vocabularyData[adverbForm]) {
                    candidate = adverbForm;
                } else if (word === 'sudden') candidate = 'suddenly';
                else if (word === 'careful') candidate = 'carefully';
                else if (word === 'certain') candidate = 'certainly';
                else if (word === 'complete') candidate = 'completely';
                else if (word === 'different') candidate = 'differently';
                else continue; // Skip if no valid adverb form
            }
            
            if (candidate !== correctLower && !options.has(candidate)) {
                options.add(candidate);
            }
        }
    }
    
    // Convert Set to Array and shuffle
    const optionsArray = Array.from(options);
    
    // Ensure we have exactly 4 options
    while (optionsArray.length < 4) {
        // Add random vocabulary words as last resort
        const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
        if (!optionsArray.includes(randomWord)) {
            optionsArray.push(randomWord);
        }
    }
    
    // Take only 4 options and shuffle
    return optionsArray.slice(0, 4).sort(() => Math.random() - 0.5);
}

// Detect the grammatical form of a word
function detectGrammarForm(word) {
    const form = {
        isPlural: false,
        isPastTense: false,
        isPresentParticiple: false,
        isPastParticiple: false,
        isAdverb: false,
        isComparative: false,
        isSuperlative: false,
        isPossessive: false,
        isThirdPerson: false
    };
    
    // Check for plural (ends with s, es, ies)
    if (word.endsWith('ies')) {
        form.isPlural = true;
    } else if (word.endsWith('es') && !word.endsWith('ses') && !word.endsWith('xes')) {
        form.isPlural = true;
    } else if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) {
        // Check if it's third person singular verb or plural noun
        if (['does', 'goes', 'has', 'says', 'gets', 'makes', 'takes', 'comes', 'seems', 'gives'].includes(word)) {
            form.isThirdPerson = true;
        } else if (!word.endsWith('ous') && !word.endsWith('ess')) {
            form.isPlural = true;
        }
    }
    
    // Check for past tense (ends with ed, or irregular)
    if (word.endsWith('ed')) {
        form.isPastTense = true;
    } else if (['went', 'came', 'saw', 'gave', 'took', 'made', 'got', 'had', 'said', 'did', 'knew', 'thought', 'felt', 'told', 'became', 'left', 'brought', 'began', 'kept', 'held', 'wrote', 'stood', 'heard', 'let', 'meant', 'set', 'met', 'ran', 'paid', 'sat', 'spoke', 'lay', 'led', 'grew', 'lost', 'fell', 'sent', 'built', 'understood', 'drew', 'broke'].includes(word)) {
        form.isPastTense = true;
    }
    
    // Check for present participle (ends with ing)
    if (word.endsWith('ing')) {
        form.isPresentParticiple = true;
    }
    
    // Check for adverb (ends with ly)
    if (word.endsWith('ly')) {
        form.isAdverb = true;
    }
    
    // Check for comparative (ends with er)
    if (word.endsWith('er') && !word.endsWith('eer') && !word.endsWith('ier')) {
        form.isComparative = true;
    }
    
    // Check for superlative (ends with est)
    if (word.endsWith('est')) {
        form.isSuperlative = true;
    }
    
    // Check for possessive (ends with 's)
    if (word.endsWith("'s")) {
        form.isPossessive = true;
    }
    
    return form;
}

// Apply grammatical form to a word
function applyGrammarForm(baseWord, form) {
    let result = baseWord;
    
    // Apply plural
    if (form.isPlural) {
        if (baseWord.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].includes(baseWord.slice(-2))) {
            result = baseWord.slice(0, -1) + 'ies';
        } else if (baseWord.endsWith('s') || baseWord.endsWith('x') || baseWord.endsWith('z') || baseWord.endsWith('ch') || baseWord.endsWith('sh')) {
            result = baseWord + 'es';
        } else if (baseWord.endsWith('f')) {
            result = baseWord.slice(0, -1) + 'ves';
        } else if (baseWord.endsWith('fe')) {
            result = baseWord.slice(0, -2) + 'ves';
        } else {
            result = baseWord + 's';
        }
    }
    
    // Apply past tense
    if (form.isPastTense) {
        if (baseWord.endsWith('e')) {
            result = baseWord + 'd';
        } else if (baseWord.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].includes(baseWord.slice(-2))) {
            result = baseWord.slice(0, -1) + 'ied';
        } else if (baseWord.length > 2 && !baseWord.endsWith('w') && !baseWord.endsWith('x') && !baseWord.endsWith('y')) {
            // Check for consonant-vowel-consonant pattern for doubling
            const lastThree = baseWord.slice(-3);
            if (lastThree.length === 3 && !'aeiou'.includes(lastThree[0]) && 'aeiou'.includes(lastThree[1]) && !'aeiou'.includes(lastThree[2])) {
                result = baseWord + baseWord.slice(-1) + 'ed';
            } else {
                result = baseWord + 'ed';
            }
        } else {
            result = baseWord + 'ed';
        }
    }
    
    // Apply present participle
    if (form.isPresentParticiple) {
        if (baseWord.endsWith('e') && !baseWord.endsWith('ee') && !baseWord.endsWith('oe') && !baseWord.endsWith('ye')) {
            result = baseWord.slice(0, -1) + 'ing';
        } else if (baseWord.endsWith('ie')) {
            result = baseWord.slice(0, -2) + 'ying';
        } else if (baseWord.length > 2) {
            // Check for consonant-vowel-consonant pattern for doubling
            const lastThree = baseWord.slice(-3);
            if (lastThree.length === 3 && !'aeiou'.includes(lastThree[0]) && 'aeiou'.includes(lastThree[1]) && !'aeiou'.includes(lastThree[2])) {
                result = baseWord + baseWord.slice(-1) + 'ing';
            } else {
                result = baseWord + 'ing';
            }
        } else {
            result = baseWord + 'ing';
        }
    }
    
    // Apply adverb
    if (form.isAdverb) {
        if (baseWord.endsWith('y')) {
            result = baseWord.slice(0, -1) + 'ily';
        } else if (baseWord.endsWith('le')) {
            result = baseWord.slice(0, -1) + 'y';
        } else if (baseWord.endsWith('ic')) {
            result = baseWord + 'ally';
        } else {
            result = baseWord + 'ly';
        }
    }
    
    // Apply comparative
    if (form.isComparative) {
        if (baseWord.endsWith('y')) {
            result = baseWord.slice(0, -1) + 'ier';
        } else if (baseWord.endsWith('e')) {
            result = baseWord + 'r';
        } else {
            result = baseWord + 'er';
        }
    }
    
    // Apply superlative
    if (form.isSuperlative) {
        if (baseWord.endsWith('y')) {
            result = baseWord.slice(0, -1) + 'iest';
        } else if (baseWord.endsWith('e')) {
            result = baseWord + 'st';
        } else {
            result = baseWord + 'est';
        }
    }
    
    // Apply third person
    if (form.isThirdPerson) {
        if (baseWord.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].includes(baseWord.slice(-2))) {
            result = baseWord.slice(0, -1) + 'ies';
        } else if (baseWord.endsWith('s') || baseWord.endsWith('x') || baseWord.endsWith('z') || baseWord.endsWith('ch') || baseWord.endsWith('sh') || baseWord.endsWith('o')) {
            result = baseWord + 'es';
        } else {
            result = baseWord + 's';
        }
    }
    
    return result;
}

// Get commonly confused words
function getConfusableWords(word) {
    const confusables = {
        'accept': ['except', 'expect', 'aspect'],
        'affect': ['effect', 'effort', 'infect'],
        'effect': ['affect', 'effort', 'defect'],
        'advice': ['advise', 'device', 'service'],
        'advise': ['advice', 'devise', 'revise'],
        'already': ['ready', 'really', 'barely'],
        'altogether': ['together', 'although', 'another'],
        'beside': ['besides', 'inside', 'outside'],
        'besides': ['beside', 'decides', 'resides'],
        'breath': ['breathe', 'bread', 'break'],
        'breathe': ['breath', 'breeze', 'beneath'],
        'choose': ['chose', 'choice', 'chase'],
        'chose': ['choose', 'choice', 'close'],
        'complement': ['compliment', 'complete', 'implement'],
        'compliment': ['complement', 'compliant', 'complaint'],
        'conscience': ['conscious', 'consensus', 'consequence'],
        'conscious': ['conscience', 'cautious', 'anxious'],
        'council': ['counsel', 'consul', 'cancel'],
        'counsel': ['council', 'consul', 'consult'],
        'desert': ['dessert', 'deserted', 'assert'],
        'dessert': ['desert', 'assert', 'insert'],
        'device': ['devise', 'advice', 'divide'],
        'devise': ['device', 'advise', 'revise'],
        'ensure': ['insure', 'assure', 'endure'],
        'insure': ['ensure', 'assure', 'secure'],
        'assure': ['ensure', 'insure', 'assume'],
        'immigrate': ['emigrate', 'migrate', 'integrate'],
        'emigrate': ['immigrate', 'migrate', 'imitate'],
        'its': ['it\'s', 'this', 'sits'],
        'it\'s': ['its', 'it', 'is'],
        'later': ['latter', 'later', 'laser'],
        'latter': ['later', 'letter', 'ladder'],
        'lead': ['led', 'leaf', 'lean'],
        'led': ['lead', 'let', 'leg'],
        'lose': ['loose', 'loss', 'lost'],
        'loose': ['lose', 'loops', 'goose'],
        'passed': ['past', 'paste', 'paced'],
        'past': ['passed', 'paste', 'post'],
        'peace': ['piece', 'place', 'pace'],
        'piece': ['peace', 'pierce', 'please'],
        'personal': ['personnel', 'person', 'personality'],
        'personnel': ['personal', 'person', 'panel'],
        'principal': ['principle', 'primarily', 'princes'],
        'principle': ['principal', 'principled', 'particle'],
        'quiet': ['quite', 'quit', 'quick'],
        'quite': ['quiet', 'quit', 'quote'],
        'raise': ['rise', 'race', 'rage'],
        'rise': ['raise', 'rice', 'wise'],
        'than': ['then', 'that', 'them'],
        'then': ['than', 'them', 'when'],
        'their': ['there', 'they\'re', 'them'],
        'there': ['their', 'they\'re', 'where'],
        'they\'re': ['their', 'there', 'they'],
        'through': ['threw', 'though', 'thorough'],
        'threw': ['through', 'throw', 'three'],
        'to': ['too', 'two', 'do'],
        'too': ['to', 'two', 'took'],
        'two': ['to', 'too', 'who'],
        'weather': ['whether', 'where', 'water'],
        'whether': ['weather', 'where', 'wherever'],
        'who\'s': ['whose', 'who', 'whom'],
        'whose': ['who\'s', 'who', 'where'],
        'your': ['you\'re', 'yours', 'year'],
        'you\'re': ['your', 'you', 'yours']
    };
    
    return confusables[word] || [];
}

// Show quiz popup
function showQuizPopup(blank, options) {
    const popup = document.getElementById('quiz-popup');
    const optionsContainer = document.getElementById('quiz-options');
    
    // Clear previous options
    optionsContainer.innerHTML = '';
    
    // Add options
    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'quiz-option';
        optionDiv.textContent = option;
        optionDiv.onclick = () => handleQuizAnswer(option);
        optionsContainer.appendChild(optionDiv);
    });
    
    // Position popup near the blank
    const rect = blank.getBoundingClientRect();
    const scrollTop = document.querySelector('.diary-content').scrollTop;
    
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 5}px`;
    popup.classList.add('active');
    
    // Close popup when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeQuizPopup);
    }, 100);
}

// Handle quiz answer
function handleQuizAnswer(answer) {
    if (!currentQuizWord) return;
    
    const { blank, correctAnswer } = currentQuizWord;
    const isCorrect = answer.toLowerCase() === correctAnswer.toLowerCase();
    
    // Update stats
    quizStats.total++;
    if (isCorrect) {
        quizStats.correct++;
        quizStats.currentStreak++;
        if (quizStats.currentStreak > quizStats.bestStreak) {
            quizStats.bestStreak = quizStats.currentStreak;
        }
        blank.classList.add('correct');
        blank.textContent = correctAnswer;
        
        // Play audio for correct answer
        const translation = findTranslation(correctAnswer.toLowerCase());
        if (translation) {
            speakWordWithTranslation(correctAnswer, translation, blank);
        }
    } else {
        quizStats.incorrect++;
        quizStats.currentStreak = 0;
        blank.classList.add('incorrect');
        blank.textContent = answer;
        
        // Track missed word
        const key = correctAnswer.toLowerCase();
        quizStats.missedWords[key] = (quizStats.missedWords[key] || 0) + 1;
        
        // Show correct answer after delay and play audio
        setTimeout(() => {
            blank.textContent = correctAnswer;
            blank.classList.add('revealed');
            
            // Play audio for correct answer
            const translation = findTranslation(correctAnswer.toLowerCase());
            if (translation) {
                speakWordWithTranslation(correctAnswer, translation, blank);
            }
        }, 1500);
    }
    
    blank.dataset.answered = 'true';
    
    // Update displays
    updateStatsDisplay();
    updateMissedWordsDisplay();
    saveStats();
    
    // Close popup
    closeQuizPopup();
    
    // Check if all blanks are answered
    checkQuizCompletion();
}

// Close quiz popup
function closeQuizPopup(event) {
    if (event && event.target.classList.contains('quiz-option')) return;
    if (event && event.target.classList.contains('blank-word')) return;
    
    const popup = document.getElementById('quiz-popup');
    popup.classList.remove('active');
    document.removeEventListener('click', closeQuizPopup);
    currentQuizWord = null;
}

// Check if quiz is completed
function checkQuizCompletion() {
    const blanks = document.querySelectorAll('.blank-word');
    const answered = document.querySelectorAll('.blank-word[data-answered="true"]');
    
    if (blanks.length === answered.length && blanks.length > 0) {
        // All blanks answered - reveal Japanese translation
        const japaneseDiv = document.getElementById('japanese-translation');
        if (japaneseDiv) {
            japaneseDiv.style.filter = 'none';
            japaneseDiv.parentElement.style.opacity = '1';
        }
        
        // Save last tested day for this level
        localStorage.setItem(`lastTestedDay_${currentLevel}`, currentDay.toString());
        localStorage.setItem(`lastTestedDate_${currentLevel}`, new Date().toISOString());
    }
}

// Update vocabulary statistics
function updateVocabularyStats(todayWords) {
    // Total vocabulary count
    const totalVocab = Object.keys(vocabularyData).length;
    document.getElementById('all-words-count').textContent = `All: ${totalVocab}`;
    
    // Missed words count
    const missedCount = Object.keys(quizStats.missedWords).filter(word => 
        quizStats.missedWords[word] > 0
    ).length;
    document.getElementById('missed-words-count').textContent = `Missed: ${missedCount}`;
    
    // Today's words count
    document.getElementById('today-words-count').textContent = `Today: ${todayWords.length}`;
}

// Update vocabulary panel
function updateVocabularyPanel(words) {
    const vocabHtml = words.map(word => {
        const missCount = quizStats.missedWords[word.english.toLowerCase()] || 0;
        // Try to get word data directly first, then try to find base form
        let wordData = vocabularyData[word.english.toLowerCase()];
        let wordId = wordData?.id || '';
        
        // If no ID found, try to find the base form
        if (!wordId) {
            const baseForm = findBaseForm(word.english);
            if (baseForm && vocabularyData[baseForm]) {
                wordId = vocabularyData[baseForm].id;
            }
        }
        return `
            <div class="word-item ${missCount > 0 ? 'missed-word-item' : ''}" 
                 style="position: relative; cursor: pointer;" 
                 data-english="${word.english.replace(/"/g, '&quot;')}"
                 data-japanese="${word.japanese.replace(/"/g, '&quot;')}"
                 title="Click to hear pronunciation and highlight in text">
                <span class="word-id">#${wordId}</span>
                <div class="word-en">${word.english}</div>
                <div class="word-jp">${word.japanese}</div>
                ${missCount > 0 ? `<span class="miss-count">${missCount}</span>` : ''}
            </div>
        `;
    }).join('');
    
    document.getElementById('vocabulary-list').innerHTML = vocabHtml || '<div class="loading">No vocabulary words found</div>';
    
    // Add click event listeners to vocabulary items
    setTimeout(() => {
        document.querySelectorAll('#vocabulary-list .word-item').forEach(item => {
            item.addEventListener('click', function() {
                const english = this.dataset.english;
                const japanese = this.dataset.japanese;
                handleVocabClick(english, japanese);
            });
        });
    }, 0);
}

// Handle vocabulary item click
function handleVocabClick(english, japanese, speakSentence = true) {
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Get the clicked element (if event exists)
    const element = event ? (event.currentTarget || event.target) : null;
    
    // Speak the word first
    speakWordWithTranslation(english, japanese, element);
    
    // Highlight the word in the passage and optionally speak the sentence
    highlightWordInPassage(english, speakSentence);
}

// Update stats display
function updateStatsDisplay() {
    document.getElementById('total-questions').textContent = quizStats.total;
    document.getElementById('correct-answers').textContent = quizStats.correct;
    document.getElementById('incorrect-answers').textContent = quizStats.incorrect;
    
    const accuracy = quizStats.total > 0 ? 
        Math.round((quizStats.correct / quizStats.total) * 100) : 0;
    document.getElementById('accuracy').textContent = `${accuracy}%`;
    
    document.getElementById('current-streak').textContent = quizStats.currentStreak;
    document.getElementById('best-streak').textContent = quizStats.bestStreak;
}

// Update missed words display
function updateMissedWordsDisplay() {
    const missedWords = Object.entries(quizStats.missedWords)
        .filter(([word, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]); // Sort by miss count
    
    if (missedWords.length === 0) {
        document.getElementById('missed-words-list').innerHTML = 
            '<div class="loading">No missed words yet!</div>';
        return;
    }
    
    // Add summary at the top
    const totalMissed = missedWords.length;
    const totalMisses = missedWords.reduce((sum, [_, count]) => sum + count, 0);
    const avgMissesPerWord = (totalMisses / totalMissed).toFixed(1);
    
    const summary = `
        <div style="padding: 10px; background: rgba(255, 193, 7, 0.1); border-radius: 5px; margin-bottom: 10px;">
            <div style="font-weight: bold; color: var(--warning);">📊 Struggled Words Ranking</div>
            <div style="font-size: 0.9em; color: var(--text-secondary); margin-top: 5px;">
                Words: ${totalMissed} | Total struggles: ${totalMisses} | Avg: ${avgMissesPerWord}x
            </div>
            <div style="font-size: 0.8em; color: var(--text-secondary); margin-top: 5px;">
                🔴 Very Hard (5+) | 🟠 Hard (3-4) | 🟡 Medium (2) | 🟢 Learning (1)
            </div>
        </div>
    `;
    
    const missedHtml = missedWords.map(([word, count], index) => {
        const wordData = vocabularyData[word.toLowerCase()];
        const translation = findTranslation(word) || wordData?.japanese || '翻訳が見つかりません';
        const wordId = wordData?.id || '';
        
        // Determine difficulty level
        let difficultyIcon = '';
        let bgColor = '';
        if (count >= 5) {
            difficultyIcon = '🔴';
            bgColor = 'rgba(220, 53, 69, 0.15)';
        } else if (count >= 3) {
            difficultyIcon = '🟠';
            bgColor = 'rgba(255, 193, 7, 0.1)';
        } else if (count >= 2) {
            difficultyIcon = '🟡';
            bgColor = 'rgba(255, 235, 59, 0.08)';
        } else {
            difficultyIcon = '🟢';
            bgColor = 'transparent';
        }
        
        return `
            <div class="word-item missed-word-item" 
                 style="position: relative; cursor: pointer; background: ${bgColor}; padding: 8px; border-radius: 5px; margin: 4px 0;"
                 data-english="${word.replace(/"/g, '&quot;')}"
                 data-japanese="${translation.replace(/"/g, '&quot;')}"
                 title="Click to hear and highlight">
                <span style="color: #666; font-weight: bold; margin-right: 8px; display: inline-block; min-width: 25px;">#${index + 1}</span>
                ${difficultyIcon}
                <span class="word-id" style="margin-left: 8px;">#${wordId}</span>
                <div class="word-en">${word}</div>
                <div class="word-jp">${translation}</div>
                <span class="miss-count" style="font-weight: bold; color: ${count >= 3 ? '#dc3545' : 'var(--warning)'};">${count}</span>
            </div>
        `;
    }).join('');
    
    document.getElementById('missed-words-list').innerHTML = summary + missedHtml;
    
    // Add click event listeners to missed word items
    setTimeout(() => {
        document.querySelectorAll('#missed-words-list .word-item').forEach(item => {
            item.addEventListener('click', function() {
                const english = this.dataset.english;
                const japanese = this.dataset.japanese;
                handleVocabClick(english, japanese);
            });
        });
    }, 0);
}

// Get title from diary entry
function getTitle(dayNum) {
    // Get the title from the parsed diary data
    const entry = diaryData[dayNum - 1];
    if (entry && entry.title) {
        return entry.title;
    }
    return `Day ${dayNum}`;
}

// Get Japanese title

// Format diary text with proper HTML
function formatDiaryText(text, addClickHandlers = true) {
    if (!text) return '';
    
    // Convert markdown bold to HTML strong tags
    let formatted = text;
    
    if (addClickHandlers) {
        // Add click handlers and tooltips for English text
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, (match, word) => {
            const translation = findTranslation(word) || '';
            return `<strong 
                onclick="speakWord('${word.replace(/'/g, "\\'")}')" 
                onmouseover="showTooltip(event, '${word.replace(/'/g, "\\'")}')"
                onmouseout="hideTooltip()"
                style="cursor: pointer; position: relative;"
                data-translation="${translation.replace(/"/g, '&quot;')}"
            >${word}</strong>`;
        });
    } else {
        // Just bold for Japanese text
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
    
    return formatted
        .replace(/\n\n/g, '</p><p>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

// Show tooltip with Japanese translation
function showTooltip(event, word) {
    const element = event.target;
    const translation = element.dataset.translation || findTranslation(word);
    
    if (!translation) return;
    
    // Remove any existing tooltip
    hideTooltip();
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'word-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: #333;
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 10000;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        font-weight: normal;
    `;
    tooltip.textContent = translation;
    
    // Add arrow pointing up to the word
    const arrow = document.createElement('div');
    arrow.style.cssText = `
        position: absolute;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid #333;
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
    `;
    tooltip.appendChild(arrow);
    
    // Position tooltip below the word
    document.body.appendChild(tooltip);
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Calculate position accounting for page scroll
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    
    let left = rect.left + scrollX + (rect.width - tooltipRect.width) / 2;
    let top = rect.bottom + scrollY + 5;
    
    // Adjust if tooltip goes off screen horizontally
    if (left < 5) left = 5;
    if (left + tooltipRect.width > window.innerWidth + scrollX - 5) {
        left = window.innerWidth + scrollX - tooltipRect.width - 5;
    }
    
    // If tooltip would go below viewport, show above instead
    if (rect.bottom + tooltipRect.height + 5 > window.innerHeight) {
        top = rect.top + scrollY - tooltipRect.height - 5;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

// Hide tooltip
function hideTooltip() {
    const existingTooltip = document.getElementById('word-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
}

// Speak word in English followed by Japanese translation
function speakWord(word) {
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Get the Japanese translation
    const translation = findTranslation(word.toLowerCase());
    
    if (!translation) {
        console.log('No translation found for:', word);
        return;
    }
    
    speakWordWithTranslation(word, translation, event.target);
}

// Speak word from vocabulary panel
function speakWordFromPanel(english, japanese) {
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Get the clicked element
    const element = event ? event.currentTarget : null;
    speakWordWithTranslation(english, japanese, element);
    
    // Scroll to and highlight the word in the main passage
    highlightWordInPassage(english);
}

// Highlight word in the main passage
function highlightWordInPassage(word, speakSentence = false) {
    // Find all strong elements in the diary content
    const strongElements = document.querySelectorAll('.diary-text strong');
    
    let targetElement = null;
    
    // Find the matching word (case-insensitive)
    for (let elem of strongElements) {
        if (elem.textContent.toLowerCase() === word.toLowerCase()) {
            targetElement = elem;
            break;
        }
    }
    
    if (targetElement) {
        // Scroll the element into view
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // Add highlight effect
        const originalBg = targetElement.style.backgroundColor;
        const originalTransition = targetElement.style.transition;
        
        targetElement.style.transition = 'all 0.3s ease';
        targetElement.style.backgroundColor = '#ffeb3b';
        targetElement.style.padding = '2px 4px';
        targetElement.style.borderRadius = '3px';
        targetElement.style.boxShadow = '0 0 10px rgba(255, 235, 59, 0.8)';
        
        // Pulse effect
        targetElement.style.animation = 'highlightPulse 1s ease-in-out 2';
        
        // If speakSentence is true, read the entire sentence containing the word
        if (speakSentence) {
            // Get the sentence containing the word
            const sentence = getSentenceContainingWord(targetElement);
            if (sentence) {
                // Wait for the word to finish speaking, then speak the sentence
                setTimeout(() => {
                    speakSentence(sentence);
                }, 1500); // Wait 1.5 seconds for word to finish
            }
        }
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            targetElement.style.backgroundColor = originalBg;
            targetElement.style.padding = '';
            targetElement.style.borderRadius = '';
            targetElement.style.boxShadow = '';
            targetElement.style.animation = '';
            setTimeout(() => {
                targetElement.style.transition = originalTransition;
            }, 300);
        }, 3000);
    }
}

// Get the sentence containing a word element
function getSentenceContainingWord(element) {
    // Get the parent paragraph
    let parent = element.parentElement;
    while (parent && parent.tagName !== 'P') {
        parent = parent.parentElement;
    }
    
    if (!parent) return null;
    
    // Get the text content of the paragraph
    let text = parent.textContent;
    
    // Find sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    // Find which sentence contains our word
    const wordText = element.textContent;
    for (let sentence of sentences) {
        if (sentence.includes(wordText)) {
            return sentence.trim();
        }
    }
    
    // If no sentence found, return the whole paragraph
    return text;
}

// Speak a sentence
function speakSentence(text) {
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create utterance for the sentence
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language and voice preferences for American English
    utterance.lang = 'en-US';
    utterance.rate = 0.85; // Slightly slower for sentences
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Get available voices after they load
    const setVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        
        // Priority order for American English female voices
        const americanFemaleVoice = 
            voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('female')) ||
            voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('samantha')) ||
            voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('victoria')) ||
            voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('alex')) ||
            voices.find(voice => voice.lang === 'en-US' && !voice.name.toLowerCase().includes('male')) ||
            voices.find(voice => voice.lang === 'en-US');
        
        if (americanFemaleVoice) {
            utterance.voice = americanFemaleVoice;
        }
    };
    
    // Load voices if available
    if (window.speechSynthesis.getVoices().length > 0) {
        setVoices();
    } else {
        window.speechSynthesis.addEventListener('voiceschanged', setVoices, { once: true });
    }
    
    // Speak the sentence
    window.speechSynthesis.speak(utterance);
}

// Common function to speak word with translation
function speakWordWithTranslation(english, japanese, element) {
    // Create utterance for English only
    const englishUtterance = new SpeechSynthesisUtterance(english);
    
    // Set language and voice preferences for American English
    englishUtterance.lang = 'en-US';
    englishUtterance.rate = 0.9;
    englishUtterance.pitch = 1.0;
    englishUtterance.volume = 1.0;
    
    // Get available voices after they load
    const setVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        
        // Priority order for American English female voices
        const americanFemaleVoice = 
            voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('female')) ||
            voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('samantha')) ||
            voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('victoria')) ||
            voices.find(voice => voice.lang === 'en-US' && voice.name.toLowerCase().includes('alex')) ||
            voices.find(voice => voice.lang === 'en-US' && !voice.name.toLowerCase().includes('male')) ||
            voices.find(voice => voice.lang === 'en-US');
        
        if (americanFemaleVoice) {
            englishUtterance.voice = americanFemaleVoice;
            console.log('Using voice:', americanFemaleVoice.name);
        }
    };
    
    // Load voices if available
    if (window.speechSynthesis.getVoices().length > 0) {
        setVoices();
    } else {
        window.speechSynthesis.addEventListener('voiceschanged', setVoices, { once: true });
    }
    
    // Speak English only
    window.speechSynthesis.speak(englishUtterance);
    
    // Visual feedback if element exists
    if (element) {
        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = '#ffd6e8';
        
        // Add speaker emoji temporarily
        const originalContent = element.innerHTML;
        if (!element.innerHTML.includes('🔊')) {
            element.innerHTML = '🔊 ' + originalContent;
        }
        
        englishUtterance.onend = () => {
            element.style.backgroundColor = originalBg;
            element.innerHTML = originalContent;
        };
    }
}

// Display Type Game
function displayTypeMode(entry, index) {
    const words = extractVocabularyWords(entry.english);
    typeMode.currentEntry = entry.english; // Store the full text
    
    // Convert to base forms and remove duplicates
    const baseFormWords = [];
    const seenWords = new Set();
    
    words.forEach(word => {
        const wordLower = word.english.toLowerCase();
        let baseForm = findBaseForm(wordLower) || wordLower;
        
        // Only add if it's actually in our vocabulary and not already added
        if (vocabularyData[baseForm] && !seenWords.has(baseForm)) {
            seenWords.add(baseForm);
            baseFormWords.push(baseForm);
        }
    });
    
    // Randomize the order of words
    const shuffled = [...baseFormWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    typeMode.currentWords = shuffled;
    typeMode.currentIndex = 0;
    typeMode.correctCount = 0;
    typeMode.skippedCount = 0;
    
    // Ensure day number is valid
    const dayNum = entry.day || index;
    const title = entry.title || `Entry ${index}`;
    
    const html = `
        <div class="content-wrapper">
            <h2 class="day-title">${title.includes('Day') ? title : `Day ${dayNum} - ${title}`} - Type Game</h2>
            <div class="type-mode-container">
                <div id="type-status" class="type-status">
                    <div class="type-stats">
                        <span>Progress: <strong id="type-progress">0 / ${baseFormWords.length}</strong></span>
                        <span>Time: <strong id="type-timer">00:00</strong></span>
                    </div>
                    <div class="type-controls">
                        <select id="game-mode-selector" class="mode-btn" style="padding: 10px; margin-right: 10px; background: white; color: #667eea; border: 2px solid #667eea;">
                            <option value="typing">⌨️ Typing Mode</option>
                            <option value="multiple-choice">🔤 Multiple Choice</option>
                        </select>
                        <button id="type-start-btn" class="mode-btn" onclick="startTypeMode()">Start Game!</button>
                        <button id="type-reset-btn" class="mode-btn" onclick="resetTypeMode()" style="display:none;">🔄 Reset</button>
                    </div>
                </div>
                
                <div id="type-game" class="type-game" style="display:none;">
                    <div id="type-countdown" class="type-countdown" style="display:none;"></div>
                    <div class="type-word-display">
                        <div id="type-japanese" class="type-japanese"></div>
                        <div id="type-sentence" class="type-sentence"></div>
                        <div id="type-hint" class="type-hint"></div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 15px;">
                            <input type="text" id="type-input" class="type-input" placeholder="Type the word..." disabled style="margin: 0; flex: 1; max-width: 400px;">
                            <button id="type-giveup-btn" class="give-up-btn" onclick="giveUpWord()">Give Up!</button>
                        </div>
                        <div id="type-feedback" class="type-feedback"></div>
                    </div>
                </div>
                
                <div id="type-complete" class="type-complete" style="display:none;">
                    <h3>🎉 Completed!</h3>
                    <p>Time: <strong id="final-time"></strong></p>
                    <p>Correct: <strong id="final-correct"></strong></p>
                    <p>Skipped: <strong id="final-skipped"></strong></p>
                    <div id="skipped-words-list" style="margin: 15px 0;"></div>
                    <div id="nickname-input-container" style="margin: 20px 0;">
                        <p style="color: #ffd700; font-weight: bold; margin-bottom: 10px;">Enter your name for the ranking:</p>
                        <input type="text" id="nickname-input" placeholder="Enter your nickname" style="padding: 10px; font-size: 1.1em; border-radius: 5px; border: none; margin-right: 10px;">
                        <button class="mode-btn" onclick="saveRankingWithNickname()">Save to Rankings</button>
                    </div>
                </div>
                
                <div class="type-rankings">
                    <h3>🏆 Best Times - Day ${dayNum}</h3>
                    <div id="rankings-list"></div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('diary-entry').innerHTML = html;
    loadTypeRankings();
}

// Start Type Game
function startTypeMode() {
    // Get selected game mode
    const modeSelector = document.getElementById('game-mode-selector');
    typeMode.gameMode = modeSelector ? modeSelector.value : 'typing';
    
    // Start the appropriate mode
    if (typeMode.gameMode === 'multiple-choice') {
        startMultipleChoiceMode();
    } else {
        startTypingMode();
    }
}

// Start typing mode for all levels
function startTypingMode() {
    document.getElementById('type-start-btn').style.display = 'none';
    document.getElementById('type-reset-btn').style.display = 'inline-block';
    document.getElementById('type-game').style.display = 'block';
    document.getElementById('type-complete').style.display = 'none';
    
    // Show countdown
    const countdownDiv = document.getElementById('type-countdown');
    const wordDisplay = document.querySelector('.type-word-display');
    countdownDiv.style.display = 'flex';
    wordDisplay.style.display = 'none';
    
    // Countdown sequence
    const countdownSteps = ['3', '2', '1', 'GO!'];
    let step = 0;
    
    function showCountdown() {
        if (step < countdownSteps.length) {
            countdownDiv.innerHTML = `<span class="countdown-number">${countdownSteps[step]}</span>`;
            step++;
            setTimeout(showCountdown, 800);
        } else {
            // Start the actual game
            countdownDiv.style.display = 'none';
            wordDisplay.style.display = 'block';
            actuallyStartGame();
        }
    }
    
    showCountdown();
}

// Actually start the game after countdown
function actuallyStartGame() {
    typeMode.isActive = true;
    typeMode.startTime = Date.now();
    typeMode.currentIndex = 0;
    typeMode.correctCount = 0;
    typeMode.skippedCount = 0;
    typeMode.skippedWords = [];
    typeMode.gameMode = 'typing'; // Store the mode being played
    
    const input = document.getElementById('type-input');
    input.disabled = false;
    input.value = '';
    input.focus();
    
    // Start timer
    updateTypeTimer();
    
    // Show first word
    showNextTypeWord();
    
    // Add input event listener
    input.addEventListener('input', handleTypeInput);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkTypeAnswer();
        }
    });
}

// Find sentence containing the target word
function findSentenceWithWord(text, targetWord) {
    // Split text into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    // Find a sentence containing the word (check various forms)
    for (let sentence of sentences) {
        const sentenceLower = sentence.toLowerCase();
        
        // Check if the base form or any inflected form appears
        if (sentenceLower.includes(targetWord.toLowerCase())) {
            return sentence.trim();
        }
        
        // Check for inflected forms
        const possibleForms = [
            targetWord + 's',
            targetWord + 'es',
            targetWord + 'ed',
            targetWord + 'ing',
            targetWord + 'ly',
            targetWord.replace(/y$/, 'ies'),
            targetWord.replace(/y$/, 'ied'),
            targetWord.replace(/e$/, 'ing'),
            targetWord.replace(/e$/, 'ed')
        ];
        
        for (let form of possibleForms) {
            if (sentenceLower.includes(form.toLowerCase())) {
                return sentence.trim();
            }
        }
    }
    
    return null;
}

// Show next word in type game
function showNextTypeWord() {
    if (typeMode.currentIndex >= typeMode.currentWords.length) {
        completeTypeMode();
        return;
    }
    
    // Reset attempt flag and wrong attempts counter for new word
    typeMode.currentWordAttempted = false;
    typeMode.wrongAttempts = 0;
    typeMode.lastWrongIndex = -1;
    
    const word = typeMode.currentWords[typeMode.currentIndex];
    const translation = findTranslation(word) || vocabularyData[word]?.japanese || '';
    
    // Find and display sentence context
    const sentence = findSentenceWithWord(typeMode.currentEntry, word);
    if (sentence) {
        // Replace the target word and its inflected forms with blanks but keep the inflection
        let displaySentence = sentence;
        
        // Function to create blank with inflection preserved
        const createBlankWithInflection = (match) => {
            const matchLower = match.toLowerCase();
            const wordLower = word.toLowerCase();
            
            // Simply extract whatever comes after the base word
            let suffix = '';
            
            // Direct match with suffix
            if (matchLower.startsWith(wordLower)) {
                suffix = matchLower.slice(wordLower.length);
            } 
            // Handle cases where base word ends with 'y' and becomes 'i'
            else if (wordLower.endsWith('y') && matchLower.startsWith(wordLower.slice(0, -1) + 'i')) {
                suffix = matchLower.slice(wordLower.length - 1);
            }
            // Handle cases where base word ends with 'e' and is dropped
            else if (wordLower.endsWith('e') && matchLower.startsWith(wordLower.slice(0, -1))) {
                suffix = matchLower.slice(wordLower.length - 1);
            }
            
            // Create blank with suffix
            if (suffix) {
                return `<span class="type-blank">_____${suffix}</span>`;
            } else {
                return '<span class="type-blank">_____</span>';
            }
        };
        
        // Create a more comprehensive pattern to match all forms of the word
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Build pattern for different word forms
        let patternString = `\\b(`;
        patternString += `${escapedWord}(?:s|es|ed|d|ing|ly)?`;  // Base word with common suffixes
        
        // Handle y->ies/ied transformations
        if (word.endsWith('y')) {
            const stem = word.slice(0, -1);
            patternString += `|${stem}(?:ies|ied)`;
        }
        
        // Handle e-dropping (e.g., "improve" -> "improving")
        if (word.endsWith('e')) {
            const stem = word.slice(0, -1);
            patternString += `|${stem}(?:ing|ed)`;
        }
        
        patternString += `)\\b`;
        
        const pattern = new RegExp(patternString, 'gi');
        
        // Replace with blanks preserving inflections
        displaySentence = displaySentence.replace(pattern, createBlankWithInflection);
        
        // Bold other vocabulary words
        displaySentence = displaySentence.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        document.getElementById('type-sentence').innerHTML = `<div class="sentence-context">${displaySentence}</div>`;
    } else {
        document.getElementById('type-sentence').innerHTML = '';
    }
    
    // Create hint with spaces preserved - with first letters in blue
    let hintHtml = '';
    let isFirstChar = true;
    for (let i = 0; i < word.length; i++) {
        if (word[i] === ' ') {
            hintHtml += ' ';
            isFirstChar = true; // Next char after space should be shown
        } else if (isFirstChar) {
            hintHtml += `<span style="color: #667eea;">${word[i]}</span>`;
            isFirstChar = false;
        } else {
            hintHtml += '_';
        }
    }
    
    document.getElementById('type-japanese').textContent = translation;
    document.getElementById('type-hint').innerHTML = hintHtml;
    document.getElementById('type-input').value = '';
    document.getElementById('type-feedback').textContent = '';
    document.getElementById('type-progress').textContent = `${typeMode.currentIndex} / ${typeMode.currentWords.length}`;
}

// Handle typing input
function handleTypeInput(e) {
    const input = e.target.value.toLowerCase();
    const targetWord = typeMode.currentWords[typeMode.currentIndex];
    
    // Initialize wrong attempts counter if not exists
    if (!typeMode.wrongAttempts) {
        typeMode.wrongAttempts = 0;
        typeMode.lastWrongIndex = -1;
    }
    
    // Update hint based on correct letters typed - with color
    let hintHtml = '';
    let isFirstChar = true;
    let hasError = false;
    
    for (let i = 0; i < targetWord.length; i++) {
        if (targetWord[i] === ' ') {
            hintHtml += ' ';
            isFirstChar = true;
        } else if (i < input.length && input[i] === targetWord[i]) {
            // Correct letter - show in green
            hintHtml += `<span style="color: #28a745;">${targetWord[i]}</span>`;
            isFirstChar = false;
        } else if (i < input.length && input[i] !== targetWord[i]) {
            // Wrong letter - mark as error but don't show the correct letter
            hasError = true;
            hintHtml += `<span style="color: #dc3545;">_</span>`;
            isFirstChar = false;
            
            // Track wrong attempt for auto-reveal (only count new wrong positions)
            if (i > typeMode.lastWrongIndex) {
                typeMode.wrongAttempts++;
                typeMode.lastWrongIndex = i;
                
                // Auto-reveal after 5 wrong attempts
                if (typeMode.wrongAttempts >= 5) {
                    // Show message
                    document.getElementById('type-feedback').innerHTML = `<span style="color: #ff6b00;">💡 Auto-revealed: <strong>${targetWord}</strong></span>`;
                    
                    // Play audio for auto-revealed word
                    const translation = findTranslation(targetWord.toLowerCase());
                    if (translation) {
                        speakWordWithTranslation(targetWord, translation, null);
                    }
                    
                    // Mark as missed word
                    const key = targetWord.toLowerCase();
                    quizStats.missedWords[key] = (quizStats.missedWords[key] || 0) + 1;
                    saveStats();
                    updateMissedWordsDisplay();
                    typeMode.currentWordAttempted = true;
                    
                    // Auto-fill the input
                    document.getElementById('type-input').value = targetWord;
                    
                    // Move to next word after delay
                    setTimeout(() => {
                        typeMode.wrongAttempts = 0;
                        typeMode.lastWrongIndex = -1;
                        showNextTypeWord();
                        document.getElementById('type-input').focus();
                    }, 2000);
                    return;
                }
            }
        } else if (isFirstChar) {
            // First letter of word (or after space) - always shown
            hintHtml += `<span style="color: #667eea;">${targetWord[i]}</span>`;
            isFirstChar = false;
        } else {
            // Not yet typed - show underscore
            hintHtml += '_';
        }
    }
    document.getElementById('type-hint').innerHTML = hintHtml;
    
    // Show error feedback if there's a mistake
    if (hasError) {
        const attemptsLeft = 5 - typeMode.wrongAttempts;
        document.getElementById('type-feedback').innerHTML = `❌ Check your spelling <span style="font-size: 0.9em; color: #666;">(${attemptsLeft} attempts left)</span>`;
        document.getElementById('type-feedback').style.color = '#dc3545';
    } else {
        document.getElementById('type-feedback').textContent = '';
    }
    
    // Check if complete
    if (input === targetWord) {
        typeMode.correctCount++;
        typeMode.currentIndex++;
        document.getElementById('type-feedback').textContent = '✅ Correct!';
        document.getElementById('type-feedback').style.color = '#28a745';
        
        // Play audio for correct word
        const translation = findTranslation(targetWord.toLowerCase());
        if (translation) {
            speakWordWithTranslation(targetWord, translation, null);
        }
        
        // Disable input to prevent further typing
        const inputElement = document.getElementById('type-input');
        inputElement.disabled = true;
        inputElement.removeEventListener('input', handleTypeInput);
        
        setTimeout(() => {
            showNextTypeWord();
            // Re-enable input for next word
            inputElement.disabled = false;
            inputElement.addEventListener('input', handleTypeInput);
            inputElement.focus();
        }, 500);
    }
}

// Check type answer (for Enter key)
function checkTypeAnswer() {
    const input = document.getElementById('type-input').value.toLowerCase();
    const targetWord = typeMode.currentWords[typeMode.currentIndex];
    
    if (input === targetWord) {
        // Already handled by handleTypeInput
    } else {
        document.getElementById('type-feedback').textContent = '❌ Try again!';
        document.getElementById('type-feedback').style.color = '#dc3545';
        
        // Track incorrect attempt (but don't count multiple attempts for same word)
        if (!typeMode.currentWordAttempted) {
            const key = targetWord.toLowerCase();
            quizStats.missedWords[key] = (quizStats.missedWords[key] || 0) + 0.5; // Half point for wrong attempt
            saveStats();
            updateMissedWordsDisplay();
            typeMode.currentWordAttempted = true;
        }
    }
}

// Update timer
function updateTypeTimer() {
    if (!typeMode.isActive) return;
    
    const elapsed = Math.floor((Date.now() - typeMode.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timerElement = document.getElementById('type-timer');
    if (timerElement) {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    requestAnimationFrame(() => updateTypeTimer());
}

// Save daily stats for tracking
function saveDailyStats(mode, wordsCompleted, correctAnswers, totalTime) {
    const level = currentLevel || 'eiken2';
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `dailyStats_${level}`;
    
    // Get existing stats
    let stats = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    // Initialize today's stats if not exists
    if (!stats[today]) {
        stats[today] = {
            wordsCompleted: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            totalTime: 0,
            sessions: []
        };
    }
    
    // Update stats
    stats[today].wordsCompleted += wordsCompleted;
    stats[today].correctAnswers += correctAnswers;
    stats[today].incorrectAnswers += (wordsCompleted - correctAnswers);
    stats[today].totalTime += totalTime;
    stats[today].sessions.push({
        mode: mode,
        timestamp: new Date().toISOString(),
        wordsCompleted: wordsCompleted,
        correctAnswers: correctAnswers,
        time: totalTime
    });
    
    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(stats));
}

// Complete type game
function completeTypeMode() {
    typeMode.isActive = false;
    typeMode.endTime = Date.now();
    
    // Remove keyboard listener if in multiple choice mode
    if (typeMode.gameMode === 'multiple-choice') {
        document.removeEventListener('keydown', handleEiken3Keyboard);
    }
    
    const totalTime = (typeMode.endTime - typeMode.startTime) / 1000;
    const totalWords = typeMode.currentWords.length;
    
    // Store the time for later use
    typeMode.lastCompletionTime = totalTime;
    typeMode.lastWordCount = totalWords;
    
    // Save daily stats
    saveDailyStats(typeMode.gameMode || 'typing', totalWords, typeMode.correctCount, totalTime);
    
    // Save last tested day for this level
    localStorage.setItem(`lastTestedDay_${currentLevel}`, currentDay.toString());
    localStorage.setItem(`lastTestedDate_${currentLevel}`, new Date().toISOString());
    
    document.getElementById('type-game').style.display = 'none';
    document.getElementById('type-complete').style.display = 'block';
    
    const avgTimePerWord = (totalTime / totalWords).toFixed(2);
    document.getElementById('final-time').textContent = `${formatTime(totalTime)} (${avgTimePerWord}s per word)`;
    document.getElementById('final-correct').textContent = `${typeMode.correctCount} / ${totalWords}`;
    document.getElementById('final-skipped').textContent = `${typeMode.skippedCount}`;
    
    // Show skipped words if any
    const skippedList = document.getElementById('skipped-words-list');
    if (typeMode.skippedWords.length > 0) {
        skippedList.innerHTML = `
            <p style="color: #ffc107; font-weight: bold;">Skipped words:</p>
            <p style="color: white;">${typeMode.skippedWords.join(', ')}</p>
        `;
        console.log('Skipped words:', typeMode.skippedWords);
    } else {
        skippedList.innerHTML = '';
    }
    
    // Show nickname input only if no words were skipped
    const nicknameContainer = document.getElementById('nickname-input-container');
    if (typeMode.skippedCount === 0) {
        nicknameContainer.style.display = 'block';
        document.getElementById('nickname-input').focus();
    } else {
        nicknameContainer.style.display = 'none';
    }
}

// Format time display
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
}

// Give up on current word
function giveUpWord() {
    const targetWord = typeMode.currentWords[typeMode.currentIndex];
    
    // Show the answer
    document.getElementById('type-hint').textContent = targetWord;
    document.getElementById('type-feedback').textContent = `Answer: ${targetWord}`;
    document.getElementById('type-feedback').style.color = '#ffc107';
    
    // Count and log as skipped
    typeMode.skippedCount++;
    typeMode.skippedWords.push(targetWord);
    console.log(`Skipped word: ${targetWord}`);
    
    // Track as missed word in global stats
    const key = targetWord.toLowerCase();
    quizStats.missedWords[key] = (quizStats.missedWords[key] || 0) + 1;
    saveStats();
    updateMissedWordsDisplay();
    
    // Move to next word after a delay
    typeMode.currentIndex++;
    setTimeout(() => {
        showNextTypeWord();
        document.getElementById('type-input').focus();
    }, 1500);
}

// Reset type game
function resetTypeMode() {
    typeMode.isActive = false;
    typeMode.currentIndex = 0;
    typeMode.correctCount = 0;
    typeMode.skippedCount = 0;
    
    // Remove keyboard listener if in multiple choice mode
    if (typeMode.gameMode === 'multiple-choice') {
        document.removeEventListener('keydown', handleEiken3Keyboard);
    }
    
    document.getElementById('type-start-btn').style.display = 'inline-block';
    document.getElementById('type-reset-btn').style.display = 'none';
    document.getElementById('type-game').style.display = 'none';
    document.getElementById('type-complete').style.display = 'none';
    
    const input = document.getElementById('type-input');
    input.value = '';
    input.disabled = true;
}

// Save ranking with nickname
function saveRankingWithNickname() {
    const nickname = document.getElementById('nickname-input').value.trim();
    
    if (!nickname) {
        alert('Please enter a nickname!');
        return;
    }
    
    // Save the ranking with nickname
    saveTypeRanking(typeMode.lastCompletionTime, typeMode.lastWordCount, nickname);
    
    // Hide the nickname input
    document.getElementById('nickname-input-container').style.display = 'none';
    document.getElementById('nickname-input').value = '';
}

// Save ranking
function saveTypeRanking(time, wordCount, nickname = 'Anonymous') {
    // Save rankings per level
    const level = currentLevel || 'eiken2';
    const rankingsKey = `typeRankings_${level}`;
    
    // Load all rankings from localStorage for this level
    const allRankings = JSON.parse(localStorage.getItem(rankingsKey) || '{}');
    
    // Also maintain legacy format for backward compatibility
    const legacyRankings = JSON.parse(localStorage.getItem('typeRankingsPerDay') || '{}');
    
    // Get rankings for current day
    const dayKey = `day${currentDay}`;
    if (!allRankings[dayKey]) {
        allRankings[dayKey] = [];
    }
    if (!legacyRankings[dayKey]) {
        legacyRankings[dayKey] = [];
    }
    
    const newRanking = {
        time: time,
        date: Date.now(),
        wordCount: wordCount,
        day: currentDay,
        nickname: nickname,
        level: level,
        mode: typeMode.gameMode || 'typing' // Add game mode to ranking
    };
    
    allRankings[dayKey].push(newRanking);
    legacyRankings[dayKey].push(newRanking);
    console.log(`Added new ranking for Day ${currentDay} (${level}):`, newRanking);
    
    // Sort by average time per word (time/wordCount) and keep top 10 for this day
    allRankings[dayKey].sort((a, b) => {
        const avgTimeA = a.time / a.wordCount;
        const avgTimeB = b.time / b.wordCount;
        return avgTimeA - avgTimeB;
    });
    allRankings[dayKey] = allRankings[dayKey].slice(0, 10);
    
    // Also sort and limit legacy rankings
    legacyRankings[dayKey].sort((a, b) => {
        const avgTimeA = a.time / a.wordCount;
        const avgTimeB = b.time / b.wordCount;
        return avgTimeA - avgTimeB;
    });
    legacyRankings[dayKey] = legacyRankings[dayKey].slice(0, 10);
    
    // Save to localStorage
    localStorage.setItem(rankingsKey, JSON.stringify(allRankings));
    localStorage.setItem('typeRankingsPerDay', JSON.stringify(legacyRankings));
    console.log(`Saved rankings for Day ${currentDay} (${level}):`, allRankings[dayKey]);
    
    // Update current day's rankings in memory
    typeMode.rankings = allRankings[dayKey];
    
    loadTypeRankings();
}

// Load rankings
function loadTypeRankings() {
    // Load rankings for current level
    const level = currentLevel || 'eiken2';
    const rankingsKey = `typeRankings_${level}`;
    const allRankings = JSON.parse(localStorage.getItem(rankingsKey) || '{}');
    
    // Get rankings for current day
    const dayKey = `day${currentDay}`;
    typeMode.rankings = allRankings[dayKey] || [];
    
    const rankingsList = document.getElementById('rankings-list');
    if (!rankingsList) return;
    
    if (typeMode.rankings.length === 0) {
        rankingsList.innerHTML = `<p style="color: #6c757d;">No rankings for Day ${currentDay} yet. Complete without skipping any words!</p>`;
        return;
    }
    
    // Sort rankings by average time per word for display
    const sortedRankings = [...typeMode.rankings].sort((a, b) => {
        const avgTimeA = a.time / a.wordCount;
        const avgTimeB = b.time / b.wordCount;
        return avgTimeA - avgTimeB;
    });
    
    const html = sortedRankings.map((r, i) => {
        const date = new Date(r.date).toLocaleDateString();
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const nickname = r.nickname || 'Anonymous';
        const avgTimePerWord = (r.time / r.wordCount).toFixed(2);
        const modeIcon = r.mode === 'multiple-choice' ? '🔤' : '⌨️';
        return `
            <div class="ranking-item">
                <span class="ranking-position">${medal}</span>
                <span class="ranking-nickname" style="font-weight: bold; margin-right: 10px;">${nickname}</span>
                <span class="ranking-time">${avgTimePerWord}s/word ${modeIcon}</span>
                <span class="ranking-info">${formatTime(r.time)} total • ${r.wordCount} words • ${date}</span>
            </div>
        `;
    }).join('');
    
    rankingsList.innerHTML = html;
}

// Set mode (reading, quiz, or type)
function setMode(mode) {
    currentMode = mode;
    
    // Update button states
    document.getElementById('reading-mode-btn').classList.toggle('active', mode === 'reading');
    document.getElementById('quiz-mode-btn').classList.toggle('active', mode === 'quiz');
    document.getElementById('type-mode-btn').classList.toggle('active', mode === 'type');
    
    // Redisplay current day
    displayDay(currentDay);
    
    // Show appropriate tab
    if (mode === 'quiz') {
        switchTab('stats');
    } else if (mode === 'type') {
        switchTab('stats');
    } else {
        switchTab('words');
    }
}

// Toggle study panel visibility
function toggleStudyPanel() {
    const panel = document.querySelector('.vocabulary-panel');
    const diaryContent = document.querySelector('.diary-content');
    const showBtn = document.querySelector('.panel-show-btn');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        diaryContent.style.width = 'calc(100% - 280px)';
        showBtn.style.display = 'none';
    } else {
        panel.classList.add('hidden');
        diaryContent.style.width = '100%';
        showBtn.style.display = 'block';
    }
}

// Switch panel tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        // Find the button for this tab and activate it
        if (btn.textContent.toLowerCase().includes(tabName) || 
            (tabName === 'words' && btn.textContent === 'Today') ||
            (tabName === 'all' && btn.textContent === 'All Words')) {
            btn.classList.add('active');
        }
    });
    
    // If called from onclick event, also activate the clicked button
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Show/hide search box for all words tab
    const searchContainer = document.getElementById('search-container');
    if (tabName === 'all') {
        searchContainer.style.display = 'block';
        updateAllWordsDisplay();
    } else {
        searchContainer.style.display = 'none';
    }
    
    // Update displays if needed
    if (tabName === 'missed') {
        updateMissedWordsDisplay();
    }
}

// Reset stats
function resetStats() {
    if (confirm('Are you sure you want to reset all quiz statistics?')) {
        quizStats = {
            total: 0,
            correct: 0,
            incorrect: 0,
            currentStreak: 0,
            bestStreak: 0,
            missedWords: {}
        };
        saveStats();
        updateStatsDisplay();
        updateMissedWordsDisplay();
        
        // Refresh current day to update vocabulary panel
        displayDay(currentDay);
    }
}

// Navigation functions
function previousDay() {
    if (currentDay > 1) {
        displayDay(currentDay - 1);
    }
}

function nextDay() {
    if (currentDay < diaryData.length) {
        displayDay(currentDay + 1);
    }
}

// Go to specific day from dropdown
function goToDay(day) {
    const dayNum = parseInt(day);
    if (dayNum >= 1 && dayNum <= diaryData.length) {
        displayDay(dayNum);
    }
}

// Update day selector dropdown
function updateDaySelector(currentDayNum) {
    const selector = document.getElementById('day-selector');
    if (!selector) {
        console.error('Day selector element not found');
        return;
    }
    
    if (!diaryData || diaryData.length === 0) {
        console.error('No diary data available for selector');
        return;
    }
    
    // Only populate if empty or length changed
    if (selector.options.length !== diaryData.length) {
        selector.innerHTML = '';
        for (let i = 0; i < diaryData.length; i++) {
            const option = document.createElement('option');
            option.value = i + 1;
            const entry = diaryData[i];
            // Show the actual title which includes part info if present
            option.textContent = entry && entry.title ? `Day ${entry.day}: ${entry.title}` : `Day ${i + 1}`;
            selector.appendChild(option);
        }
    }
    
    // Set current selection
    if (currentDayNum && currentDayNum <= selector.options.length) {
        selector.value = currentDayNum;
    }
}

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft') {
        previousDay();
    } else if (e.key === 'ArrowRight') {
        nextDay();
    } else if (e.key === 'Escape') {
        closeQuizPopup();
    }
});

// Hide tooltips on scroll (especially for mobile)
document.addEventListener('scroll', function() {
    hideTooltip();
}, true);

// Also hide on touch move for mobile
document.addEventListener('touchmove', function() {
    hideTooltip();
});

// Switch between Eiken levels
async function switchLevel(level) {
    currentLevel = level;
    currentDay = 1;
    diaryData = [];
    vocabularyData = {};
    allVocabularyWords = {};
    
    // Title update removed since we no longer have the main title element
    
    // Save level selection
    localStorage.setItem('currentLevel', level);
    
    // Clear localStorage for current day (level-specific)
    localStorage.removeItem('currentDiaryDay_' + level);
    
    // Load stats for the new level
    loadStats();
    
    // Reload data for new level
    await loadVocabulary();
    await loadDiary();
    updateStatsDisplay();
    updateMissedWordsDisplay();
}

// Initialize the application
async function init() {
    // Check if there's a saved level
    const savedLevel = localStorage.getItem('currentLevel') || 'eiken2';
    currentLevel = savedLevel;
    document.getElementById('level-selector').value = savedLevel;
    
    // Title setting removed since we no longer have the main title element
    
    loadStats();
    await loadVocabulary();
    await loadDiary();
    updateStatsDisplay();
    updateMissedWordsDisplay();
}

// Missed words quiz mode variables
let missedWordsQuizMode = {
    isActive: false,
    words: [],
    currentIndex: 0,
    correctCount: 0
};

// Start missed words quiz
function startMissedWordsQuiz() {
    // Get all missed words for current level
    const missedWords = Object.entries(quizStats.missedWords)
        .filter(([word, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]) // Sort by miss count
        .map(([word, count]) => word);
    
    if (missedWords.length === 0) {
        alert('No missed words to quiz! Great job! 🎉');
        return;
    }
    
    // Initialize quiz mode
    missedWordsQuizMode.isActive = true;
    missedWordsQuizMode.words = [...missedWords];
    missedWordsQuizMode.currentIndex = 0;
    missedWordsQuizMode.correctCount = 0;
    
    // Shuffle words
    for (let i = missedWordsQuizMode.words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [missedWordsQuizMode.words[i], missedWordsQuizMode.words[j]] = 
            [missedWordsQuizMode.words[j], missedWordsQuizMode.words[i]];
    }
    
    // Display quiz interface
    displayMissedWordsQuiz();
}

// Display missed words quiz
function displayMissedWordsQuiz() {
    const word = missedWordsQuizMode.words[missedWordsQuizMode.currentIndex];
    const wordData = vocabularyData[word.toLowerCase()];
    const translation = findTranslation(word) || wordData?.japanese || '翻訳が見つかりません';
    const missCount = quizStats.missedWords[word] || 0;
    
    const html = `
        <div class="content-wrapper">
            <h2 class="day-title" style="background: linear-gradient(135deg, #ff6b6b, #ff8e53);">
                🎯 Missed Words Quiz - ${missedWordsQuizMode.currentIndex + 1} / ${missedWordsQuizMode.words.length}
            </h2>
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 1.2em; color: var(--text-secondary); margin-bottom: 20px;">
                    Translate this word (missed ${missCount} times):
                </div>
                <div style="font-size: 2.5em; font-weight: bold; color: var(--text-primary); margin: 30px 0;">
                    ${translation}
                </div>
                <input type="text" 
                       id="missed-quiz-input" 
                       placeholder="Type the English word..." 
                       style="font-size: 1.5em; padding: 15px 30px; width: 80%; max-width: 400px; 
                              border: 3px solid var(--border-color); border-radius: 10px;
                              text-align: center; margin: 20px 0;"
                       onkeypress="if(event.key === 'Enter') checkMissedQuizAnswer()">
                <div style="margin-top: 30px;">
                    <button onclick="checkMissedQuizAnswer()" 
                            style="padding: 12px 30px; font-size: 1.1em; margin: 0 10px;
                                   background: var(--success); color: white; border: none; 
                                   border-radius: 8px; cursor: pointer;">
                        Check Answer
                    </button>
                    <button onclick="skipMissedWord()" 
                            style="padding: 12px 30px; font-size: 1.1em; margin: 0 10px;
                                   background: var(--warning); color: white; border: none; 
                                   border-radius: 8px; cursor: pointer;">
                        Skip
                    </button>
                    <button onclick="exitMissedWordsQuiz()" 
                            style="padding: 12px 30px; font-size: 1.1em; margin: 0 10px;
                                   background: var(--danger); color: white; border: none; 
                                   border-radius: 8px; cursor: pointer;">
                        Exit Quiz
                    </button>
                </div>
                <div id="missed-quiz-feedback" style="margin-top: 20px; font-size: 1.2em; min-height: 30px;"></div>
                <div style="margin-top: 20px; color: var(--text-secondary);">
                    Progress: ${missedWordsQuizMode.correctCount} correct out of ${missedWordsQuizMode.currentIndex} attempted
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('diary-entry').innerHTML = html;
    
    // Focus on input
    setTimeout(() => {
        document.getElementById('missed-quiz-input').focus();
    }, 100);
}

// Check missed quiz answer
function checkMissedQuizAnswer() {
    const input = document.getElementById('missed-quiz-input').value.toLowerCase().trim();
    const correctWord = missedWordsQuizMode.words[missedWordsQuizMode.currentIndex].toLowerCase();
    const feedback = document.getElementById('missed-quiz-feedback');
    
    if (input === correctWord) {
        // Correct answer - reduce or remove from missed list
        feedback.innerHTML = '<span style="color: var(--success);">✅ Correct!</span>';
        missedWordsQuizMode.correctCount++;
        
        // Play audio for correct word
        const translation = findTranslation(correctWord);
        if (translation) {
            speakWordWithTranslation(correctWord, translation, null);
        }
        
        // Reduce miss count or remove from missed words
        if (quizStats.missedWords[correctWord] > 1) {
            quizStats.missedWords[correctWord]--;
        } else {
            delete quizStats.missedWords[correctWord];
        }
        saveStats();
        updateMissedWordsDisplay();
        
        // Move to next word after delay
        setTimeout(() => {
            missedWordsQuizMode.currentIndex++;
            if (missedWordsQuizMode.currentIndex < missedWordsQuizMode.words.length) {
                displayMissedWordsQuiz();
            } else {
                completeMissedWordsQuiz();
            }
        }, 1500);
    } else {
        // Incorrect answer
        feedback.innerHTML = `<span style="color: var(--danger);">❌ Try again! The correct answer is: ${correctWord}</span>`;
        
        // Play audio for correct word
        const translation = findTranslation(correctWord);
        if (translation) {
            speakWordWithTranslation(correctWord, translation, null);
        }
        
        // Add to miss count
        quizStats.missedWords[correctWord] = (quizStats.missedWords[correctWord] || 0) + 0.5;
        saveStats();
        updateMissedWordsDisplay();
    }
}

// Skip current missed word
function skipMissedWord() {
    const correctWord = missedWordsQuizMode.words[missedWordsQuizMode.currentIndex];
    const feedback = document.getElementById('missed-quiz-feedback');
    
    feedback.innerHTML = `<span style="color: var(--warning);">Skipped. The answer was: ${correctWord}</span>`;
    
    // Don't change miss count for skipped words
    
    setTimeout(() => {
        missedWordsQuizMode.currentIndex++;
        if (missedWordsQuizMode.currentIndex < missedWordsQuizMode.words.length) {
            displayMissedWordsQuiz();
        } else {
            completeMissedWordsQuiz();
        }
    }, 2000);
}

// Complete missed words quiz
function completeMissedWordsQuiz() {
    const total = missedWordsQuizMode.words.length;
    const correct = missedWordsQuizMode.correctCount;
    const percentage = Math.round((correct / total) * 100);
    
    // Save daily stats (estimate 5 seconds per word for quiz)
    saveDailyStats('missed-words-quiz', total, correct, total * 5);
    
    const html = `
        <div class="content-wrapper">
            <h2 class="day-title" style="background: linear-gradient(135deg, #ff6b6b, #ff8e53);">
                🎯 Missed Words Quiz Complete!
            </h2>
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3em; margin: 20px 0;">
                    ${percentage >= 80 ? '🏆' : percentage >= 60 ? '👏' : percentage >= 40 ? '💪' : '📚'}
                </div>
                <div style="font-size: 2em; font-weight: bold; color: var(--text-primary); margin: 20px 0;">
                    Score: ${correct} / ${total} (${percentage}%)
                </div>
                <div style="font-size: 1.2em; color: var(--text-secondary); margin: 20px 0;">
                    ${percentage >= 80 ? 'Excellent work!' : 
                      percentage >= 60 ? 'Good job! Keep practicing!' : 
                      percentage >= 40 ? 'Nice effort! Review the missed words.' : 
                      'Keep studying! You\'ll get better with practice.'}
                </div>
                <div style="margin-top: 30px;">
                    <button onclick="startMissedWordsQuiz()" 
                            style="padding: 12px 30px; font-size: 1.1em; margin: 0 10px;
                                   background: var(--success); color: white; border: none; 
                                   border-radius: 8px; cursor: pointer;">
                        Try Again
                    </button>
                    <button onclick="exitMissedWordsQuiz()" 
                            style="padding: 12px 30px; font-size: 1.1em; margin: 0 10px;
                                   background: var(--accent-primary); color: white; border: none; 
                                   border-radius: 8px; cursor: pointer;">
                        Back to Reading
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('diary-entry').innerHTML = html;
    missedWordsQuizMode.isActive = false;
}

// Exit missed words quiz
function exitMissedWordsQuiz() {
    missedWordsQuizMode.isActive = false;
    setMode('reading');
}

// Update all words display
function updateAllWordsDisplay(filterText = '') {
    const allWordsList = Object.values(allVocabularyWords)
        .filter(word => {
            if (!filterText) return true;
            const searchLower = filterText.toLowerCase();
            return word.english.toLowerCase().includes(searchLower) || 
                   word.japanese.toLowerCase().includes(searchLower);
        })
        .sort((a, b) => a.english.localeCompare(b.english));
    
    const html = allWordsList.map(word => {
        const daysText = word.days.length > 3 
            ? `Days ${word.days[0]}, ${word.days[1]}, ... (${word.days.length} total)`
            : `Day${word.days.length > 1 ? 's' : ''} ${word.days.join(', ')}`;
        
        const wordData = vocabularyData[word.english.toLowerCase()];
        const wordId = wordData?.id || '';
        
        return `
            <div class="word-item" 
                 style="position: relative; cursor: pointer;"
                 data-english="${word.english.replace(/"/g, '&quot;')}"
                 data-japanese="${word.japanese.replace(/"/g, '&quot;')}"
                 data-days="${word.days.join(',')}"
                 title="Click to jump to Day ${word.days[0]}">
                <span class="word-id">#${wordId}</span>
                <div class="word-en">${word.english}</div>
                <div class="word-jp">${word.japanese}</div>
                <div style="font-size: 0.8em; color: #6c757d; margin-top: 3px;">${daysText}</div>
            </div>
        `;
    }).join('');
    
    const listElement = document.getElementById('all-words-list');
    if (listElement) {
        listElement.innerHTML = html || '<div class="loading">No words found</div>';
        
        // Add click listeners
        setTimeout(() => {
            document.querySelectorAll('#all-words-list .word-item').forEach(item => {
                item.addEventListener('click', function() {
                    const english = this.dataset.english;
                    const japanese = this.dataset.japanese;
                    const days = this.dataset.days.split(',').map(Number);
                    
                    // Save the current scroll position of the panel content
                    const panelContent = document.querySelector('.panel-content');
                    const savedScrollTop = panelContent ? panelContent.scrollTop : 0;
                    
                    // Jump to the first day containing this word
                    if (days.length > 0) {
                        currentDay = days[0];
                        displayDay(currentDay);
                        
                        // Keep the current tab active (don't switch tabs)
                        // The user stays on "All Words" tab
                        
                        // Restore the scroll position of the panel content
                        setTimeout(() => {
                            if (panelContent) {
                                panelContent.scrollTop = savedScrollTop;
                            }
                        }, 0);
                        
                        // After a short delay, highlight the word
                        setTimeout(() => {
                            highlightWordInPassage(english);
                            // Also speak it
                            handleVocabClick(english, japanese);
                        }, 300);
                    }
                });
            });
        }, 0);
    }
}

// Filter all words
function filterAllWords() {
    const searchText = document.getElementById('word-search').value;
    updateAllWordsDisplay(searchText);
}

// Multiple Choice Mode for all levels
function startMultipleChoiceMode() {
    document.getElementById('type-start-btn').style.display = 'none';
    document.getElementById('type-reset-btn').style.display = 'inline-block';
    
    // Prepare HTML for multiple choice interface
    const typeGameContainer = document.getElementById('type-game');
    typeGameContainer.style.display = 'block';
    document.getElementById('type-complete').style.display = 'none';
    
    // Reset mode variables
    typeMode.isActive = true;
    typeMode.startTime = Date.now();
    typeMode.currentIndex = 0;
    typeMode.correctCount = 0;
    typeMode.skippedCount = 0;
    typeMode.skippedWords = [];
    typeMode.currentPhase = 'choice';
    typeMode.isAnswered = false;
    
    // Get words for current day from diary content
    let availableWords = [];
    const dayData = diaryData[currentDay - 1];
    
    if (dayData && dayData.english) {
        // Store the entry for context
        typeMode.currentEntry = dayData.english;
        
        // Extract vocabulary words from the diary entry
        const diaryWords = extractVocabularyWords(dayData.english);
        // Get just the English words in lowercase
        availableWords = diaryWords.map(w => w.english.toLowerCase())
            .filter(word => vocabularyData[word]);
    }
    
    // If no words found or very few, use all vocabulary as fallback
    if (availableWords.length < 5) {
        availableWords = Object.keys(vocabularyData);
        const shuffled = availableWords.sort(() => 0.5 - Math.random());
        typeMode.currentWords = shuffled.slice(0, 20);
    } else {
        // Use all words from the day (no limit)
        typeMode.currentWords = availableWords;
    }
    
    // Create multiple choice interface
    createEiken3Interface();
    
    // Start timer
    updateTypeTimer();
    
    // Start with first question
    generateMultipleChoiceQuestion();
}

function createEiken3Interface() {
    const typeGameContainer = document.getElementById('type-game');
    
    // Add keyboard event listener for number keys
    document.addEventListener('keydown', handleEiken3Keyboard);
    
    typeGameContainer.innerHTML = `
        <div class="eiken3-question-section">
            <div id="type-japanese" class="type-japanese"></div>
            <div id="type-sentence" class="type-sentence"></div>
            
            <div class="eiken3-choices" id="eiken3-choices" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0;">
                <button class="choice-btn" onclick="selectEiken3Choice(1)" data-choice="1">
                    <span class="choice-number">1</span>
                    <span id="choice-text-1"></span>
                </button>
                <button class="choice-btn" onclick="selectEiken3Choice(2)" data-choice="2">
                    <span class="choice-number">2</span>
                    <span id="choice-text-2"></span>
                </button>
                <button class="choice-btn" onclick="selectEiken3Choice(3)" data-choice="3">
                    <span class="choice-number">3</span>
                    <span id="choice-text-3"></span>
                </button>
                <button class="choice-btn" onclick="selectEiken3Choice(4)" data-choice="4">
                    <span class="choice-number">4</span>
                    <span id="choice-text-4"></span>
                </button>
            </div>
            
            <div id="type-feedback" class="type-feedback" style="min-height: 80px; display: flex; align-items: center; justify-content: center; position: relative;">
                <div class="eiken3-typing-section" id="eiken3-typing-section" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                        <div style="font-size: 40px; color: #28a745;">✓</div>
                        <div id="correct-answer-display" style="font-size: 1.8em; font-weight: bold; color: #28a745;"></div>
                        <input type="text" id="type-input" class="type-input" placeholder="Type here..." 
                               style="width: 200px; padding: 10px; font-size: 1.3em; border: 2px solid #dee2e6; border-radius: 8px;">
                    </div>
                    <div style="text-align: center; margin-top: 10px;">
                        <button class="give-up-btn" id="skip-typing-btn" onclick="skipEiken3Typing()" style="padding: 6px 15px; font-size: 0.85em;">
                            スキップ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add CSS for choice buttons
    const style = document.createElement('style');
    style.textContent = `
        .choice-btn {
            background: #f8f9fa;
            border: 3px solid #dee2e6;
            border-radius: 10px;
            padding: 20px;
            font-size: 1.3em;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
        }
        .choice-btn:hover:not(:disabled) {
            background: #e9ecef;
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .choice-btn:disabled {
            cursor: not-allowed;
            opacity: 0.6;
        }
        .choice-btn.correct {
            background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
            border-color: #28a745;
            animation: correctPulse 0.6s ease;
            box-shadow: 0 0 20px rgba(40, 167, 69, 0.4);
        }
        .choice-btn.incorrect {
            background: #f8d7da;
            border-color: #dc3545;
            animation: shake 0.5s ease;
            box-shadow: 0 0 20px rgba(220, 53, 69, 0.3);
        }
        .choice-btn.show-answer {
            background: #fff3cd;
            border-color: #ffc107;
        }
        .choice-number {
            position: absolute;
            top: 10px;
            left: 10px;
            background: #667eea;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.9em;
        }
        @keyframes correctPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }
        @keyframes fadeInScale {
            0% { 
                opacity: 0;
                transform: scale(0);
            }
            100% { 
                opacity: 1;
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(style);
}

function generateMultipleChoiceQuestion() {
    if (typeMode.currentIndex >= typeMode.currentWords.length) {
        completeTypeMode();
        return;
    }
    
    // Update progress display
    const progressElement = document.getElementById('type-progress');
    if (progressElement) {
        progressElement.textContent = `${typeMode.currentIndex + 1} / ${typeMode.currentWords.length}`;
    }
    
    typeMode.currentPhase = 'choice';
    typeMode.isAnswered = false;
    typeMode.questionStartTime = Date.now(); // Track when question started
    
    // Reset UI - just clear the feedback div
    const feedbackDiv = document.getElementById('type-feedback');
    if (feedbackDiv) {
        feedbackDiv.innerHTML = '';
    }
    
    // Enable choice buttons
    const choiceButtons = document.querySelectorAll('.choice-btn');
    choiceButtons.forEach(btn => {
        btn.disabled = false;
        btn.className = 'choice-btn';
    });
    
    // Get current word
    const correctWord = typeMode.currentWords[typeMode.currentIndex];
    typeMode.currentQuestion = correctWord;
    
    // Display Japanese translation
    const translation = findTranslation(correctWord) || vocabularyData[correctWord]?.japanese || '';
    document.getElementById('type-japanese').textContent = translation;
    
    // Find and display sentence context
    const sentence = findSentenceWithWord(typeMode.currentEntry || diaryData[currentDay - 1]?.english || '', correctWord);
    if (sentence) {
        // Create display sentence with blank for the target word
        let displaySentence = sentence;
        
        // Replace the word and its variations with blanks
        const wordPattern = new RegExp(`\\b${correctWord}(?:s|es|ed|d|ing|ly)?\\b`, 'gi');
        displaySentence = displaySentence.replace(wordPattern, '<span class="type-blank">_____</span>');
        
        // Bold other vocabulary words
        displaySentence = displaySentence.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        document.getElementById('type-sentence').innerHTML = `<div class="sentence-context">${displaySentence}</div>`;
    } else {
        document.getElementById('type-sentence').innerHTML = '';
    }
    
    // Generate choices
    const choices = [correctWord];
    const allWords = Object.keys(vocabularyData);
    
    while (choices.length < 4) {
        const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
        if (!choices.includes(randomWord) && randomWord.length > 2) {
            choices.push(randomWord);
        }
    }
    
    // Shuffle choices
    for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    
    // Display choices
    for (let i = 0; i < 4; i++) {
        document.getElementById(`choice-text-${i + 1}`).textContent = choices[i];
        document.querySelector(`[data-choice="${i + 1}"]`).dataset.word = choices[i];
    }
}

function selectEiken3Choice(choiceNum) {
    if (typeMode.isAnswered) return;
    
    typeMode.isAnswered = true;
    const selectedBtn = document.querySelector(`[data-choice="${choiceNum}"]`);
    const selectedWord = selectedBtn.dataset.word;
    
    // Disable all buttons
    document.querySelectorAll('.choice-btn').forEach(btn => btn.disabled = true);
    
    if (selectedWord === typeMode.currentQuestion) {
        // Correct answer
        typeMode.correctCount++;
        typeMode.choiceCorrect = true;
        selectedBtn.classList.add('correct');
        
        // Calculate response time
        const responseTime = ((Date.now() - typeMode.questionStartTime) / 1000).toFixed(1);
        
        // Get best time for this question from localStorage
        const bestTimes = JSON.parse(localStorage.getItem('eiken3BestTimes') || '{}');
        const questionKey = `${currentLevel}_${typeMode.currentQuestion}`;
        const previousBest = bestTimes[questionKey];
        let isBestTime = false;
        
        if (!previousBest || parseFloat(responseTime) < parseFloat(previousBest)) {
            bestTimes[questionKey] = responseTime;
            localStorage.setItem('eiken3BestTimes', JSON.stringify(bestTimes));
            isBestTime = true;
        }
        
        // Show checkmark on top of the correct button
        selectedBtn.parentElement.style.position = 'relative';
        
        const checkmark = document.createElement('div');
        
        // Create checkmark with time display
        let checkmarkContent = `
            <div style="text-align: center;">
                <div style="font-size: 60px; line-height: 1;">✓</div>
                <div style="font-size: 18px; font-weight: bold; margin-top: -5px;">
                    ${responseTime}s
                    ${isBestTime ? '<span style="color: #ffd700; margin-left: 5px;">★ BEST!</span>' : ''}
                </div>
            </div>
        `;
        
        checkmark.innerHTML = checkmarkContent;
        
        // Position relative to the button itself
        const btnIndex = Array.from(selectedBtn.parentElement.children).indexOf(selectedBtn);
        const row = Math.floor(btnIndex / 2);
        const col = btnIndex % 2;
        
        checkmark.style.cssText = `
            position: absolute;
            color: #28a745;
            animation: fadeInScale 0.5s ease;
            z-index: 1000;
            left: ${col === 0 ? '25%' : '75%'};
            top: ${row === 0 ? '25%' : '75%'};
            transform: translate(-50%, -50%);
            pointer-events: none;
        `;
        
        selectedBtn.parentElement.appendChild(checkmark);
        
        // Move to next question after a short delay
        setTimeout(() => {
            checkmark.remove();
            typeMode.currentIndex++;
            generateMultipleChoiceQuestion();
        }, 1500);
    } else {
        // Incorrect answer
        typeMode.choiceCorrect = false;
        selectedBtn.classList.add('incorrect');
        
        // Track as missed word in global stats
        const key = typeMode.currentQuestion.toLowerCase();
        quizStats.missedWords[key] = (quizStats.missedWords[key] || 0) + 1;
        saveStats();
        updateMissedWordsDisplay();
        
        // Show X on top of the incorrect button
        selectedBtn.parentElement.style.position = 'relative';
        
        const xmark = document.createElement('div');
        xmark.innerHTML = '✗';
        
        // Position relative to the button itself
        const btnIndex = Array.from(selectedBtn.parentElement.children).indexOf(selectedBtn);
        const row = Math.floor(btnIndex / 2);
        const col = btnIndex % 2;
        
        xmark.style.cssText = `
            position: absolute;
            font-size: 60px;
            color: #dc3545;
            animation: fadeInScale 0.5s ease;
            z-index: 1000;
            left: ${col === 0 ? '25%' : '75%'};
            top: ${row === 0 ? '25%' : '75%'};
            transform: translate(-50%, -50%);
            pointer-events: none;
        `;
        
        selectedBtn.parentElement.appendChild(xmark);
        
        // Show correct answer
        document.querySelectorAll('.choice-btn').forEach(btn => {
            if (btn.dataset.word === typeMode.currentQuestion) {
                btn.classList.add('show-answer');
            }
        });
        
        // Move to next question after delay
        setTimeout(() => {
            xmark.remove();
            typeMode.currentIndex++;
            generateMultipleChoiceQuestion();
        }, 2000);
    }
}

function startEiken3TypingPhase() {
    typeMode.currentPhase = 'typing';
    
    // Hide the feedback icon and show typing section
    const feedbackDiv = document.getElementById('type-feedback');
    const typingSection = document.getElementById('eiken3-typing-section');
    
    // Clear the feedback div immediately
    feedbackDiv.innerHTML = '';
    
    // Reset typing section styles to ensure visibility
    typingSection.style.display = 'block';
    typingSection.style.position = 'relative';
    typingSection.style.transform = 'none';
    typingSection.style.top = 'auto';
    typingSection.style.left = 'auto';
    typingSection.style.width = '100%';
    
    // Move typing section to feedback div
    feedbackDiv.appendChild(typingSection);
    
    // Set the correct answer display
    document.getElementById('correct-answer-display').textContent = typeMode.currentQuestion;
    
    // Clear and enable the input
    const input = document.getElementById('type-input');
    input.value = '';
    input.disabled = false;
    
    // Small delay to ensure DOM is updated before focusing
    setTimeout(() => {
        input.focus();
    }, 100);
    
    // Add input event listener
    input.onkeyup = function(event) {
        const typedWord = input.value.trim().toLowerCase();
        const correctWord = typeMode.currentQuestion.toLowerCase();
        
        if (typedWord === correctWord) {
            input.style.borderColor = '#28a745';
            input.style.backgroundColor = '#d4edda';
            
            // Auto proceed after correct typing
            setTimeout(() => {
                typeMode.currentIndex++;
                generateMultipleChoiceQuestion();
                // Scroll to top of game area for next question
                document.getElementById('type-game').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 1000);
        } else if (typedWord.length > 0 && !correctWord.startsWith(typedWord)) {
            input.style.borderColor = '#dc3545';
            input.style.backgroundColor = '#f8d7da';
        } else {
            input.style.borderColor = '#dee2e6';
            input.style.backgroundColor = 'white';
        }
        
        // Allow Enter key to skip if correct
        if (event.key === 'Enter' && typedWord === correctWord) {
            typeMode.currentIndex++;
            generateMultipleChoiceQuestion();
        }
    };
}

function skipEiken3Typing() {
    if (!typeMode.choiceCorrect) {
        typeMode.skippedCount++;
        typeMode.skippedWords.push(typeMode.currentQuestion);
        
        // Track as missed word in global stats
        const key = typeMode.currentQuestion.toLowerCase();
        quizStats.missedWords[key] = (quizStats.missedWords[key] || 0) + 1;
        saveStats();
        updateMissedWordsDisplay();
    }
    typeMode.currentIndex++;
    generateMultipleChoiceQuestion();
    // Scroll to top of game area for next question
    document.getElementById('type-game').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Handle keyboard input for Eiken 3 multiple choice
function handleEiken3Keyboard(event) {
    // Only handle keyboard in choice phase when Eiken 3 is active
    if (currentLevel !== 'eiken3' || !typeMode.isActive || typeMode.currentPhase !== 'choice' || typeMode.isAnswered) {
        return;
    }
    
    // Check if typing in the input field
    if (document.activeElement && document.activeElement.id === 'type-input') {
        return;
    }
    
    // Handle number keys 1-4
    if (event.key >= '1' && event.key <= '4') {
        event.preventDefault();
        selectEiken3Choice(parseInt(event.key));
    }
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', init);