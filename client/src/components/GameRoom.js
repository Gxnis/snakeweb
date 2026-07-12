import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Users, Trophy, Skull } from 'lucide-react';
import './GameRoom.css';

function GameRoom({ socket, roomData, onLeaveRoom }) {
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [myPlayer, setMyPlayer] = useState(null);
  const [winner, setWinner] = useState(null);
  const [dangerTimer, setDangerTimer] = useState(0);
  const canvasRef = useRef(null);
  const cameraRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });
  const boostingRef = useRef(false);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    socket.on('playersUpdate', (updatedPlayers) => {
      setPlayers(updatedPlayers);
      const me = updatedPlayers.find(p => p.id === socket.id);
      setMyPlayer(me || null);
    });

    socket.on('gameStarted', (initialState) => {
      setGameState(initialState);
      setGameStarted(true);
      setWinner(null);
    });

    socket.on('gameUpdate', ({ gameState: newState, players: newPlayers }) => {
      setGameState(newState);
      setPlayers(newPlayers);
      const me = newPlayers.find(p => p.id === socket.id);
      setMyPlayer(me || null);

      // Use server's danger timer
      if (me && me.alive) {
        setDangerTimer(me.dangerTimer || 0);
      }

      // Check for winner (last alive player)
      const alivePlayers = newPlayers.filter(p => p.alive);
      if (alivePlayers.length === 1 && newPlayers.length > 1) {
        setWinner(alivePlayers[0]);
      } else if (alivePlayers.length === 0 && newPlayers.length > 1) {
        setWinner(null); // Everyone died
      }
    });

    return () => {
      socket.off('playersUpdate');
      socket.off('gameStarted');
      socket.off('gameUpdate');
    };
  }, [socket]);


  useEffect(() => {
    const handleMouseMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handleMouseDown = () => {
      boostingRef.current = true;
      if (gameStarted && myPlayer?.alive) {
        socket.emit('playerBoost', { boosting: true });
      }
    };

    const handleMouseUp = () => {
      boostingRef.current = false;
      if (gameStarted && myPlayer?.alive) {
        socket.emit('playerBoost', { boosting: false });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameStarted, myPlayer, socket]);

  // Send mouse angle to server continuously
  useEffect(() => {
    if (!gameStarted || !myPlayer || !myPlayer.alive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId;

    const sendAngle = () => {
      if (!gameStarted || !myPlayer || !myPlayer.alive) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const angle = Math.atan2(mouseRef.current.y - centerY, mouseRef.current.x - centerX);
      
      socket.emit('playerMove', { angle });
      animationFrameId = requestAnimationFrame(sendAngle);
    };

    animationFrameId = requestAnimationFrame(sendAngle);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, myPlayer]);

  const handleStartGame = () => {
    socket.emit('startGame');
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext('2d');
    const { orbs } = gameState || {};

    // Update camera to follow player
    if (myPlayer && myPlayer.alive) {
      cameraRef.current = {
        x: myPlayer.x - canvas.width / 2,
        y: myPlayer.y - canvas.height / 2
      };
    }

    const camera = cameraRef.current;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw danger zone (red border area)
    const dangerZone = gameState.dangerZone || 100;
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    ctx.fillRect(
      -camera.x, 
      -camera.y, 
      gameState.width, 
      dangerZone
    ); // Top
    ctx.fillRect(
      -camera.x, 
      gameState.height - dangerZone - camera.y, 
      gameState.width, 
      dangerZone
    ); // Bottom
    ctx.fillRect(
      -camera.x, 
      -camera.y, 
      dangerZone, 
      gameState.height
    ); // Left
    ctx.fillRect(
      gameState.width - dangerZone - camera.x, 
      -camera.y, 
      dangerZone, 
      gameState.height
    ); // Right

    // Draw map border
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(
      -camera.x, 
      -camera.y, 
      gameState.width, 
      gameState.height
    );

    // Draw grid (simplified - only draw every 100px)
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    const gridSize = 100;
    const startX = -camera.x % gridSize;
    const startY = -camera.y % gridSize;
    
    ctx.beginPath();
    for (let x = startX; x < canvas.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = startY; y < canvas.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Draw orbs (optimized - filter visible first)
    if (orbs && Array.isArray(orbs)) {
      const visibleOrbs = orbs.filter(orb => {
        const screenX = orb.x - camera.x;
        const screenY = orb.y - camera.y;
        return screenX > -30 && screenX < canvas.width + 30 && 
               screenY > -30 && screenY < canvas.height + 30;
      });
      
      visibleOrbs.forEach(orb => {
        const screenX = orb.x - camera.x;
        const screenY = orb.y - camera.y;
        ctx.fillStyle = orb.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, orb.value === 5 ? 6 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw snakes (optimized - filter visible players first)
    if (players && Array.isArray(players)) {
      const visiblePlayers = players.filter(player => {
        if (!player.alive) return false;
        const screenX = player.x - camera.x;
        const screenY = player.y - camera.y;
        return screenX > -100 && screenX < canvas.width + 100 && 
               screenY > -100 && screenY < canvas.height + 100;
      });

      visiblePlayers.forEach(player => {
      const bodyRadius = 6 + Math.min(player.length / 50, 6);
      
      // Draw body (skip every other segment for performance)
      if (player.body && Array.isArray(player.body)) {
        for (let i = 0; i < player.body.length; i += 2) {
          const segment = player.body[i];
          const screenX = segment.x - camera.x;
          const screenY = segment.y - camera.y;
          
          // Only draw if visible
          if (screenX > -bodyRadius && screenX < canvas.width + bodyRadius && 
              screenY > -bodyRadius && screenY < canvas.height + bodyRadius) {
            ctx.fillStyle = player.color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, bodyRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw head with eyes
      const headScreenX = player.x - camera.x;
      const headScreenY = player.y - camera.y;
      
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(headScreenX, headScreenY, bodyRadius + 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw eyes
      ctx.fillStyle = '#fff';
      const eyeOffset = 4;
      const eyeAngle1 = player.angle - 0.5;
      const eyeAngle2 = player.angle + 0.5;
      
      ctx.beginPath();
      ctx.arc(
        headScreenX + Math.cos(eyeAngle1) * eyeOffset,
        headScreenY + Math.sin(eyeAngle1) * eyeOffset,
        3, 0, Math.PI * 2
      );
      ctx.arc(
        headScreenX + Math.cos(eyeAngle2) * eyeOffset,
        headScreenY + Math.sin(eyeAngle2) * eyeOffset,
        3, 0, Math.PI * 2
      );
      ctx.fill();

      // Draw name with verified badge
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, headScreenX, headScreenY - bodyRadius - 10);

      // Draw verified badge
      if (player.isVerified) {
        ctx.fillStyle = '#1DA1F2';
        ctx.beginPath();
        ctx.arc(headScreenX + 20, headScreenY - bodyRadius - 15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.fillText('✓', headScreenX + 20, headScreenY - bodyRadius - 12);
      }
    });
    }
  };

  // Game loop with requestAnimationFrame for smooth rendering
  useEffect(() => {
    if (!gameStarted || !gameState || !players) return;

    const gameLoop = () => {
      drawGame();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, gameState, players]);


  const sortedPlayers = players ? [...players].sort((a, b) => b.score - a.score) : [];

  return (
    <div className="game-room">
      <div className="game-header">
        <div className="room-info">
          <span className="room-code">{roomData.roomCode}</span>
          <span className="room-type">{roomData.isPrivate ? 'Privé' : 'Public'}</span>
        </div>
        <button onClick={onLeaveRoom} className="leave-btn">
          <LogOut size={20} />
          Quitter
        </button>
      </div>

      <div className="game-content">
        <div className="game-area">
          {gameStarted ? (
            <>
              <canvas
                ref={canvasRef}
                width={600}
                height={450}
                className="game-canvas"
              />
              {dangerTimer > 0 && (
                <div className="danger-timer">
                  <Skull size={24} />
                  <span>{Math.max(0, 10 - dangerTimer).toFixed(1)}s</span>
                </div>
              )}
              {winner && (
                <div className="winner-banner">
                  <Trophy size={32} />
                  <span>{winner.name} a gagné!</span>
                </div>
              )}
              {!myPlayer?.alive && (
                <div className="dead-banner">
                  <Skull size={32} />
                  <span>Vous êtes mort!</span>
                </div>
              )}
            </>
          ) : (
            <div className="waiting-area">
              <Users size={64} className="waiting-icon" />
              <h2>En attente de joueurs</h2>
              <p>{players.length} joueur(s) dans le salon</p>
              <button onClick={handleStartGame} className="start-btn">
                Démarrer la partie
              </button>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div className="players-list">
            <h3>
              <Users size={20} />
              Joueurs ({players.length})
            </h3>
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className={`player-card ${player.id === socket.id ? 'me' : ''} ${!player.alive ? 'dead' : ''}`}
              >
                <div className="player-info">
                  <div
                    className="player-color"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="player-name">{player.name}</span>
                  {player.id === socket.id && <span className="me-badge">Moi</span>}
                </div>
                <div className="player-score">
                  <Trophy size={16} />
                  {player.score}
                </div>
              </div>
            ))}
          </div>

          {gameStarted && (
            <div className="controls-info">
              <h3>Contrôles</h3>
              <p>Souris pour diriger</p>
              <p>Clic gauche pour booster</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameRoom;
