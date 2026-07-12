const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

async function signup(email, password, name, color) {
  try {
    // Check if user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return { success: false, message: 'Email already exists' };
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    
    const userId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (email, password, name, color) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, name, color],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const token = generateToken(userId, email);
    return { success: true, token, userId, email, name, color };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, message: 'Server error' };
  }
}

async function login(email, password) {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return { success: false, message: 'Invalid email or password' };
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return { success: false, message: 'Invalid email or password' };
    }

    const token = generateToken(user.id, user.email);
    return { 
      success: true, 
      token, 
      userId: user.id, 
      email: user.email, 
      name: user.name, 
      color: user.color,
      totalScore: user.total_score,
      gamesPlayed: user.games_played,
      highestScore: user.highest_score
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Server error' };
  }
}

async function getUserStats(userId) {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return null;
    }

    const recentScores = await new Promise((resolve, reject) => {
      db.all(
        'SELECT score, length, created_at FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    return {
      ...user,
      recentScores
    };
  } catch (error) {
    console.error('Get user stats error:', error);
    return null;
  }
}

async function saveScore(userId, score, length) {
  try {
    // Save individual score
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO scores (user_id, score, length) VALUES (?, ?, ?)',
        [userId, score, length],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Update user stats
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users 
         SET total_score = total_score + ?,
             games_played = games_played + 1,
             highest_score = MAX(highest_score, ?)
         WHERE id = ?`,
        [score, score, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return { success: true };
  } catch (error) {
    console.error('Save score error:', error);
    return { success: false };
  }
}

async function saveDeath(userId, name, email, score, length) {
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO deaths (user_id, name, email, score, length) VALUES (?, ?, ?, ?, ?)',
        [userId || null, name, email || null, score, length],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return { success: true };
  } catch (error) {
    console.error('Save death error:', error);
    return { success: false };
  }
}

async function getDeathLeaderboard() {
  try {
    const deaths = await new Promise((resolve, reject) => {
      db.all(
        'SELECT name, score, length, created_at FROM deaths ORDER BY created_at DESC LIMIT 20',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    return deaths;
  } catch (error) {
    console.error('Get death leaderboard error:', error);
    return [];
  }
}

module.exports = {
  signup,
  login,
  verifyToken,
  getUserStats,
  saveScore,
  saveDeath,
  getDeathLeaderboard
};
