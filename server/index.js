const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { signup, login, verifyToken, getUserStats, saveScore, saveDeath, getDeathLeaderboard } = require('./auth');

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static('client/build'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Room management
const rooms = new Map();
const players = new Map();

// Game loop intervals for each room
const gameLoops = new Map();

// Death leaderboard
const deathLeaderboard = [];

// Verified user
const VERIFIED_EMAIL = 'younesbenhajsalem02@gmail.com';

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

// API Routes
app.post('/api/signup', async (req, res) => {
  const { email, password, name, color } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Email, password, and name are required' });
  }

  const result = await signup(email, password, name, color);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const result = await login(email, password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
  const stats = await getUserStats(req.user.userId);
  if (stats) {
    res.json(stats);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

app.post('/api/score', authenticateToken, async (req, res) => {
  const { score, length } = req.body;
  const result = await saveScore(req.user.userId, score, length);
  res.json(result);
});

// Generate a random 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new room
function createRoom(isPrivate = false, roomCode = null, creatorId = null) {
  const code = roomCode || generateRoomCode();
  const room = {
    id: uuidv4(),
    code: code,
    isPrivate: isPrivate,
    players: [],
    gameState: null,
    maxPlayers: 10,
    createdAt: Date.now(),
    creatorId: creatorId
  };
  rooms.set(code, room);
  return room;
}

// Get available public rooms
function getPublicRooms() {
  return Array.from(rooms.values())
    .filter(room => !room.isPrivate && room.players.length < room.maxPlayers)
    .map(room => ({
      code: room.code,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers
    }));
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new room
  socket.on('createRoom', ({ isPrivate, roomCode, playerName, email, color }) => {
    let room;
    
    if (isPrivate && roomCode) {
      // Check if room code already exists
      if (rooms.has(roomCode)) {
        socket.emit('roomError', { message: 'Room code already exists' });
        return;
      }
      room = createRoom(true, roomCode, socket.id);
    } else {
      room = createRoom(false, null, socket.id);
    }

    const player = {
      id: socket.id,
      name: playerName || `Player ${socket.id.slice(0, 4)}`,
      email: email || null,
      color: color || getRandomColor(),
      isVerified: email === VERIFIED_EMAIL,
      userId: null,
      score: 0,
      snake: [],
      direction: 'right',
      alive: true
    };

    room.players.push(player);
    players.set(socket.id, { roomCode: room.code, player });

    socket.join(room.code);
    socket.emit('roomCreated', { roomCode: room.code, isPrivate: room.isPrivate });
    io.to(room.code).emit('playersUpdate', room.players);
  });

  // Join an existing room
  socket.on('joinRoom', ({ roomCode, playerName, email, color }) => {
    const room = rooms.get(roomCode);
    
    if (!room) {
      socket.emit('roomError', { message: 'Room not found' });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit('roomError', { message: 'Room is full' });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName || `Player ${socket.id.slice(0, 4)}`,
      email: email || null,
      color: color || getRandomColor(),
      isVerified: email === VERIFIED_EMAIL,
      userId: null,
      score: 0,
      snake: [],
      direction: 'right',
      alive: true
    };

    room.players.push(player);
    players.set(socket.id, { roomCode: room.code, player });

    socket.join(room.code);
    socket.emit('roomJoined', { roomCode: room.code, isPrivate: room.isPrivate });
    io.to(room.code).emit('playersUpdate', room.players);
  });

  // Get public rooms
  socket.on('getPublicRooms', () => {
    socket.emit('publicRooms', getPublicRooms());
  });

  // Get death leaderboard
  socket.on('getDeathLeaderboard', async () => {
    const leaderboard = await getDeathLeaderboard();
    socket.emit('deathLeaderboard', leaderboard);
  });

  // Start game (only room creator can start)
  socket.on('startGame', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const room = rooms.get(playerData.roomCode);
    if (!room) return;

    // Check if player is room creator
    if (room.creatorId !== socket.id) {
      socket.emit('roomError', { message: 'Only room creator can start the game' });
      return;
    }

    // Initialize game state
    room.gameState = initializeGameState();
    
    // Initialize each player's snake
    room.players.forEach((player) => {
      player.x = 800 + Math.random() * 800;
      player.y = 600 + Math.random() * 600;
      player.angle = Math.random() * Math.PI * 2;
      player.targetAngle = player.angle;
      player.length = 10;
      player.speed = 3;
      player.body = [];
      player.alive = true;
      player.score = 0;
      player.dangerTimer = 0;
      
      // Initialize body
      for (let i = 0; i < player.length; i++) {
        player.body.push({
          x: player.x - Math.cos(player.angle) * i * 5,
          y: player.y - Math.sin(player.angle) * i * 5
        });
      }
    });

    // Start game loop for this room
    if (!gameLoops.has(room.code)) {
      const interval = setInterval(() => updateGameState(room), 1000 / 60); // 60 FPS
      gameLoops.set(room.code, interval);
    }

    io.to(room.code).emit('gameStarted', room.gameState);
    io.to(room.code).emit('playersUpdate', room.players);
  });

  // Player movement (mouse position)
  socket.on('playerMove', ({ angle }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const room = rooms.get(playerData.roomCode);
    if (!room || !room.gameState) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player && player.alive) {
      player.targetAngle = angle;
    }
  });

  // Boost (speed up)
  socket.on('playerBoost', ({ boosting }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const room = rooms.get(playerData.roomCode);
    if (!room || !room.gameState) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player && player.alive) {
      player.speed = boosting ? 5 : 3;
    }
  });


  // Leave room
  socket.on('leaveRoom', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const room = rooms.get(playerData.roomCode);
    if (room) {
      // Drop orbs if player was alive
      const player = room.players.find(p => p.id === socket.id);
      if (player && player.alive && player.body.length > 0) {
        dropOrbs(room, player);
      }
      
      room.players = room.players.filter(p => p.id !== socket.id);
      socket.leave(room.code);
      io.to(room.code).emit('playersUpdate', room.players);

      // Stop game loop if room is empty
      if (room.players.length === 0) {
        if (gameLoops.has(room.code)) {
          clearInterval(gameLoops.get(room.code));
          gameLoops.delete(room.code);
        }
        rooms.delete(room.code);
      }
    }

    players.delete(socket.id);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const playerData = players.get(socket.id);
    if (playerData) {
      const room = rooms.get(playerData.roomCode);
      if (room) {
        // Drop orbs if player was alive
        const player = room.players.find(p => p.id === socket.id);
        if (player && player.alive && player.body.length > 0) {
          dropOrbs(room, player);
        }
        
        room.players = room.players.filter(p => p.id !== socket.id);
        io.to(room.code).emit('playersUpdate', room.players);

        if (room.players.length === 0) {
          if (gameLoops.has(room.code)) {
            clearInterval(gameLoops.get(room.code));
            gameLoops.delete(room.code);
          }
          rooms.delete(room.code);
        }
      }
    }

    players.delete(socket.id);
  });
});

function initializeGameState() {
  const orbs = [];
  for (let i = 0; i < 60; i++) {
    orbs.push(generateOrb());
  }
  return {
    orbs: orbs,
    width: 2000,
    height: 1600,
    dangerZone: 200
  };
}

function generateOrb() {
  return {
    x: Math.random() * 2000,
    y: Math.random() * 1600,
    value: Math.random() < 0.1 ? 5 : 1,
    color: getRandomOrbColor()
  };
}

function getRandomOrbColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F7DC6F', '#FF8C42'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function dropOrbs(room, player) {
  const dropAmount = Math.min(player.body.length, 50); // Drop up to 50 orbs
  for (let i = 0; i < dropAmount; i++) {
    if (i < player.body.length) {
      const segment = player.body[i];
      room.gameState.orbs.push({
        x: segment.x + (Math.random() - 0.5) * 20,
        y: segment.y + (Math.random() - 0.5) * 20,
        value: 1,
        color: player.color
      });
    }
  }
  // Keep orb count reasonable
  if (room.gameState.orbs.length > 200) {
    room.gameState.orbs = room.gameState.orbs.slice(-200);
  }
}

function getRandomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF8C42', '#A8E6CF', '#DCEDC1', '#FFD3B6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function updateGameState(room) {
  const { gameState } = room;
  const { width, height } = gameState;

  // Spawn new orbs periodically
  if (gameState.orbs.length < 60 && Math.random() < 0.03) {
    gameState.orbs.push(generateOrb());
  }

  room.players.forEach(player => {
    if (!player.alive) return;

    // Smooth angle interpolation
    let angleDiff = player.targetAngle - player.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    player.angle += angleDiff * 0.15;

    // Move player
    player.x += Math.cos(player.angle) * player.speed;
    player.y += Math.sin(player.angle) * player.speed;

    // Map borders with danger zone timer
    const dangerZone = gameState.dangerZone || 100;
    const inDanger = player.x < dangerZone || player.x > width - dangerZone || 
                    player.y < dangerZone || player.y > height - dangerZone;
    
    if (inDanger) {
      player.dangerTimer += 1/60; // Increment by 1/60 second (assuming 60 FPS)
      if (player.dangerTimer >= 10) {
        player.alive = false;
        // Save death to database
        saveDeath(player.userId, player.name, player.email, player.score, player.length);
        dropOrbs(room, player);
        return;
      }
    } else {
      player.dangerTimer = 0; // Reset timer when safe
    }

    // Add new body segment at head
    player.body.unshift({ x: player.x, y: player.y });

    // Remove excess body segments
    while (player.body.length > player.length) {
      player.body.pop();
    }

    // Check orb collision
    for (let i = gameState.orbs.length - 1; i >= 0; i--) {
      const orb = gameState.orbs[i];
      const dist = Math.hypot(player.x - orb.x, player.y - orb.y);
      if (dist < 20) {
        player.score += orb.value;
        player.length += orb.value;
        gameState.orbs.splice(i, 1);
      }
    }

    // Check collision with other snakes (body to body)
    room.players.forEach(otherPlayer => {
      if (otherPlayer.id !== player.id && otherPlayer.alive) {
        // Check if player's head touches other player's body
        for (let i = 0; i < otherPlayer.body.length; i++) {
          const segment = otherPlayer.body[i];
          const dist = Math.hypot(player.x - segment.x, player.y - segment.y);
          if (dist < 15) {
            player.alive = false;
            dropOrbs(room, player);
            return;
          }
        }
      }
    });
  });

  // Broadcast updated state
  io.to(room.code).emit('gameUpdate', {
    gameState: gameState,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      length: p.length,
      x: p.x,
      y: p.y,
      angle: p.angle,
      body: p.body,
      alive: p.alive,
      isVerified: p.isVerified,
      dangerTimer: p.dangerTimer
    }))
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
