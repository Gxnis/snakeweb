import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Home, GameRoom } from './components';
import './App.css';

const socket = io.connect(process.env.REACT_APP_SERVER_URL || window.location.origin);

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    socket.on('roomError', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      socket.off('roomError');
    };
  }, []);

  const handleJoinRoom = (data) => {
    setRoomData(data);
    setCurrentView('game');
  };

  const handleLeaveRoom = () => {
    socket.emit('leaveRoom');
    setRoomData(null);
    setCurrentView('home');
  };

  return (
    <div className="App">
      {error && <div className="error-banner">{error}</div>}
      {currentView === 'home' ? (
        <Home socket={socket} onJoinRoom={handleJoinRoom} />
      ) : (
        <GameRoom 
          socket={socket} 
          roomData={roomData} 
          onLeaveRoom={handleLeaveRoom} 
        />
      )}
    </div>
  );
}

export default App;
