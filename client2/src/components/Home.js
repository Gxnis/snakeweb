import React, { useState, useEffect } from 'react';
import { Users, Lock, Unlock, Play, Gamepad2 } from 'lucide-react';
import './Home.css';

function Home({ socket, onJoinRoom }) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [activeTab, setActiveTab] = useState('create');

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

    // Request public rooms periodically
    const interval = setInterval(() => {
      socket.emit('getPublicRooms');
    }, 3000);

    socket.emit('getPublicRooms');

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
      playerName: playerName.trim()
    });
  };

  const handleJoinPublicRoom = (code) => {
    if (!playerName.trim()) return;
    
    socket.emit('joinRoom', {
      roomCode: code,
      playerName: playerName.trim()
    });
  };

  const handleJoinPrivateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !roomCode.trim()) return;
    
    socket.emit('joinRoom', {
      roomCode: roomCode.toUpperCase(),
      playerName: playerName.trim()
    });
  };

  return (
    <div className="home">
      <div className="home-header">
        <Gamepad2 size={64} className="logo-icon" />
        <h1>Snake Multiplayer</h1>
        <p>Jouez avec vos amis en temps réel</p>
      </div>

      <div className="player-input">
        <input
          type="text"
          placeholder="Votre pseudo"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={15}
        />
      </div>

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
    </div>
  );
}

export default Home;
