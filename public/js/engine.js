// Smash Keys Core Typing Engine

// Predefined Word Pools
const CORE_WORD_POOL = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you",
  "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one",
  "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some",
  "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think", "also", "back",
  "after", "use", "two", "how", "our", "work", "first", "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "system", "code", "cyber", "neon", "speed", "key", "space", "shift", "data", "future",
  "smash", "fast", "input", "light", "glow", "screen", "pulse", "matrix", "dracula", "nord", "visual", "carbon", "focus",
  "sound", "audio", "graph", "metric", "room", "lobby", "race", "avatar", "streak", "level", "points", "xp", "perfect",
  "style", "theme", "accuracy", "error", "correct", "character", "timer", "clock", "countdown", "result", "score",
  "leaderboard", "profile", "settings", "developer", "engine", "syntax", "array", "object", "function", "variable",
  "promise", "async", "await", "import", "export", "class", "const", "let", "return", "document", "window", "console",
  "compile", "debug", "loop", "string", "number", "boolean", "null", "undefined", "symbol", "bigint", "stack", "queue"
];

const CODE_TEMPLATES = [
  "const sum = (a, b) => a + b;",
  "function fetch(url) { return fetch(url).then(r => r.json()); }",
  "class Node { constructor(val) { this.val = val; this.next = null; } }",
  "const [data, setData] = useState(null);",
  "document.addEventListener('keydown', (e) => { e.preventDefault(); });",
  "const query = await db.users.find({ age: { $gt: 18 } });",
  "app.listen(PORT, () => console.log('Server online'));",
  "try { await run(); } catch (err) { console.error(err); }",
  "const double = array.map(x => x * 2);",
  "export default function main() { return <div className='container'>App</div>; }"
];

const QUOTES_POOL = [
  "In the middle of difficulty lies opportunity. Speed is nothing without accuracy.",
  "The only way to do great work is to love what you do. Focus on the keystrokes.",
  "Talk is cheap. Show me the code. Smash your limits and type faster.",
  "Programs must be written for people to read, and only incidentally for machines to execute.",
  "A person who never made a mistake never tried anything new. Backspace is your ally."
];

export class TypingEngine {
  constructor(options = {}) {
    this.wordsContainer = document.getElementById(options.wordsContainerId || 'words-box');
    this.caret = document.getElementById(options.caretId || 'typing-caret');
    this.input = document.getElementById(options.inputId || 'typing-input');
    
    this.liveTimer = document.getElementById('live-timer');
    this.liveWpm = document.getElementById('live-wpm');
    this.liveAcc = document.getElementById('live-acc');

    this.onComplete = options.onComplete || (() => {});
    
    // Configurations
    this.modeType = 'time'; // 'time', 'words', 'custom', 'code'
    this.modeVal = '30';    // 15, 30, 60, 120 / 10, 25, 50, 100
    this.soundType = 'mechanical';
    this.soundVolume = 0.5;
    this.caretStyle = 'line';

    // State Variables
    this.words = [];
    this.currentWordIdx = 0;
    this.currentCharIdx = 0;
    this.isRunning = false;
    this.isFinished = false;
    
    this.timerInterval = null;
    this.timeLeft = 30;
    this.timeElapsed = 0;
    
    // Metrics
    this.correctChars = 0;
    this.errorChars = 0;
    this.totalTyped = 0;
    
    // Analytics logs
    this.history = []; // [{ time, wpm, acc }]
    this.errorKeys = {};
    this.keyTimestamps = []; // [{ time: ms, key: char }]

    this.initEvents();
  }

  initEvents() {
    // Focus input on container click
    const container = this.wordsContainer.parentElement;
    if (container) {
      container.addEventListener('click', () => this.focusInput());
    }

    // Input events
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    // Auto-focus on boot
    this.focusInput();
  }

  focusInput() {
    if (!this.isFinished) {
      this.input.focus();
    }
  }

  configure(settings) {
    if (settings.theme) document.documentElement.setAttribute('data-theme', settings.theme);
    if (settings.soundType) this.soundType = settings.soundType;
    if (settings.soundVolume !== undefined) this.soundVolume = settings.soundVolume;
    if (settings.caret) {
      this.caretStyle = settings.caret;
      this.updateCaretStyle();
    }
    if (settings.fontSize) {
      this.wordsContainer.style.fontSize = settings.fontSize;
      // Recalculate caret position
      setTimeout(() => this.updateCaret(), 50);
    }
    if (settings.font) {
      this.wordsContainer.style.fontFamily = settings.font;
      setTimeout(() => this.updateCaret(), 50);
    }
  }

  updateCaretStyle() {
    this.caret.className = 'caret';
    if (this.caretStyle === 'block') this.caret.classList.add('style-block');
    else if (this.caretStyle === 'underline') this.caret.classList.add('style-underline');
    else if (this.caretStyle === 'blink') this.caret.classList.add('style-blink');
    else if (this.caretStyle === 'hidden') this.caret.style.display = 'none';
    
    if (this.caretStyle !== 'hidden') this.caret.style.display = 'block';
  }

  // Set typing text
  setSource(modeType, modeVal) {
    this.modeType = modeType;
    this.modeVal = modeVal;
    this.reset();

    let text = '';
    if (modeType === 'time' || modeType === 'words') {
      const wordCount = modeType === 'words' ? parseInt(modeVal) : 80; // Keep extra words buffered
      const temp = [];
      for (let i = 0; i < wordCount; i++) {
        temp.push(CORE_WORD_POOL[Math.floor(Math.random() * CORE_WORD_POOL.length)]);
      }
      text = temp.join(' ');
    } else if (modeType === 'custom') {
      text = modeVal || "Type something customize to practice...";
    } else if (modeType === 'code') {
      // Pick random code template
      text = CODE_TEMPLATES[Math.floor(Math.random() * CODE_TEMPLATES.length)];
    }

    this.words = text.split(' ').filter(w => w.length > 0);
    this.renderWords();
    this.updateCaret();
  }

  reset() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isRunning = false;
    this.isFinished = false;
    
    this.currentWordIdx = 0;
    this.currentCharIdx = 0;
    this.correctChars = 0;
    this.errorChars = 0;
    this.totalTyped = 0;
    this.timeLeft = this.modeType === 'time' ? parseInt(this.modeVal) : 0;
    this.timeElapsed = 0;
    
    this.history = [];
    this.errorKeys = {};
    this.keyTimestamps = [];
    
    this.input.value = '';
    
    if (this.liveTimer) {
      if (this.modeType === 'time') {
        this.liveTimer.textContent = this.timeLeft;
      } else if (this.modeType === 'words') {
        this.liveTimer.textContent = `0/${this.modeVal}`;
      } else {
        this.liveTimer.textContent = '00';
      }
    }
    if (this.liveWpm) {
      this.liveWpm.textContent = '0';
    }
    if (this.liveAcc) {
      this.liveAcc.textContent = '100%';
    }

    // Reset container scroll offset
    this.wordsContainer.style.transform = 'translateY(0px)';

    this.focusInput();
  }

  renderWords() {
    this.wordsContainer.innerHTML = '';
    if (this.caret) {
      this.wordsContainer.appendChild(this.caret);
    }
    this.words.forEach((word, wordIdx) => {
      const wordSpan = document.createElement('div');
      wordSpan.className = 'word';
      wordSpan.setAttribute('data-word-idx', wordIdx);

      // Render each character
      for (let i = 0; i < word.length; i++) {
        const charSpan = document.createElement('span');
        charSpan.className = 'char';
        charSpan.textContent = word[i];
        wordSpan.appendChild(charSpan);
      }

      // Add trailing space indicator for non-last words
      if (wordIdx < this.words.length - 1) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'char space-char';
        spaceSpan.textContent = ' ';
        wordSpan.appendChild(spaceSpan);
      }

      this.wordsContainer.appendChild(wordSpan);
    });
  }

  // Absolute translation caret position
  updateCaret() {
    if (this.isFinished) return;
    
    const activeWordEl = this.wordsContainer.querySelector(`.word[data-word-idx="${this.currentWordIdx}"]`);
    if (!activeWordEl) return;

    const chars = activeWordEl.querySelectorAll('.char');
    let targetEl = chars[this.currentCharIdx];

    if (!targetEl && chars.length > 0) {
      // caret is at end of current word (extra letters typed)
      targetEl = chars[chars.length - 1];
    }

    if (targetEl) {
      // Calculate top/left relative to wordsContainer
      let left = 0;
      let top = 0;
      let curr = targetEl;
      while (curr && curr !== this.wordsContainer && curr !== document.body) {
        left += curr.offsetLeft;
        top += curr.offsetTop;
        curr = curr.offsetParent;
      }

      // Adjust left if caret is after the last character of the word
      if (this.currentCharIdx >= chars.length) {
        left += targetEl.offsetWidth;
      }

      this.caret.style.left = `${left}px`;
      this.caret.style.top = `${top}px`;
      this.caret.style.height = `${targetEl.offsetHeight}px`;

      // Handle scrolling container if caretaker moves to next line
      const caretRelativeTop = top;
      
      if (caretRelativeTop > 40) {
        // Shift container upwards
        const offset = -(caretRelativeTop - 15);
        this.wordsContainer.style.transform = `translateY(${offset}px)`;
      } else {
        this.wordsContainer.style.transform = 'translateY(0px)';
      }
    }
  }

  handleInput(e) {
    if (this.isFinished) return;

    const typedVal = this.input.value;
    const activeWord = this.words[this.currentWordIdx];
    const activeWordEl = this.wordsContainer.querySelector(`.word[data-word-idx="${this.currentWordIdx}"]`);
    
    // Clear previously appended extra incorrect characters and subtract from error count
    const existingExtras = activeWordEl.querySelectorAll('.char.extra');
    this.errorChars = Math.max(0, this.errorChars - existingExtras.length);
    existingExtras.forEach(span => span.remove());

    const charSpans = activeWordEl.querySelectorAll('.char');
    const lastChar = typedVal.slice(-1);

    if (!this.isRunning) {
      this.startTimer();
    }

    if (lastChar) {
      this.keyTimestamps.push({
        time: Date.now(),
        key: lastChar
      });
    }

    // Check characters
    const maxLen = Math.max(activeWord.length, typedVal.length);
    for (let i = 0; i < maxLen; i++) {
      const typedChar = typedVal[i];

      if (i < activeWord.length) {
        const span = charSpans[i];
        const prevCorrect = span.classList.contains('correct');
        const prevError = span.classList.contains('error');

        if (typedChar === undefined) {
          // Untyped
          span.className = span.classList.contains('space-char') ? 'char space-char' : 'char';
          if (prevCorrect) this.correctChars = Math.max(0, this.correctChars - 1);
          if (prevError) this.errorChars = Math.max(0, this.errorChars - 1);
        } else if (typedChar === span.textContent) {
          // Correct match
          span.className = span.classList.contains('space-char') ? 'char space-char correct' : 'char correct';
          if (!prevCorrect) {
            this.correctChars++;
            this.totalTyped++;
          }
          if (prevError) {
            this.errorChars = Math.max(0, this.errorChars - 1);
          }
        } else {
          // Mismatch error
          span.className = span.classList.contains('space-char') ? 'char space-char error' : 'char error';
          if (prevCorrect) {
            this.correctChars = Math.max(0, this.correctChars - 1);
          }
          if (!prevError) {
            this.errorChars++;
            this.totalTyped++;
            
            // Log key error
            const rawChar = span.textContent.toLowerCase();
            this.errorKeys[rawChar] = (this.errorKeys[rawChar] || 0) + 1;
          }
        }
      } else {
        // Extra characters beyond word bounds
        if (typedChar !== undefined) {
          const span = document.createElement('span');
          span.className = 'char error extra';
          span.textContent = typedChar;
          activeWordEl.appendChild(span);
          
          this.errorChars++;
          this.totalTyped++;

          // Log key error
          const rawChar = typedChar.toLowerCase();
          this.errorKeys[rawChar] = (this.errorKeys[rawChar] || 0) + 1;
        }
      }
    }

    // Set caret index
    this.currentCharIdx = typedVal.length;
    this.updateCaret();

    // Check if word mode is finished early
    if (this.modeType === 'words' && this.currentWordIdx === this.words.length - 1 && typedVal === activeWord) {
      if (this.liveTimer) {
        this.liveTimer.textContent = `${this.words.length}/${this.words.length}`;
      }
      this.completeTest();
    }
  }

  handleKeydown(e) {
    if (this.isFinished) return;

    const typedVal = this.input.value;
    const activeWord = this.words[this.currentWordIdx];

    // Space key moves to next word
    if (e.key === ' ') {
      e.preventDefault();
      
      if (typedVal.length === 0) return; // Prevent multiple spaces

      // Highlight word styling if incomplete errors remain
      const activeWordEl = this.wordsContainer.querySelector(`.word[data-word-idx="${this.currentWordIdx}"]`);
      const hasErrors = activeWordEl.querySelectorAll('.char.error').length > 0 || typedVal.length < activeWord.length;
      
      if (hasErrors) {
        activeWordEl.classList.add('error-word');
      }

      // Add virtual typed space stats
      if (typedVal === activeWord) {
        this.correctChars++; // Space counted as correct
      }
      this.totalTyped++;

      // Move forward
      this.currentWordIdx++;
      this.currentCharIdx = 0;
      this.input.value = '';

      if (this.modeType === 'words' && this.liveTimer) {
        this.liveTimer.textContent = `${this.currentWordIdx}/${this.words.length}`;
      }

      // Check if finished (last word)
      if (this.currentWordIdx >= this.words.length) {
        this.completeTest();
      } else {
        this.updateCaret();
      }
    }

    // Support backspacing to previous word if active is empty and user pressed backspace
    if (e.key === 'Backspace' && typedVal.length === 0 && this.currentWordIdx > 0) {
      e.preventDefault();
      
      this.currentWordIdx--;
      if (this.modeType === 'words' && this.liveTimer) {
        this.liveTimer.textContent = `${this.currentWordIdx}/${this.words.length}`;
      }
      const prevWordEl = this.wordsContainer.querySelector(`.word[data-word-idx="${this.currentWordIdx}"]`);
      prevWordEl.classList.remove('error-word');

      // Recover previous value (using DOM character statuses or reconstruction)
      const prevWord = this.words[this.currentWordIdx];
      const prevChars = prevWordEl.querySelectorAll('.char');
      
      // Re-populate input value based on what was typed
      let reconstructedVal = '';
      prevChars.forEach((span) => {
        if (span.classList.contains('correct')) reconstructedVal += span.textContent;
        else if (span.classList.contains('error')) reconstructedVal += span.textContent; // standard backspace restore
      });

      this.input.value = reconstructedVal;
      this.currentCharIdx = reconstructedVal.length;
      this.updateCaret();
    }
  }

  startTimer() {
    this.isRunning = true;
    this.startTime = Date.now();
    
    this.timerInterval = setInterval(() => {
      this.timeElapsed++;

      if (this.modeType === 'time') {
        this.timeLeft--;
        if (this.liveTimer) {
          this.liveTimer.textContent = this.timeLeft;
        }

        if (this.timeLeft <= 0) {
          this.completeTest();
          return;
        }
      } else {
        // Elapsed counter for other modes
        if (this.modeType !== 'words') {
          if (this.liveTimer) {
            this.liveTimer.textContent = this.timeElapsed;
          }
        }
        
        // Dynamic refill words buffer ONLY in time mode
        if (this.currentWordIdx > this.words.length - 10 && this.modeType === 'time') {
          this.bufferMoreWords();
        }
      }

      // Record real-time history stats
      const stats = this.getCurrentStats();
      if (this.liveWpm) {
        this.liveWpm.textContent = Math.round(stats.wpm);
      }
      if (this.liveAcc) {
        this.liveAcc.textContent = `${Math.round(stats.accuracy)}%`;
      }

      this.history.push({
        time: this.timeElapsed,
        wpm: stats.wpm,
        acc: stats.accuracy
      });
    }, 1000);
  }

  bufferMoreWords() {
    const temp = [];
    for (let i = 0; i < 40; i++) {
      temp.push(CORE_WORD_POOL[Math.floor(Math.random() * CORE_WORD_POOL.length)]);
    }
    this.words = [...this.words, ...temp];
    
    // Append spans in DOM
    const currentLength = this.words.length - temp.length;
    temp.forEach((word, idx) => {
      const wordIdx = currentLength + idx;
      const wordSpan = document.createElement('div');
      wordSpan.className = 'word';
      wordSpan.setAttribute('data-word-idx', wordIdx);

      for (let i = 0; i < word.length; i++) {
        const charSpan = document.createElement('span');
        charSpan.className = 'char';
        charSpan.textContent = word[i];
        wordSpan.appendChild(charSpan);
      }

      const spaceSpan = document.createElement('span');
      spaceSpan.className = 'char space-char';
      spaceSpan.textContent = ' ';
      wordSpan.appendChild(spaceSpan);

      this.wordsContainer.appendChild(wordSpan);
    });
  }

  getCurrentStats() {
    const elapsedMins = Math.max(this.timeElapsed, 1) / 60;
    // WPM Formula: (correct_chars / 5) / time_mins
    const wpm = (this.correctChars / 5) / elapsedMins;
    const rawWpm = (this.totalTyped / 5) / elapsedMins;
    
    const accuracy = this.totalTyped > 0 ? (this.correctChars / this.totalTyped) * 100 : 100;

    return {
      wpm: Math.max(0, wpm),
      rawWpm: Math.max(0, rawWpm),
      accuracy: Math.min(100, Math.max(0, accuracy))
    };
  }

  calculateConsistency() {
    if (this.history.length < 2) return 80; // Baseline default
    
    // Consistency is calculated as variance between second-by-second WPMs.
    // Higher variance -> lower consistency.
    const wpms = this.history.map(h => h.wpm);
    const mean = wpms.reduce((a, b) => a + b, 0) / wpms.length;
    const sqDiffs = wpms.map(w => Math.pow(w - mean, 2));
    const variance = sqDiffs.reduce((a, b) => a + b, 0) / sqDiffs.length;
    const stdDev = Math.sqrt(variance);

    // Consistency score map (0-100)
    let score = Math.round(100 - (stdDev / Math.max(mean, 20)) * 100);
    return Math.max(10, Math.min(100, score));
  }

  calculateWeakKeys() {
    // Sort errors keys
    const sorted = Object.entries(this.errorKeys)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => ({
        key: entry[0],
        errors: entry[1]
      }));

    return sorted;
  }

  completeTest() {
    clearInterval(this.timerInterval);
    this.isFinished = true;
    this.isRunning = false;
    this.input.blur();

    const stats = this.getCurrentStats();
    const duration = this.timeElapsed || 1;
    const consistency = this.calculateConsistency();
    const weakKeys = this.calculateWeakKeys();

    const results = {
      modeType: this.modeType,
      modeVal: this.modeVal,
      wpm: Math.round(stats.wpm * 10) / 10,
      rawWpm: Math.round(stats.rawWpm * 10) / 10,
      accuracy: Math.round(stats.accuracy * 10) / 10,
      errors: this.errorChars,
      consistency,
      duration,
      history: this.history,
      errorKeys: this.errorKeys,
      weakKeys
    };

    this.onComplete(results);
  }
}
