import React, { useState, useEffect } from 'react';
import { Users, Lock, Unlock, Play, Gamepad2 } from 'lucide-react';
import './Home.css';

function Home({ socket, onJoinRoom }) {
  const [playerName, setPlayerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [selectedColor, setSelectedColor] = useState('#4ECDC4');
  const [deathLeaderboard, setDeathLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [authTab, setAuthTab] = useState('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F7DC6F', '#FF8C42'];

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
      setPlayerName(JSON.parse(savedUser).name);
      setEmail(JSON.parse(savedUser).email);
      setSelectedColor(JSON.parse(savedUser).color);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    const API_URL = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '');
    
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setAuthError(errorData.message || 'Erreur de connexion');
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify({
          userId: data.userId,
          email: data.email,
          name: data.name,
          color: data.color
        }));
        setIsAuthenticated(true);
        setUser(data);
        setPlayerName(data.name);
        setEmail(data.email);
        setSelectedColor(data.color);
        setPassword('');
      } else {
        setAuthError(data.message);
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Erreur de connexion au serveur');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    if (!playerName.trim()) {
      setAuthError('Le nom est requis');
      return;
    }
    
    const API_URL = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '');
    
    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: playerName, color: selectedColor })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setAuthError(errorData.message || 'Erreur de connexion');
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify({
          userId: data.userId,
          email: data.email,
          name: data.name,
          color: data.color
        }));
        setIsAuthenticated(true);
        setUser(data);
        setPassword('');
      } else {
        setAuthError(data.message);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setAuthError('Erreur de connexion au serveur');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setPlayerName('');
    setEmail('');
    setPassword('');
  };

  useEffect(() => {
    socket.on('roomCreated', ({ roomCode, isPrivate }) => {
      onJoinRoom({ roomCode, isPrivate });
    });

    socket.on('roomJoined', ({ roomCode, isPrivate }) => {
      onJoinRoom({ roomCode, isPrivate });
    });

    socket.on('publicRooms', (rooms) => {
      setPublicRooms(rooms);
    });

    socket.on('deathLeaderboard', (leaderboard) => {
      setDeathLeaderboard(leaderboard);
    });

    // Request public rooms periodically
    const interval = setInterval(() => {
      socket.emit('getPublicRooms');
    }, 3000);

    socket.emit('getPublicRooms');
    socket.emit('getDeathLeaderboard');

    return () => {
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('publicRooms');
      clearInterval(interval);
    };
  }, [socket, onJoinRoom]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    
    socket.emit('createRoom', {
      isPrivate,
      roomCode: isPrivate ? roomCode.toUpperCase() : null,
      playerName: playerName.trim(),
      email: email.trim() || null,
      color: selectedColor
    });
  };

  const handleJoinPublicRoom = (code) => {
    if (!playerName.trim()) return;
    
    socket.emit('joinRoom', {
      roomCode: code,
      playerName: playerName.trim(),
      email: email.trim() || null,
      color: selectedColor
    });
  };

  const handleJoinPrivateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !roomCode.trim()) return;
    
    socket.emit('joinRoom', {
      roomCode: roomCode.toUpperCase(),
      playerName: playerName.trim(),
      email: email.trim() || null,
      color: selectedColor
    });
  };

  return (
    <div className="home">
      <div className="home-header">
        <Gamepad2 size={64} className="logo-icon" />
        <h1>Snake Multiplayer</h1>
        <p>Jouez avec vos amis en temps réel</p>
      </div>

      {!isAuthenticated ? (
        <div className="auth-section">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
              onClick={() => setAuthTab('login')}
            >
              Connexion
            </button>
            <button
              className={`auth-tab ${authTab === 'signup' ? 'active' : ''}`}
              onClick={() => setAuthTab('signup')}
            >
              Inscription
            </button>
          </div>

          {authTab === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {authError && <p className="auth-error">{authError}</p>}
              <button type="submit" className="auth-btn">Se connecter</button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSignup}>
              <input
                type="text"
                placeholder="Votre pseudo"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="color-selection">
                <p>Choisissez votre couleur :</p>
                <div className="color-options">
                  {colors.map(color => (
                    <button
                      key={color}
                      className={`color-btn ${selectedColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>
              </div>
              {authError && <p className="auth-error">{authError}</p>}
              <button type="submit" className="auth-btn">S'inscrire</button>
            </form>
          )}
        </div>
      ) : (
        <>
          <div className="user-info">
            <span>Bienvenue, {user?.name}!</span>
            <button onClick={handleLogout} className="logout-btn">Déconnexion</button>
          </div>

          <div className="color-selection">
            <p>Choisissez votre couleur :</p>
            <div className="color-options">
              {colors.map(color => (
                <button
                  key={color}
                  className={`color-btn ${selectedColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          <button
            className="leaderboard-toggle"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
          >
            {showLeaderboard ? 'Masquer' : 'Afficher'} le tableau des morts
          </button>

          {showLeaderboard && (
            <div className="death-leaderboard">
              <h3>🏆 Tableau des morts</h3>
              {deathLeaderboard.length === 0 ? (
                <p>Aucune mort enregistrée</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Joueur</th>
                      <th>Score</th>
                      <th>Taille</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deathLeaderboard.map((death, index) => (
                      <tr key={index}>
                        <td>{death.name}</td>
                        <td>{death.score}</td>
                        <td>{death.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              <Play size={20} />
              Créer
            </button>
            <button
              className={`tab ${activeTab === 'join' ? 'active' : ''}`}
              onClick={() => setActiveTab('join')}
            >
              <Users size={20} />
              Rejoindre
            </button>
          </div>

          {activeTab === 'create' ? (
            <div className="create-room">
              <div className="room-type-toggle">
                <button
                  className={`type-btn ${!isPrivate ? 'active' : ''}`}
                  onClick={() => setIsPrivate(false)}
                >
                  <Unlock size={20} />
                  Public
                </button>
                <button
                  className={`type-btn ${isPrivate ? 'active' : ''}`}
                  onClick={() => setIsPrivate(true)}
                >
                  <Lock size={20} />
                  Privé
                </button>
              </div>

              {isPrivate && (
                <input
                  type="text"
                  placeholder="Code du salon (ex: ABC123)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="room-code-input"
                />
              )}

              <button onClick={handleCreateRoom} className="primary-btn">
                Créer le salon
              </button>
            </div>
          ) : (
            <div className="join-room">
              <div className="private-join">
                <input
                  type="text"
                  placeholder="Code du salon privé"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="room-code-input"
                />
                <button onClick={handleJoinPrivateRoom} className="secondary-btn">
                  Rejoindre
                </button>
              </div>

              <div className="public-rooms">
                <h3>Salons publics</h3>
                {publicRooms.length === 0 ? (
                  <p className="no-rooms">Aucun salon public disponible</p>
                ) : (
                  <div className="rooms-list">
                    {publicRooms.map((room) => (
                      <div key={room.code} className="room-card">
                        <div className="room-info">
                          <span className="room-code">{room.code}</span>
                          <span className="room-players">
                            <Users size={16} />
                            {room.playerCount}/{room.maxPlayers}
                          </span>
                        </div>
                        <button
                          onClick={() => handleJoinPublicRoom(room.code)}
                          className="join-btn"
                        >
                          Rejoindre
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Home;
