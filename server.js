require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Session, Match } = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smashkeys_cyber_jwt_secret_9988';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
};

// Word Corpus for Multiplayer Room generation
const MULTIPLAYER_WORD_POOL = [
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
  "promise", "async", "await", "import", "export", "class", "const", "let", "return", "document", "window", "console"
];

function generateMultiplayerWords(count = 40) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * MULTIPLAYER_WORD_POOL.length);
    result.push(MULTIPLAYER_WORD_POOL[randomIndex]);
  }
  return result.join(' ');
}

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const usernameExists = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
    if (usernameExists) return res.status(400).json({ error: 'Username is already taken' });

    const emailExists = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (emailExists) return res.status(400).json({ error: 'Email is already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, email, passwordHash });
    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: user.username, settings: user.settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, settings: user.settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save settings configuration
app.post('/api/auth/settings', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.settings = { ...user.settings, ...req.body };
    await user.save();
    res.json({ message: 'Settings saved successfully', settings: user.settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error saving settings' });
  }
});

// Get user profile stats & history
app.get('/api/users/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: new RegExp(`^${req.params.username}$`, 'i') }).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sessions = await Session.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100);
    
    // Aggregate overall statistics
    const statsResult = await Session.aggregate([
      { $match: { userId: user._id } },
      { $group: {
          _id: null,
          avgWpm: { $avg: "$wpm" },
          maxWpm: { $max: "$wpm" },
          avgAccuracy: { $avg: "$accuracy" },
          totalTests: { $sum: 1 },
          totalDuration: { $sum: "$duration" }
        }
      }
    ]);

    const stats = statsResult[0] || { avgWpm: 0, maxWpm: 0, avgAccuracy: 0, totalTests: 0, totalDuration: 0 };

    res.json({
      user,
      stats: {
        avgWpm: Math.round(stats.avgWpm * 10) / 10,
        maxWpm: Math.round(stats.maxWpm * 10) / 10,
        avgAccuracy: Math.round(stats.avgAccuracy * 10) / 10,
        totalTests: stats.totalTests,
        totalDuration: Math.round(stats.totalDuration)
      },
      history: sessions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching profile stats' });
  }
});

// Save typing session stats
app.post('/api/stats/save', authenticateToken, async (req, res) => {
  try {
    const { modeType, modeVal, wpm, rawWpm, accuracy, errors, consistency, duration } = req.body;
    const userId = req.user.id;

    const session = new Session({
      userId, modeType, modeVal, wpm, rawWpm, accuracy, errorCount: errors, consistency, duration
    });
    await session.save();

    // Reward XP
    // XP Formula: WPM * (Accuracy/100) * (Duration/10)
    // Minimally award 5 XP for small tests, up to 100 XP
    let xpEarned = Math.round(wpm * (accuracy / 100) * (duration / 15));
    if (xpEarned < 5) xpEarned = 5;
    if (xpEarned > 150) xpEarned = 150;

    const user = await User.findById(userId);
    user.xp += xpEarned;

    // Level formula: Level = floor(sqrt(xp / 100)) + 1
    const newLevel = Math.floor(Math.sqrt(user.xp / 100)) + 1;
    let leveledUp = false;
    if (newLevel > user.level) {
      user.level = newLevel;
      leveledUp = true;
    }

    // Streaks calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastActiveDate = new Date(user.lastActive);
    lastActiveDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(today - lastActiveDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      user.streak += 1;
    } else if (diffDays > 1) {
      user.streak = 1; // Reset streak
    } else if (user.streak === 0) {
      user.streak = 1;
    }
    user.lastActive = new Date();

    // Achievement System checks
    const unlockedAchievements = [];
    const existingAchievements = user.achievements.map(a => a.achievementType);

    const checkAndUnlock = (type) => {
      if (!existingAchievements.includes(type)) {
        user.achievements.push({ achievementType: type });
        unlockedAchievements.push(type);
      }
    };

    if (wpm >= 80) checkAndUnlock('speed_demon_80');
    if (wpm >= 100) checkAndUnlock('keyboard_warrior_100');
    if (accuracy === 100 && duration >= 30) checkAndUnlock('perfectionist');
    if (duration >= 120) checkAndUnlock('marathoner_120');
    if (user.streak >= 5) checkAndUnlock('streaker_5');

    // Night owl check (hour between 0 and 4)
    const hour = new Date().getHours();
    if (hour >= 0 && hour <= 4) checkAndUnlock('night_owl');

    await user.save();

    res.status(201).json({
      session,
      xpEarned,
      currentXp: user.xp,
      currentLevel: user.level,
      streak: user.streak,
      leveledUp,
      unlockedAchievements
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error saving session' });
  }
});

// Leaderboard query
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { modeType, modeVal } = req.query;
    const filter = {};
    if (modeType) filter.modeType = modeType;
    if (modeVal) filter.modeVal = modeVal;

    // Aggregation to find personal bests for each user
    const pbList = await Session.aggregate([
      { $match: filter },
      { $sort: { wpm: -1 } },
      { $group: {
          _id: "$userId",
          topWpm: { $first: "$wpm" },
          accuracy: { $first: "$accuracy" },
          consistency: { $first: "$consistency" },
          createdAt: { $first: "$createdAt" },
          sessionId: { $first: "$_id" }
        }
      },
      { $sort: { topWpm: -1 } },
      { $limit: 25 },
      { $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },
      { $project: {
          username: "$userInfo.username",
          level: "$userInfo.level",
          wpm: "$topWpm",
          accuracy: 1,
          consistency: 1,
          createdAt: 1
        }
      }
    ]);

    res.json(pbList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error loading leaderboard' });
  }
});

// Wildcard routing to send SPA app on client refreshes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------------------------------------------
// MULTIPLAYER WEBSOCKET SYSTEM
// ----------------------------------------------------
// Map: roomId -> { host, players: [{ ws, userId, username, wpm, accuracy, progress, finished }], status, text }
const rooms = new Map();

// Helper to generate a unique room ID
function generateRoomId() {
  let id = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

wss.on('connection', (ws) => {
  console.log('[WebSocket Server] Client connection handshaked and established successfully!');
  
  let currentRoomId = null;
  let clientUsername = null;
  let clientUserId = null;

  ws.on('error', (err) => {
    console.error('[WebSocket Server] Error on client socket:', err);
  });

  // Send message helper
  const sendJSON = (obj) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  };

  // Broadcast to room helper
  const broadcastToRoom = (roomId, obj) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = JSON.stringify(obj);
    room.players.forEach(p => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(msg);
      }
    });
  };

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'ping': {
          sendJSON({ type: 'pong' });
          break;
        }

        case 'create_room': {
          const roomId = generateRoomId();
          clientUsername = data.username || 'Guest';
          clientUserId = data.userId || null;
          currentRoomId = roomId;

          const newRoom = {
            host: ws,
            players: [{
              ws,
              userId: clientUserId,
              username: clientUsername,
              wpm: 0,
              accuracy: 100,
              progress: 0,
              finished: false
            }],
            status: 'lobby',
            text: generateMultiplayerWords(35)
          };

          rooms.set(roomId, newRoom);
          sendJSON({ type: 'room_created', roomId, players: [{ username: clientUsername, progress: 0, finished: false }], text: newRoom.text });
          break;
        }

        case 'join_room': {
          const roomId = data.roomId ? data.roomId.toUpperCase() : '';
          const room = rooms.get(roomId);
          if (!room) {
            sendJSON({ type: 'error', message: 'Room not found.' });
            break;
          }
          if (room.status !== 'lobby') {
            sendJSON({ type: 'error', message: 'Race has already started.' });
            break;
          }
          if (room.players.length >= 6) {
            sendJSON({ type: 'error', message: 'Room is full (max 6 players).' });
            break;
          }

          clientUsername = data.username || 'Guest';
          clientUserId = data.userId || null;
          currentRoomId = roomId;

          // Add to player list
          room.players.push({
            ws,
            userId: clientUserId,
            username: clientUsername,
            wpm: 0,
            accuracy: 100,
            progress: 0,
            finished: false
          });

          // Notify everyone in the room
          const playerSummaries = room.players.map(p => ({
            username: p.username,
            progress: p.progress,
            wpm: p.wpm,
            finished: p.finished
          }));

          broadcastToRoom(roomId, {
            type: 'player_joined',
            players: playerSummaries,
            text: room.text
          });
          break;
        }

        case 'start_countdown': {
          const room = rooms.get(currentRoomId);
          if (!room || room.host !== ws) {
            sendJSON({ type: 'error', message: 'Only the host can start the match.' });
            break;
          }

          room.status = 'countdown';
          room.text = generateMultiplayerWords(35); // Regen text on start
          
          let countdownVal = 5;
          broadcastToRoom(currentRoomId, { type: 'countdown', value: countdownVal, text: room.text });

          const interval = setInterval(() => {
            const activeRoom = rooms.get(currentRoomId);
            if (!activeRoom || activeRoom.status !== 'countdown') {
              clearInterval(interval);
              return;
            }
            countdownVal--;
            if (countdownVal <= 0) {
              clearInterval(interval);
              activeRoom.status = 'racing';
              broadcastToRoom(currentRoomId, { type: 'race_start' });
            } else {
              broadcastToRoom(currentRoomId, { type: 'countdown', value: countdownVal, text: activeRoom.text });
            }
          }, 1000);
          break;
        }

        case 'progress': {
          const room = rooms.get(currentRoomId);
          if (!room || room.status !== 'racing') break;

          const player = room.players.find(p => p.ws === ws);
          if (!player || player.finished) break;

          player.progress = data.progress; // Decimal 0 to 1
          player.wpm = data.wpm;
          player.accuracy = data.accuracy;

          broadcastToRoom(currentRoomId, {
            type: 'progress_update',
            players: room.players.map(p => ({
              username: p.username,
              progress: p.progress,
              wpm: p.wpm,
              finished: p.finished
            }))
          });
          break;
        }

        case 'finish': {
          const room = rooms.get(currentRoomId);
          if (!room || room.status !== 'racing') break;

          const player = room.players.find(p => p.ws === ws);
          if (!player || player.finished) break;

          player.progress = 1;
          player.wpm = data.wpm;
          player.accuracy = data.accuracy;
          player.finished = true;

          // Check rank
          const finishers = room.players.filter(p => p.finished).length;
          const rank = finishers;

          sendJSON({ type: 'your_rank', rank });

          broadcastToRoom(currentRoomId, {
            type: 'progress_update',
            players: room.players.map(p => ({
              username: p.username,
              progress: p.progress,
              wpm: p.wpm,
              finished: p.finished
            }))
          });

          // Check if all players finished
          const allFinished = room.players.every(p => p.finished);
          if (allFinished) {
            room.status = 'finished';
            
            // Sort by WPM descending
            const results = [...room.players]
              .sort((a, b) => b.wpm - a.wpm)
              .map((p, idx) => ({
                rank: idx + 1,
                username: p.username,
                wpm: p.wpm,
                accuracy: p.accuracy
              }));

            broadcastToRoom(currentRoomId, { type: 'race_finished', results });

            // Persistent log to DB if there is a winner with userId
            const winner = [...room.players].sort((a, b) => b.wpm - a.wpm)[0];
            if (winner && winner.userId) {
              const playersRecord = room.players.map(p => ({
                userId: p.userId,
                username: p.username,
                wpm: p.wpm,
                accuracy: p.accuracy
              }));

              const match = new Match({
                roomId: currentRoomId,
                winnerId: winner.userId,
                playersData: playersRecord
              });
              match.save().then(() => {
                // Award winner achievement
                User.findById(winner.userId).then(u => {
                  if (u && !u.achievements.some(a => a.achievementType === 'multiplayer_champion')) {
                    u.achievements.push({ achievementType: 'multiplayer_champion' });
                    u.save();
                  }
                }).catch(err => console.error(err));
              }).catch(err => console.error('Error saving match stats:', err));
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('Socket message parse error:', err);
    }
  });

  ws.on('close', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    // Remove player
    room.players = room.players.filter(p => p.ws !== ws);

    if (room.players.length === 0) {
      // Room empty, delete it
      rooms.delete(currentRoomId);
    } else {
      // If host left, assign new host
      if (room.host === ws) {
        room.host = room.players[0].ws;
        broadcastToRoom(currentRoomId, { type: 'new_host', hostName: room.players[0].username });
      }

      const playerSummaries = room.players.map(p => ({
        username: p.username,
        progress: p.progress,
        wpm: p.wpm,
        finished: p.finished
      }));

      // Notify remaining players
      broadcastToRoom(currentRoomId, {
        type: 'player_left',
        leftUser: clientUsername,
        players: playerSummaries
      });
    }
  });
});

// Upgrade HTTP to WS
server.on('upgrade', (request, socket, head) => {
  console.log(`[Upgrade Request] URL: ${request.url || ''}`);
  
  let pathname = '';
  try {
    if (request.url && (request.url.startsWith('http://') || request.url.startsWith('https://') || request.url.startsWith('ws://') || request.url.startsWith('wss://'))) {
      pathname = new URL(request.url).pathname;
    } else {
      pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
    }
  } catch (e) {
    console.error('[Upgrade Request] URL parsing error:', e.message);
    pathname = request.url ? request.url.split('?')[0] : '';
  }

  console.log(`[Upgrade Request] Resolved Pathname: "${pathname}"`);

  if (pathname === '/ws' || pathname === '/ws/') {
    console.log('[Upgrade Request] Path matches. Upgrading connection to WebSocket.');
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    console.warn(`[Upgrade Request] Path "${pathname}" did not match "/ws". Destroying socket.`);
    socket.destroy();
  }
});

// Boot Server
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Smash Keys Server running on http://localhost:${PORT}`);
  console.log(` Connecting to MongoDB...`);
  console.log(`==================================================`);
});
