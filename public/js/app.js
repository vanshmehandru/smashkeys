import { themes } from './themes.js';
import { TypingEngine } from './engine.js';
import { renderAnalyticsChart, renderKeyboardHeatmap } from './charts.js';
import * as api from './api.js';
import * as mpClient from './multiplayer.js';

// ----------------------------------------------------
// GLOBAL APPLICATION STATE
// ----------------------------------------------------
let state = {
  activeView: 'typing',
  currentUser: null,
  settings: {
    theme: 'nord',
    caret: 'line',
    fontSize: '1.25rem',
    font: "'Fira Code', monospace",
    soundType: 'mechanical',
    soundVolume: 0.5,
    layout: 'qwerty'
  }
};

let mainEngine = null;
let mpEngine = null;
let totalMpChars = 0;

// Toast Banner helper
function showToast(message, isError = false) {
  const toast = document.getElementById('toast-banner');
  if (!toast) return;
  toast.textContent = message;
  toast.style.borderColor = isError ? 'var(--error-color)' : 'var(--accent-color)';
  toast.style.boxShadow = isError ? '0 0 15px rgba(255, 59, 59, 0.4)' : '0 0 15px var(--accent-glow)';
  
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  loadLocalSettings();
  initRouter();
  initSettingsUI();
  initAuthEvents();
  initMultiplayerEvents();

  // Initialize Typing Engine
  mainEngine = new TypingEngine({
    wordsContainerId: 'words-box',
    caretId: 'typing-caret',
    inputId: 'typing-input',
    onComplete: (results) => handleTestComplete(results)
  });

  // Apply default settings to main engine
  mainEngine.configure(state.settings);
  mainEngine.setSource('time', '30');

  // Verify Session if token exists
  if (api.hasToken()) {
    try {
      const user = await api.getMe();
      handleUserLoggedIn(user);
    } catch (err) {
      console.warn('Session verification failed, logging out.');
      api.setToken(null);
    }
  }

  // Generate the default options value buttons
  renderModeValues('time');

  // Watch for escape key globally to restart typing tests
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.activeView === 'typing') {
        e.preventDefault();
        mainEngine.reset();
        mainEngine.setSource(mainEngine.modeType, mainEngine.modeVal);
      }
    }
  });
});

// ----------------------------------------------------
// SETTINGS & LOCAL STORAGE MANAGEMENT
// ----------------------------------------------------
function loadLocalSettings() {
  const local = localStorage.getItem('settings');
  if (local) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(local) };
    } catch (err) {
      console.error('Error reading settings from localStorage:', err);
    }
  }
  applyTheme(state.settings.theme);
}

function saveLocalSettings() {
  localStorage.setItem('settings', JSON.stringify(state.settings));
  applyTheme(state.settings.theme);
  
  if (mainEngine) mainEngine.configure(state.settings);
  if (mpEngine) mpEngine.configure(state.settings);

  // Sync to database if logged in
  if (state.currentUser) {
    api.saveSettings(state.settings).catch(err => console.error('Error saving settings to db:', err));
  }
}

function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  const footerTheme = document.getElementById('footer-theme-name');
  if (footerTheme) {
    footerTheme.textContent = themeId;
  }
}

// ----------------------------------------------------
// NAVIGATION & ROUTING
// ----------------------------------------------------
function initRouter() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      navigateTo(targetView);
    });
  });

  // Logo home navigation
  document.getElementById('nav-logo').addEventListener('click', () => navigateTo('typing'));
}

function navigateTo(viewId) {
  state.activeView = viewId;

  const footer = document.querySelector('.site-footer');
  if (footer) footer.classList.remove('hidden');
  const controlPanel = document.querySelector('.control-panel');
  if (controlPanel) controlPanel.classList.remove('hidden');

  // Toggle nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle view sections
  document.querySelectorAll('.view-section').forEach(section => {
    if (section.id === `${viewId}-view`) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  // Trigger view entry hooks
  if (viewId === 'typing') {
    if (mainEngine) {
      mainEngine.reset();
      mainEngine.setSource(mainEngine.modeType, mainEngine.modeVal);
    }
  } else if (viewId === 'leaderboard') {
    loadLeaderboard();
  } else if (viewId === 'profile') {
    loadProfileDashboard();
  } else {
    // If leaving multiplayer race room, disconnect socket
    if (viewId !== 'multiplayer') {
      mpClient.disconnect();
    }
  }
}

// ----------------------------------------------------
// AUTHENTICATION LOGIC
// ----------------------------------------------------
function initAuthEvents() {
  const authModal = document.getElementById('auth-modal');
  const btnLoginOpen = document.getElementById('btn-login-open');
  const btnAuthClose = document.getElementById('btn-auth-close');
  const btnSwitchSignup = document.getElementById('btn-switch-signup');
  const btnSwitchLogin = document.getElementById('btn-switch-login');

  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');

  // Open modal
  btnLoginOpen.addEventListener('click', () => {
    authModal.style.display = 'flex';
    showAuthSubView('login');
  });

  // Close modal
  btnAuthClose.addEventListener('click', () => {
    authModal.style.display = 'none';
  });

  // Switch form sub-views
  btnSwitchSignup.addEventListener('click', () => showAuthSubView('signup'));
  btnSwitchLogin.addEventListener('click', () => showAuthSubView('login'));

  // Submit Login
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorBanner = document.getElementById('login-error');

    try {
      errorBanner.style.display = 'none';
      const response = await api.login(email, password);
      
      // Fetch user profile
      const user = await api.getMe();
      handleUserLoggedIn(user);
      
      authModal.style.display = 'none';
      formLogin.reset();
      showToast(`Welcome back, ${user.username}!`);
    } catch (err) {
      errorBanner.style.display = 'block';
      errorBanner.textContent = err.message;
    }
  });

  // Submit Signup
  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const errorBanner = document.getElementById('signup-error');

    try {
      errorBanner.style.display = 'none';
      const response = await api.register(username, email, password);
      
      const user = await api.getMe();
      handleUserLoggedIn(user);
      
      authModal.style.display = 'none';
      formSignup.reset();
      showToast(`Profile successfully initialized!`);
    } catch (err) {
      errorBanner.style.display = 'block';
      errorBanner.textContent = err.message;
    }
  });

  // Logout Click
  document.getElementById('btn-logout').addEventListener('click', () => {
    api.setToken(null);
    state.currentUser = null;

    document.getElementById('guest-panel').style.display = 'block';
    document.getElementById('auth-panel').style.display = 'none';

    
    showToast('Logged out of system.');
    navigateTo('typing');
  });
}

function showAuthSubView(view) {
  document.getElementById('auth-view-login').style.display = view === 'login' ? 'block' : 'none';
  document.getElementById('auth-view-signup').style.display = view === 'signup' ? 'block' : 'none';
}

function handleUserLoggedIn(user) {
  state.currentUser = user;
  
  // Sync DB settings if available
  if (user.settings) {
    state.settings = { ...state.settings, ...user.settings };
    saveLocalSettings();
  }

  // Update panels
  document.getElementById('guest-panel').style.display = 'none';
  const authPanel = document.getElementById('auth-panel');
  authPanel.style.display = 'flex';
  
  document.getElementById('display-username').textContent = user.username;
  document.getElementById('display-level').textContent = user.level;

  // Profile icon click
  const profileIcon = document.getElementById('btn-profile-icon');
  if (profileIcon) {
    profileIcon.addEventListener('click', () => navigateTo('profile'));
  }
}

// ----------------------------------------------------
// SETTINGS VIEWS BINDINGS
// ----------------------------------------------------
function initSettingsUI() {
  const themeGrid = document.getElementById('theme-selector-grid');
  const fontSelect = document.getElementById('settings-font');
  const fontSizeSelect = document.getElementById('settings-font-size');
  const caretSelect = document.getElementById('settings-caret-style');
  const soundSelect = document.getElementById('settings-sound-type');
  const volumeSlider = document.getElementById('settings-sound-volume');
  const layoutSelect = document.getElementById('settings-layout');

  // Populate active selection states
  if (fontSelect) fontSelect.value = state.settings.font;
  if (fontSizeSelect) fontSizeSelect.value = state.settings.fontSize;
  if (caretSelect) caretSelect.value = state.settings.caret;
  if (soundSelect) soundSelect.value = state.settings.soundType;
  if (volumeSlider) volumeSlider.value = state.settings.soundVolume;
  if (layoutSelect) layoutSelect.value = state.settings.layout;

  // Render Theme Selector Grid
  themeGrid.innerHTML = '';
  themes.forEach(theme => {
    const btn = document.createElement('button');
    btn.className = `theme-opt-btn ${state.settings.theme === theme.id ? 'active' : ''}`;
    btn.setAttribute('data-theme-id', theme.id);

    const title = document.createElement('span');
    title.className = 'theme-title';
    title.textContent = theme.name;

    const palette = document.createElement('div');
    palette.className = 'palette-dots';
    theme.colors.forEach(col => {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.backgroundColor = col;
      palette.appendChild(dot);
    });

    btn.appendChild(title);
    btn.appendChild(palette);
    
    btn.addEventListener('click', () => {
      themeGrid.querySelectorAll('.theme-opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.settings.theme = theme.id;
      saveLocalSettings();
    });

    themeGrid.appendChild(btn);
  });

  // Customizer listeners
  if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
      state.settings.font = e.target.value;
      saveLocalSettings();
    });
  }
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', (e) => {
      state.settings.fontSize = e.target.value;
      saveLocalSettings();
    });
  }
  if (caretSelect) {
    caretSelect.addEventListener('change', (e) => {
      state.settings.caret = e.target.value;
      saveLocalSettings();
    });
  }
  if (soundSelect) {
    soundSelect.addEventListener('change', (e) => {
      state.settings.soundType = e.target.value;
      saveLocalSettings();
    });
  }
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      state.settings.soundVolume = parseFloat(e.target.value);
      saveLocalSettings();
    });
  }
  if (layoutSelect) {
    layoutSelect.addEventListener('change', (e) => {
      state.settings.layout = e.target.value;
      saveLocalSettings();
      renderKeyboardHeatmap('settings-keyboard-preview', {}, state.settings.layout);
    });
    // Initial render for settings preview
    renderKeyboardHeatmap('settings-keyboard-preview', {}, state.settings.layout);
  }
}

// ----------------------------------------------------
// TYPING TEST MANAGEMENT
// ----------------------------------------------------
const modeSelector = document.getElementById('mode-selector');
const modeValues = document.getElementById('mode-values');

modeSelector.querySelectorAll('.control-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    modeSelector.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const mode = btn.getAttribute('data-mode');
    renderModeValues(mode);
  });
});

function renderModeValues(mode) {
  modeValues.innerHTML = '';
  
  let values = [];
  let defaultVal = '';
  
  if (mode === 'time') {
    values = ['15', '30', '60', '120'];
    defaultVal = '30';
  } else if (mode === 'words') {
    values = ['10', '25', '50', '100'];
    defaultVal = '25';
  } else if (mode === 'custom') {
    // Inject small input box for typing customized words
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Paste custom text here...';
    input.className = 'glass custom-text-input';
    input.style.padding = '0.3rem 0.8rem';
    input.style.color = 'var(--text-main)';
    input.style.border = '1px solid var(--border-color)';
    input.style.borderRadius = '6px';
    
    input.addEventListener('change', () => {
      mainEngine.setSource('custom', input.value);
    });

    modeValues.appendChild(input);
    mainEngine.setSource('custom', '');
    return;
  } else if (mode === 'code') {
    const btn = document.createElement('button');
    btn.className = 'control-btn active';
    btn.textContent = 'random snippet';
    modeValues.appendChild(btn);
    
    mainEngine.setSource('code', 'random');
    return;
  }

  values.forEach(val => {
    const btn = document.createElement('button');
    btn.className = `control-btn ${val === defaultVal ? 'active' : ''}`;
    btn.textContent = val + (mode === 'time' ? 's' : '');
    
    btn.addEventListener('click', () => {
      modeValues.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mainEngine.setSource(mode, val);
    });
    
    modeValues.appendChild(btn);
  });

  mainEngine.setSource(mode, defaultVal);
}

// Stats Restart Click
document.getElementById('btn-stats-restart').addEventListener('click', () => {
  navigateTo('typing');
});

// Test Completion Handler
async function handleTestComplete(results) {
  // Switch to stats view
  navigateTo('stats');

  // Render metrics
  document.getElementById('stats-wpm').textContent = results.wpm.toFixed(1);
  document.getElementById('stats-acc').textContent = `${results.accuracy.toFixed(1)}%`;
  document.getElementById('stats-raw').textContent = results.rawWpm.toFixed(1);
  document.getElementById('stats-consistency').textContent = `${results.consistency}%`;

  // Draw chart
  renderAnalyticsChart('stats-chart-box', results.history);

  // Render heatmap
  renderKeyboardHeatmap('keyboard-heatmap', results.errorKeys, state.settings.layout);

  // Render Weak keys list
  const weakList = document.getElementById('weak-keys-list');
  weakList.innerHTML = '';
  if (results.weakKeys.length === 0) {
    weakList.innerHTML = `<li>No errors recorded. Excellent precision!</li>`;
  } else {
    results.weakKeys.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `Key <span class="key-badge">${item.key.toUpperCase()}</span> <span>${item.errors} errors</span>`;
      weakList.appendChild(li);
    });
  }

  // Handle XP / leveling storage
  const xpGainedSpan = document.getElementById('stats-xp-gained');
  const levelFill = document.getElementById('stats-level-fill');
  const currentLevelSpan = document.getElementById('stats-current-level');
  const streakDisplay = document.getElementById('stats-streak-display');

  if (state.currentUser) {
    try {
      xpGainedSpan.textContent = 'Saving stats...';
      const saveResponse = await api.saveSession({
        modeType: results.modeType,
        modeVal: results.modeVal,
        wpm: results.wpm,
        rawWpm: results.rawWpm,
        accuracy: results.accuracy,
        errors: results.errors,
        consistency: results.consistency,
        duration: results.duration
      });

      // Update XP bar
      xpGainedSpan.textContent = `+${saveResponse.xpEarned} XP`;
      
      const xpNeeded = saveResponse.currentLevel * 200; // quadratic level cap
      const xpInThisLevel = saveResponse.currentXp % xpNeeded;
      const progressPercent = (xpInThisLevel / xpNeeded) * 100;
      
      levelFill.style.width = `${progressPercent}%`;
      currentLevelSpan.textContent = saveResponse.currentLevel;
      streakDisplay.textContent = `🔥 ${saveResponse.streak} Day Streak`;

      // Update Header level
      document.getElementById('display-level').textContent = saveResponse.currentLevel;
      state.currentUser.level = saveResponse.currentLevel;
      state.currentUser.xp = saveResponse.currentXp;

      if (saveResponse.leveledUp) {
        showToast(`LEVEL UP! You reached level ${saveResponse.currentLevel}! 🚀`);
      }
      if (saveResponse.unlockedAchievements && saveResponse.unlockedAchievements.length > 0) {
        saveResponse.unlockedAchievements.forEach(ach => {
          showToast(`Achievement unlocked: ${ach.replace(/_/g, ' ').toUpperCase()}! 🏆`);
        });
      }
    } catch (err) {
      console.error(err);
      xpGainedSpan.textContent = 'Failed to save stats to server';
    }
  } else {
    // Guest Mode
    xpGainedSpan.textContent = '+0 XP (Guest Mode)';
    levelFill.style.width = '0%';
    currentLevelSpan.textContent = '1';
    streakDisplay.textContent = '🔥 Register to track streaks';
  }
}

// ----------------------------------------------------
// MULTIPLAYER MANAGEMENT
// ----------------------------------------------------
function initMultiplayerEvents() {
  const welcomeBox = document.getElementById('multiplayer-welcome');
  const lobbyBox = document.getElementById('multiplayer-lobby');
  const arenaBox = document.getElementById('multiplayer-arena');
  const resultsBox = document.getElementById('multiplayer-results');

  const btnCreate = document.getElementById('btn-mp-create');
  const btnJoin = document.getElementById('btn-mp-join');
  const btnLeave = document.getElementById('btn-lobby-start');
  const btnQuit = document.getElementById('btn-lobby-leave');
  const btnReturn = document.getElementById('btn-mp-results-return');

  // Host Room
  btnCreate.addEventListener('click', async () => {
    const name = state.currentUser ? state.currentUser.username : `Guest_${Math.floor(Math.random() * 900 + 100)}`;
    const uid = state.currentUser ? state.currentUser._id : null;
    
    try {
      await mpClient.connectSocket((evt) => handleMpEvents(evt, name));
      mpClient.createRoom(name, uid);
    } catch (err) {
      showToast(err.message || 'Failed to connect to server.', true);
    }
  });

  // Join Room
  btnJoin.addEventListener('click', async () => {
    const code = document.getElementById('mp-room-code').value.trim();
    if (!code) {
      showToast('Please enter a valid room code.', true);
      return;
    }
    const name = state.currentUser ? state.currentUser.username : `Guest_${Math.floor(Math.random() * 900 + 100)}`;
    const uid = state.currentUser ? state.currentUser._id : null;

    try {
      await mpClient.connectSocket((evt) => handleMpEvents(evt, name));
      mpClient.joinRoom(code, name, uid);
    } catch (err) {
      showToast(err.message || 'Failed to connect to server.', true);
    }
  });

  // Host Start Match
  btnLeave.addEventListener('click', () => {
    mpClient.triggerRaceStart();
  });

  // Leave room lobby
  btnQuit.addEventListener('click', () => {
    mpClient.disconnect();
    showMultiplayerSubView('welcome');
  });

  // Return from results (Play Again)
  btnReturn.addEventListener('click', () => {
    showMultiplayerSubView('lobby');
  });
}

function showMultiplayerSubView(sub) {
  document.getElementById('multiplayer-welcome').style.display = sub === 'welcome' ? 'block' : 'none';
  document.getElementById('multiplayer-lobby').style.display = sub === 'lobby' ? 'block' : 'none';
  document.getElementById('multiplayer-arena').style.display = sub === 'arena' ? 'block' : 'none';
  document.getElementById('multiplayer-results').style.display = sub === 'results' ? 'block' : 'none';
}

function handleMpEvents(evt, clientName) {
  switch (evt.type) {
    case 'error':
      showToast(evt.message, true);
      mpClient.disconnect();
      showMultiplayerSubView('welcome');
      break;

    case 'room_joined':
      showMultiplayerSubView('lobby');
      document.getElementById('lobby-code-display').textContent = evt.roomId;
      updateLobbyUI(evt.players, evt.isHost);
      break;

    case 'room_update':
      updateLobbyUI(evt.players, evt.isHost);
      if (evt.leftUser) {
        showToast(`${evt.leftUser} left the room.`);
      }
      break;
      
    case 'host_update':
      showToast(`${evt.hostName} is now the host.`);
      updateLobbyUI(null, evt.isHost);
      break;

    case 'countdown':
      showMultiplayerSubView('arena');
      const countdownOverlay = document.getElementById('mp-countdown-overlay');
      const countdownNumber = document.getElementById('mp-countdown-number');
      
      countdownOverlay.style.display = 'flex';
      countdownNumber.textContent = evt.value;
      
      // Initialize shared typing block in engine background
      totalMpChars = evt.text.length;
      setupMpTypingEngine(evt.text);
      break;

    case 'race_start':
      document.getElementById('mp-countdown-overlay').style.display = 'none';
      if (mpEngine) {
        mpEngine.focusInput();
      }
      break;

    case 'progress_update':
      mpClient.renderOpponentTracks('mp-racing-tracks', evt.players, clientName);
      break;

    case 'your_rank':
      showToast(`Race finished! You ranked #${evt.rank}! 🏁`);
      break;

    case 'race_finished':
      showMultiplayerSubView('results');
      mpClient.renderPodium('mp-podium-display', evt.results);
      
      // Fill results table
      const tbody = document.getElementById('mp-results-table-body');
      tbody.innerHTML = '';
      evt.results.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><span class="rank-badge">${p.rank}</span></td>
          <td><i class="fa-solid fa-user" style="font-size: 0.85em; opacity: 0.75; margin-right: 0.35rem;"></i>${p.username}</td>
          <td>${Math.round(p.wpm)}</td>
          <td>${Math.round(p.accuracy)}%</td>
        `;
        tbody.appendChild(row);
      });
      break;
  }
}

function updateLobbyUI(players, isClientHost) {
  const hostBtn = document.getElementById('btn-lobby-start');
  hostBtn.style.display = isClientHost ? 'block' : 'none';

  if (players) {
    document.getElementById('lobby-count').textContent = players.length;
    const grid = document.getElementById('lobby-players-grid');
    grid.innerHTML = '';
    
    players.forEach((player, idx) => {
      const card = document.createElement('div');
      card.className = `player-card ${idx === 0 ? 'host-player' : ''}`;
      
      const avatar = document.createElement('div');
      avatar.className = 'player-avatar';
      avatar.textContent = idx === 0 ? '👑' : '👾';
      
      const details = document.createElement('div');
      details.className = 'player-details';
      
      const name = document.createElement('h4');
      name.textContent = player.username;
      
      details.appendChild(name);
      if (idx === 0) {
        const hostTag = document.createElement('span');
        hostTag.className = 'host-badge';
        hostTag.textContent = 'Host';
        details.appendChild(hostTag);
      }
      
      card.appendChild(avatar);
      card.appendChild(details);
      grid.appendChild(card);
    });
  }
}

function setupMpTypingEngine(sharedText) {
  // Only create the WS engine if it doesn't exist
  if (!mpEngine) {
    mpEngine = new TypingEngine({
      wordsContainerId: 'mp-words-box',
      caretId: 'mp-typing-caret',
      inputId: 'mp-typing-input',
      onComplete: (results) => {
        mpClient.sendFinish(results.wpm, results.accuracy);
      }
    });

    // Attach dynamic progress monitoring on input
    mpEngine.input.addEventListener('input', () => {
      const totalChars = sharedText.length;
      // progress is defined as (typedChars / totalChars)
      const progress = Math.min(1.0, mpEngine.correctChars / totalChars);
      const stats = mpEngine.getCurrentStats();
      mpClient.sendProgress(progress, stats.wpm, stats.accuracy);
    });
  } else {
    mpEngine.reset();
  }

  mpEngine.configure(state.settings);
  mpEngine.modeType = 'custom';
  mpEngine.words = sharedText.split(' ');
  mpEngine.renderWords();
  mpEngine.updateCaret();


}

// ----------------------------------------------------
// LEADERBOARD RENDERER
// ----------------------------------------------------
const lModeType = document.getElementById('leaderboard-mode-type');
const lModeVal = document.getElementById('leaderboard-mode-val');

lModeType.addEventListener('change', () => {
  updateLeaderboardFilterValues();
  loadLeaderboard();
});
lModeVal.addEventListener('change', loadLeaderboard);

function updateLeaderboardFilterValues() {
  const type = lModeType.value;
  lModeVal.innerHTML = '';
  let values = [];
  if (type === 'time') {
    values = ['15', '30', '60', '120'];
  } else {
    values = ['10', '25', '50', '100'];
  }
  
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = `${v} ${type === 'time' ? 'seconds' : 'words'}`;
    if (v === '30' || v === '25') opt.selected = true;
    lModeVal.appendChild(opt);
  });
}

async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboard-table-body');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Syncing rankings...</td></tr>`;

  try {
    const rankings = await api.getLeaderboard(lModeType.value, lModeVal.value);
    tbody.innerHTML = '';
    
    if (rankings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No records found. Be the first to type!</td></tr>`;
      return;
    }

    rankings.forEach((rank, index) => {
      const row = document.createElement('tr');
      const rankClass = index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : index === 2 ? 'rank-bronze' : '';
      
      row.innerHTML = `
        <td><span class="${rankClass}">${index + 1}</span></td>
        <td><strong style="display: inline-flex; align-items: center; gap: 0.35rem;"><i class="fa-solid fa-user" style="font-size: 0.8em; opacity: 0.75;"></i> ${rank.username}</strong> <span class="text-muted" style="font-size: 0.75rem;">(Lvl ${rank.level})</span></td>
        <td class="highlight">${Math.round(rank.wpm)} WPM</td>
        <td>${Math.round(rank.accuracy)}%</td>
        <td>${Math.round(rank.consistency)}%</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--error-color);">Error fetching rankings</td></tr>`;
  }
}

// ----------------------------------------------------
// PROFILE DASHBOARD RENDERER
// ----------------------------------------------------
async function loadProfileDashboard() {
  if (!state.currentUser) return;

  try {
    const data = await api.getUserProfile(state.currentUser.username);
    const u = data.user;
    
    document.getElementById('profile-username').textContent = u.username;
    document.getElementById('profile-email').textContent = u.email;
    document.getElementById('profile-joined').textContent = `Registered: ${new Date(u.createdAt).toLocaleDateString()}`;
    
    document.getElementById('profile-level-num').textContent = u.level;
    document.getElementById('profile-streak-count').textContent = u.streak;

    // XP progress maths
    const xpNeeded = u.level * 200;
    const xpInThisLevel = u.xp % xpNeeded;
    const percent = (xpInThisLevel / xpNeeded) * 100;
    document.getElementById('profile-current-xp').textContent = xpInThisLevel;
    document.getElementById('profile-needed-xp').textContent = xpNeeded;
    document.getElementById('profile-xp-fill').style.width = `${percent}%`;

    // Overall stats card
    document.getElementById('profile-top-wpm').textContent = data.stats.maxWpm.toFixed(1);
    document.getElementById('profile-avg-wpm').textContent = data.stats.avgWpm.toFixed(1);
    document.getElementById('profile-avg-acc').textContent = `${data.stats.avgAccuracy.toFixed(1)}%`;
    document.getElementById('profile-total-tests').textContent = data.stats.totalTests;

    // Render Achievements Badges
    const achGrid = document.getElementById('profile-achievements-grid');
    achGrid.innerHTML = '';

    const badges = [
      { id: 'speed_demon_80', title: 'Speed Demon', desc: 'Reach 80+ WPM speed limit', icon: '⚡' },
      { id: 'keyboard_warrior_100', title: 'Cyber Warrior', desc: 'Reach 100+ WPM speed limit', icon: '⚔' },
      { id: 'perfectionist', title: 'Perfectionist', desc: '100% accuracy on a 30s+ test', icon: '🎯' },
      { id: 'marathoner_120', title: 'Marathoner', desc: 'Complete a 120s test duration', icon: '🏃' },
      { id: 'streaker_5', title: 'Persistent', desc: 'Reach a 5+ day streak', icon: '🔥' },
      { id: 'multiplayer_champion', title: 'Gladiator', desc: 'Win a multiplayer racing track', icon: '👑' }
    ];

    const unlockedTypes = u.achievements.map(a => a.achievementType);

    badges.forEach(badge => {
      const isUnlocked = unlockedTypes.includes(badge.id);
      const div = document.createElement('div');
      div.className = `achievement-badge ${isUnlocked ? 'unlocked' : ''}`;
      
      div.innerHTML = `
        <div class="badge-icon">${badge.icon}</div>
        <div class="badge-details">
          <h4>${badge.title}</h4>
          <p>${badge.desc}</p>
        </div>
      `;
      achGrid.appendChild(div);
    });

    // Render Recent Sessions history
    const tbody = document.getElementById('profile-history-body');
    tbody.innerHTML = '';
    if (data.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No history logs recorded yet...</td></tr>`;
      return;
    }

    data.history.forEach(session => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(session.createdAt).toLocaleDateString()}</td>
        <td>${session.modeType} (${session.modeVal}${session.modeType === 'time' ? 's' : ''})</td>
        <td class="highlight">${Math.round(session.wpm)} WPM</td>
        <td>${Math.round(session.accuracy)}%</td>
        <td>${Math.round(session.consistency)}%</td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error(err);
    showToast('Failed to load profile statistics.', true);
  }
}
