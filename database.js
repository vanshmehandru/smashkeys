const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smashkeys';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema (includes profile, stats, settings, achievements)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  streak: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  settings: {
    theme: { type: String, default: 'nord' },
    caret: { type: String, default: 'line' },
    fontSize: { type: String, default: '1.25rem' },
    soundType: { type: String, default: 'mechanical' },
    soundVolume: { type: Number, default: 0.5 },
    layout: { type: String, default: 'qwerty' }
  },
  achievements: [{
    achievementType: { type: String }, // 'speed_demon_80', 'perfectionist', 'marathoner_120', 'night_owl', 'streaker_5', 'multiplayer_champion'
    unlockedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Typing Session Schema (individual offline/online practice tests)
const SessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  modeType: { type: String, required: true }, // 'time', 'words', 'zen', 'custom', 'code'
  modeVal: { type: String, required: true },  // '15', '30', '50', 'custom_text', etc.
  wpm: { type: Number, required: true },
  rawWpm: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  errorCount: { type: Number, required: true },
  consistency: { type: Number, required: true },
  duration: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Multiplayer Matches Schema
const MatchSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  playersData: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, required: true },
    wpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    status: { type: String, default: 'finished' } // 'finished', 'quit'
  }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Session = mongoose.model('Session', SessionSchema);
const Match = mongoose.model('Match', MatchSchema);

// Migrate users who are on the old default settings to the new default theme (nord)
User.updateMany(
  {
    "settings.theme": "cyberpunk",
    "settings.caret": "line",
    "settings.fontSize": "1.25rem",
    "settings.soundType": "mechanical",
    "settings.soundVolume": 0.5,
    "settings.layout": "qwerty"
  },
  {
    $set: { "settings.theme": "nord" }
  }
).then(res => {
  if (res.modifiedCount > 0) {
    console.log(`Migrated ${res.modifiedCount} users from cyberpunk defaults to nord.`);
  }
}).catch(err => console.error('Migration error:', err));

module.exports = {
  mongoose,
  User,
  Session,
  Match
};
