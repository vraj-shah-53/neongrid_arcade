import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';

export default function Neonrunner() {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  
  // Game states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('neonrunner_highscore') || '0');
  });

  // Gameplay variables (managed via ref for the high-frequency animation loop)
  const gameStateRef = useRef({
    lane: 1, // 0 = Left, 1 = Middle, 2 = Right
    targetLaneX: 300, // X coordinate player is moving towards
    playerX: 300, // Current X coordinate of player
    playerY: 340,
    obstacles: [],
    bits: [],
    speed: 3.5,
    obstacleSpawnTimer: 0,
    bitSpawnTimer: 0,
    score: 0,
    distanceTravelled: 0,
    laneWidth: 160,
    laneCenters: [140, 300, 460]
  });

  // Handle Lane Movement
  const moveLeft = () => {
    if (!isPlaying || isGameOver) return;
    const state = gameStateRef.current;
    if (state.lane > 0) {
      state.lane -= 1;
      state.targetLaneX = state.laneCenters[state.lane];
      playSound('flip');
    }
  };

  const moveRight = () => {
    if (!isPlaying || isGameOver) return;
    const state = gameStateRef.current;
    if (state.lane < 2) {
      state.lane += 1;
      state.targetLaneX = state.laneCenters[state.lane];
      playSound('flip');
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        moveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        moveRight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isGameOver]);

  const startGame = () => {
    playSound('click');
    const state = gameStateRef.current;
    state.lane = 1;
    state.playerX = state.laneCenters[1];
    state.targetLaneX = state.laneCenters[1];
    state.obstacles = [];
    state.bits = [];
    state.speed = 3.5;
    state.score = 0;
    state.obstacleSpawnTimer = 0;
    state.bitSpawnTimer = 0;
    state.distanceTravelled = 0;
    
    setScore(0);
    setIsGameOver(false);
    setIsPlaying(true);
  };

  // Main game animation loop
  useEffect(() => {
    if (!isPlaying || isGameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = gameStateRef.current;

    const updateAndRender = () => {
      // 1. UPDATE STATE
      const isMobile = window.innerWidth <= 768;
      // Smoothly interpolate player X coordinate to lane target (faster on mobile for high finger responsiveness)
      state.playerX += (state.targetLaneX - state.playerX) * (isMobile ? 0.35 : 0.25);
      state.distanceTravelled += state.speed * 0.1;
      
      // Gradually increase speed (slower progression and lower max speed on mobile)
      const baseSpeed = isMobile ? 3.0 : 3.5;
      const maxSpeedIncrease = isMobile ? 4.0 : 6.0;
      const speedGrowthRate = isMobile ? 0.0012 : 0.0025;
      state.speed = baseSpeed + Math.min(maxSpeedIncrease, state.distanceTravelled * speedGrowthRate);

      // Spawn obstacles (Red laser spikes)
      state.obstacleSpawnTimer -= 1;
      if (state.obstacleSpawnTimer <= 0) {
        const randLane = Math.floor(Math.random() * 3);
        state.obstacles.push({
          lane: randLane,
          x: state.laneCenters[randLane],
          y: -40,
          w: 52,
          h: 52,
          speed: state.speed
        });
        state.obstacleSpawnTimer = Math.max(30, 80 - Math.floor(state.speed * 3.5));
      }

      // Spawn bits (Blue glowing score chips)
      state.bitSpawnTimer -= 1;
      if (state.bitSpawnTimer <= 0) {
        const randLane = Math.floor(Math.random() * 3);
        // Only spawn if no obstacle is active at the very top of that lane
        const obstacleClose = state.obstacles.some(o => o.lane === randLane && o.y < 80);
        if (!obstacleClose) {
          state.bits.push({
            lane: randLane,
            x: state.laneCenters[randLane],
            y: -30,
            radius: 17,
            speed: state.speed
          });
          state.bitSpawnTimer = Math.max(40, 100 - Math.floor(state.speed * 4));
        }
      }

      // Move and filter obstacles
      state.obstacles = state.obstacles.filter(obs => {
        obs.y += obs.speed;
        
        // Collision detection (Bounding box collision - slightly forgiving hitbox on mobile)
        const playerWidth = isMobile ? 18 : 30;
        const playerHeight = isMobile ? 22 : 35;
        const collision = 
          obs.y + obs.h / 2 > state.playerY - playerHeight / 2 &&
          obs.y - obs.h / 2 < state.playerY + playerHeight / 2 &&
          Math.abs(obs.x - state.playerX) < (obs.w / 2 + playerWidth / 2);

        if (collision) {
          setIsGameOver(true);
          playSound('lose');
          if (state.score > highScore) {
            setHighScore(state.score);
            localStorage.setItem('neonrunner_highscore', state.score.toString());
          }
          return false;
        }

        return obs.y < 450;
      });

      // Move and collect bits
      state.bits = state.bits.filter(bit => {
        bit.y += bit.speed;

        // Collection detection (slightly larger collection box on mobile to make finger play easier)
        const playerWidth = isMobile ? 35 : 30;
        const playerHeight = isMobile ? 40 : 35;
        const isCollected = 
          bit.y + bit.radius > state.playerY - playerHeight / 2 &&
          bit.y - bit.radius < state.playerY + playerHeight / 2 &&
          Math.abs(bit.x - state.playerX) < (bit.radius + playerWidth / 2);

        if (isCollected) {
          state.score += 10;
          setScore(state.score);
          playSound('score');
          return false;
        }

        return bit.y < 450;
      });


      // 2. RENDERING CANVAS
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw perspective grid lines (vertical lines narrowing at top)
      ctx.strokeStyle = 'rgba(0, 255, 178, 0.08)';
      ctx.lineWidth = 2;
      const horizonY = 80;
      const bottomLines = [0, 150, 300, 450, 600];
      const topLines = [180, 240, 300, 360, 420];

      bottomLines.forEach((bx, idx) => {
        ctx.beginPath();
        ctx.moveTo(bx, canvas.height);
        ctx.lineTo(topLines[idx], horizonY);
        ctx.stroke();
      });

      // Draw scrolling horizontal grid lines
      ctx.strokeStyle = 'rgba(0, 255, 178, 0.06)';
      const offset = (state.distanceTravelled * 1.5) % 40;
      for (let y = horizonY; y < canvas.height; y += 30) {
        const shiftedY = y + offset;
        if (shiftedY < canvas.height) {
          ctx.beginPath();
          ctx.moveTo(0, shiftedY);
          ctx.lineTo(canvas.width, shiftedY);
          ctx.stroke();
        }
      }

      // Draw Horizon bar
      ctx.fillStyle = '#0b101c';
      ctx.fillRect(0, 0, canvas.width, horizonY);
      ctx.strokeStyle = 'var(--primary)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(canvas.width, horizonY);
      ctx.stroke();

      // Draw lane guidelines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      [220, 380].forEach(lx => {
        ctx.beginPath();
        ctx.moveTo(lx, canvas.height);
        ctx.lineTo(lx === 220 ? 250 : 350, horizonY);
        ctx.stroke();
      });

      // Draw obstacles (Neon red danger spikes)
      state.obstacles.forEach(obs => {
        // Perspective scaling factor
        const scale = 0.4 + (obs.y / canvas.height) * 0.6;
        const size = obs.w * scale;

        ctx.shadowBlur = 15;
        ctx.shadowColor = 'var(--accent)';
        ctx.fillStyle = 'rgba(255, 0, 127, 0.15)';
        ctx.strokeStyle = 'var(--accent)';
        ctx.lineWidth = 2.5;

        // Draw diamond shape
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - size / 2);
        ctx.lineTo(obs.x + size / 2, obs.y);
        ctx.lineTo(obs.x, obs.y + size / 2);
        ctx.lineTo(obs.x - size / 2, obs.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0; // Reset
      });

      // Draw data bits (Neon blue glowing coins)
      state.bits.forEach(bit => {
        const scale = 0.4 + (bit.y / canvas.height) * 0.6;
        const rad = bit.radius * scale;

        ctx.shadowBlur = 15;
        ctx.shadowColor = 'var(--info)';
        ctx.fillStyle = 'rgba(0, 180, 216, 0.2)';
        ctx.strokeStyle = 'var(--info)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(bit.x, bit.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(bit.x, bit.y, rad * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; // Reset
      });

      // Draw Player spaceship (Neon cyan glider)
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'var(--primary)';
      ctx.strokeStyle = 'var(--primary)';
      ctx.fillStyle = 'rgba(0, 255, 178, 0.2)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(state.playerX, state.playerY - 20); // Nose
      ctx.lineTo(state.playerX + 20, state.playerY + 15); // Bottom right wing
      ctx.lineTo(state.playerX, state.playerY + 5); // Rear center
      ctx.lineTo(state.playerX - 20, state.playerY + 15); // Bottom left wing
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Thruster flame effect
      const flameHeight = 10 + Math.random() * 8;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(state.playerX - 6, state.playerY + 8);
      ctx.lineTo(state.playerX, state.playerY + 8 + flameHeight);
      ctx.lineTo(state.playerX + 6, state.playerY + 8);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0; // Reset

      // Request next frame
      requestRef.current = requestAnimationFrame(updateAndRender);
    };

    requestRef.current = requestAnimationFrame(updateAndRender);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isGameOver]);

  const handleResetHighScore = () => {
    playSound('click');
    setHighScore(0);
    localStorage.removeItem('neonrunner_highscore');
  };

  const updatePositionFromTouch = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !e.touches || !e.touches[0]) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const scaleX = canvas.width / rect.width;
    const canvasX = touchX * scaleX;
    
    const state = gameStateRef.current;
    state.targetLaneX = Math.max(50, Math.min(550, canvasX));
  };

  const handleTouchStart = (e) => {
    if (!isPlaying || isGameOver) return;
    if (e.cancelable) e.preventDefault();
    updatePositionFromTouch(e);
  };

  const handleTouchMove = (e) => {
    if (!isPlaying || isGameOver) return;
    if (e.cancelable) e.preventDefault();
    updatePositionFromTouch(e);
  };

  return (
    <div className="runner-game-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
      <style>{`
        .runner-game-container {
          position: relative;
        }
        .runner-canvas {
          background: #060a12;
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          max-width: 100%;
          box-shadow: 0 0 25px rgba(0, 255, 178, 0.1);
        }
        .runner-dashboard {
          display: flex;
          justify-content: space-between;
          width: 600px;
          max-width: 100%;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          border: 1px solid var(--glass-border);
        }
        @media (max-width: 768px) {
          .runner-game-container {
            width: 100vw !important;
            margin-left: calc(-50vw + 50%);
            margin-right: calc(-50vw + 50%);
            padding: 0 !important;
          }
          .runner-canvas {
            width: 100% !important;
            height: auto !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
          }
          .runner-dashboard {
            width: 100% !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
          }
          .victory-modal-overlay {
            border-radius: 0 !important;
          }
          .victory-modal {
            border-radius: 0 !important;
            padding: 1.5rem !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      <div className="runner-dashboard">
        <div>Score: <strong style={{ color: 'var(--primary)' }}>{score}</strong></div>
        <div>High Score: <strong style={{ color: 'var(--info)' }}>{highScore}</strong></div>
      </div>

      <div className="canvas-wrapper-relative" style={{ position: 'relative', width: '600px', maxWidth: '100%' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="runner-canvas"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        />

        {/* Start Game screen overlay */}
        {!isPlaying && !isGameOver && (
          <div className="victory-modal-overlay" style={{ position: 'absolute', borderRadius: '12px' }}>
            <div className="victory-modal" style={{ padding: '2rem 3rem' }}>
              <div className="victory-emoji" style={{ animation: 'bounce 2.5s infinite' }}>⚡</div>
              <div className="victory-title" style={{ fontSize: '1.8rem' }}>NEON RUNNER</div>
              <div className="victory-text" style={{ fontSize: '0.95rem' }}>
                Use Left/Right arrow keys on desktop, or slide your finger left and right on mobile, to dodge red barriers and collect blue bits!
              </div>
              <button className="btn-primary" onClick={startGame}>
                Initiate Run
              </button>
              <button className="btn-secondary" onClick={handleResetHighScore} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.8rem', borderWidth: '1px' }}>
                Reset High Score
              </button>
            </div>
          </div>
        )}

        {/* Game Over screen overlay */}
        {isGameOver && (
          <div className="victory-modal-overlay" style={{ position: 'absolute', borderRadius: '12px' }}>
            <div className="victory-modal" style={{ padding: '2rem 3rem', borderColor: 'var(--accent)' }}>
              <div className="victory-emoji">💥</div>
              <div className="victory-title" style={{ fontSize: '1.8rem', color: 'var(--accent)', textShadow: '0 0 10px var(--accent-glow)' }}>RUN TERMINATED</div>
              <div className="victory-text" style={{ fontSize: '0.95rem' }}>
                You crashed! Final Score: <strong style={{ color: '#fff' }}>{score}</strong>
              </div>
              <button className="btn-primary" onClick={startGame} style={{ background: 'var(--accent)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
                Reboot System
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
