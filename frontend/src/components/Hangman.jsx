import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import { HelpCircle, RefreshCw, Trophy, Heart, Coins } from 'lucide-react';

const MAX_INCORRECT = 6;
const HANGMAN_PARTS = [
  'part-head',
  'part-body',
  'part-left-arm',
  'part-right-arm',
  'part-left-leg',
  'part-right-leg'
];

const KEYBOARD_ROWS = [
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm'
];

export default function Hangman() {
  const { user, addCoins } = useAuth();
  const [secretWord, setSecretWord] = useState('');
  const [guessedLetters, setGuessedLetters] = useState(new Set());
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState('PLAYING'); // 'PLAYING', 'WON', 'LOST'
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);

  // Fetch word from backend
  const fetchNewWord = async () => {
    setLoading(true);
    setGameState('PLAYING');
    setIncorrectGuesses(0);
    setGuessedLetters(new Set());
    
    // Stop confetti if active
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    try {
      const res = await fetch(window.API_BASE_URL + '/api/hangman/word/');
      const data = await res.json();
      if (data && data.word) {
        setSecretWord(data.word.toLowerCase());
      } else {
        throw new Error("Invalid backend word response");
      }
    } catch (e) {
      console.warn("Failed to fetch word from backend, using fallback:", e);
      const fallbacks = ["develop", "arcade", "sudoku", "runner", "platform", "connection", "keyboard"];
      setSecretWord(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewWord();
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, []);

  // Listen to physical keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'PLAYING' || loading) return;
      const key = e.key.toLowerCase();
      if (key >= 'a' && key <= 'z' && key.length === 1) {
        handleGuess(key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [secretWord, guessedLetters, incorrectGuesses, gameState, loading]);

  // Handle a guessed letter
  const handleGuess = (letter) => {
    if (guessedLetters.has(letter) || gameState !== 'PLAYING') return;

    const newGuessed = new Set(guessedLetters);
    newGuessed.add(letter);
    setGuessedLetters(newGuessed);

    if (secretWord.includes(letter)) {
      playSound('keypress');
      // Check if won
      const allGuessed = secretWord.split('').every(char => newGuessed.has(char));
      if (allGuessed) {
        setGameState('WON');
        playSound('win');
        if (addCoins) {
          addCoins(10); // Award 10 coins on victory!
        }
        startConfetti();
      }
    } else {
      playSound('error');
      const newIncorrect = incorrectGuesses + 1;
      setIncorrectGuesses(newIncorrect);
      if (newIncorrect >= MAX_INCORRECT) {
        setGameState('LOST');
        playSound('lose');
      }
    }
  };

  // Confetti Particle Effect
  const startConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resizeCanvas();

    let particles = [];
    const colors = ['#00f2fe', '#4facfe', '#ff4757', '#ff6b81', '#feca57', '#1dd1a1'];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 4 + 3,
        d: Math.random() * canvas.height,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.05 + 0.02,
        tiltAngle: 0
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;

      particles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2.5;
        p.x += Math.sin(p.tiltAngle) * 0.8;
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 12;

        if (p.y < canvas.height) active = true;

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });

      if (active) {
        animationIdRef.current = requestAnimationFrame(draw);
      }
    }

    draw();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', width: '100%', position: 'relative' }}>
      
      {/* Confetti Overlay */}
      <canvas 
        ref={canvasRef} 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10
        }}
      />

      {/* Top Banner Info */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex' }}>
            <HelpCircle size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff', fontWeight: 700 }}>HANGMAN</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Save the code before the gallows closes in
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: '6px', alignItems: 'center', gap: '0.5rem' }}>
          <Coins size={16} color="#fbbf24" />
          <span style={{ fontSize: '0.85rem' }}>Win Reward: <strong style={{ color: 'var(--primary)' }}>+10 Coins</strong></span>
        </div>
      </div>

      {/* Main Panel grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr',
        gap: '2.5rem',
        alignItems: 'center',
        background: 'rgba(22, 24, 38, 0.4)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        padding: '2.5rem',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        position: 'relative'
      }} className="hangman-grid-responsive">
        
        {/* Left Side: Visual Gallows */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <svg style={{ width: '80%', maxWidth: '240px', height: 'auto', aspectRatio: '100/120' }} viewBox="0 0 100 120">
            {/* Gallows */}
            <line style={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: '5px', strokeLinecap: 'round', fill: 'none' }} x1="10" y1="110" x2="90" y2="110" />
            <line style={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: '5px', strokeLinecap: 'round', fill: 'none' }} x1="30" y1="110" x2="30" y2="15" />
            <line style={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: '5px', strokeLinecap: 'round', fill: 'none' }} x1="30" y1="15" x2="70" y2="15" />
            <line style={{ stroke: '#dca060', strokeWidth: '3px', strokeLinecap: 'round', fill: 'none' }} x1="70" y1="15" x2="70" y2="35" />
            
            {/* Hangman Parts */}
            {/* 1. Head */}
            <circle 
              style={{
                fill: 'none', stroke: '#ff4757', strokeWidth: '4.5px', strokeLinecap: 'round',
                opacity: incorrectGuesses >= 1 ? 1 : 0, transition: 'opacity 0.4s ease'
              }} 
              cx="70" cy="45" r="10" 
            />
            {/* 2. Body */}
            <line 
              style={{
                fill: 'none', stroke: '#ff4757', strokeWidth: '4.5px', strokeLinecap: 'round',
                opacity: incorrectGuesses >= 2 ? 1 : 0, transition: 'opacity 0.4s ease'
              }} 
              x1="70" y1="55" x2="70" y2="80" 
            />
            {/* 3. Left Arm */}
            <line 
              style={{
                fill: 'none', stroke: '#ff4757', strokeWidth: '4.5px', strokeLinecap: 'round',
                opacity: incorrectGuesses >= 3 ? 1 : 0, transition: 'opacity 0.4s ease'
              }} 
              x1="70" y1="62" x2="52" y2="72" 
            />
            {/* 4. Right Arm */}
            <line 
              style={{
                fill: 'none', stroke: '#ff4757', strokeWidth: '4.5px', strokeLinecap: 'round',
                opacity: incorrectGuesses >= 4 ? 1 : 0, transition: 'opacity 0.4s ease'
              }} 
              x1="70" y1="62" x2="88" y2="72" 
            />
            {/* 5. Left Leg */}
            <line 
              style={{
                fill: 'none', stroke: '#ff4757', strokeWidth: '4.5px', strokeLinecap: 'round',
                opacity: incorrectGuesses >= 5 ? 1 : 0, transition: 'opacity 0.4s ease'
              }} 
              x1="70" y1="80" x2="55" y2="98" 
            />
            {/* 6. Right Leg */}
            <line 
              style={{
                fill: 'none', stroke: '#ff4757', strokeWidth: '4.5px', strokeLinecap: 'round',
                opacity: incorrectGuesses >= 6 ? 1 : 0, transition: 'opacity 0.4s ease'
              }} 
              x1="70" y1="80" x2="85" y2="98" 
            />
          </svg>
        </div>

        {/* Right Side: Gameplay */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          
          {/* Hearts indicator */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
            {Array.from({ length: MAX_INCORRECT }).map((_, idx) => {
              const lost = idx < incorrectGuesses;
              return (
                <Heart 
                  key={idx} 
                  size={22}
                  style={{
                    fill: lost ? '#2d3748' : '#ff4757',
                    stroke: lost ? 'transparent' : '#ff4757',
                    opacity: lost ? 0.25 : 1,
                    transform: lost ? 'scale(0.8) rotate(15deg)' : 'scale(1)',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    filter: lost ? 'none' : 'drop-shadow(0 0 5px rgba(255, 71, 87, 0.5))'
                  }}
                />
              );
            })}
          </div>

          {/* Word Slots */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', minHeight: '60px', marginBottom: '2rem' }}>
            {loading ? (
              <span style={{ color: 'var(--text-muted)' }}>Preparing secret word...</span>
            ) : (
              secretWord.split('').map((char, index) => {
                const revealed = guessedLetters.has(char);
                return (
                  <div 
                    key={index} 
                    style={{
                      width: '38px',
                      height: '48px',
                      borderBottom: `3px solid ${revealed ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: revealed ? '#fff' : 'transparent',
                      textTransform: 'uppercase',
                      transition: 'border-color 0.3s, color 0.3s'
                    }}
                  >
                    {char}
                  </div>
                );
              })
            )}
          </div>

          {/* Virtual Keyboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            {KEYBOARD_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: 'flex', gap: '5px', justifyContent: 'flex-start' }}>
                {row.split('').map((char) => {
                  const guessed = guessedLetters.has(char);
                  const correct = guessed && secretWord.includes(char);
                  const incorrect = guessed && !secretWord.includes(char);

                  return (
                    <button
                      key={char}
                      onClick={() => handleGuess(char)}
                      disabled={guessed || gameState !== 'PLAYING' || loading}
                      style={{
                        background: correct 
                          ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' 
                          : incorrect 
                            ? 'rgba(255, 71, 87, 0.12)' 
                            : 'rgba(255,255,255,0.05)',
                        border: correct 
                          ? '1px solid #00f2fe' 
                          : incorrect 
                            ? '1px solid rgba(255, 71, 87, 0.25)' 
                            : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        color: incorrect ? 'rgba(255,255,255,0.2)' : '#fff',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        width: '32px',
                        height: '38px',
                        cursor: guessed ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s',
                        userSelect: 'none',
                        boxShadow: correct ? '0 0 10px rgba(0, 242, 254, 0.35)' : 'none'
                      }}
                      className="keyboard-key"
                    >
                      {char}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Reset Buttons */}
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button 
              className="btn-secondary" 
              onClick={fetchNewWord}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={14} />
              Reset Game
            </button>
          </div>

        </div>

      </div>

      {/* EndGame Modal Overlay */}
      {gameState !== 'PLAYING' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 11, 18, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          animation: 'fadeIn 0.3s ease forwards'
        }}>
          <div style={{
            background: 'rgba(25, 28, 48, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '2.5rem',
            textAlign: 'center',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
            transform: 'scale(1)',
            animation: 'modalPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
          }}>
            <h2 style={{
              fontSize: '2.2rem',
              fontWeight: 800,
              marginBottom: '0.8rem',
              background: gameState === 'WON' 
                ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' 
                : 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              {gameState === 'WON' ? 'Victory! 🎉' : 'Game Over 💥'}
            </h2>
            
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
              {gameState === 'WON' ? 'Awesome job! You solved the secret word:' : 'You ran out of guesses! The word was:'}
              <span style={{ display: 'block', marginTop: '1rem' }}>
                <span style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  display: 'inline-block',
                  padding: '6px 16px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  {secretWord}
                </span>
              </span>
            </p>

            <button 
              className="btn-primary" 
              onClick={fetchNewWord}
              style={{
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '1.05rem',
                fontWeight: 700,
                padding: '12px 24px',
                cursor: 'pointer',
                width: '100%',
                boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)'
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations style tag */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalPop {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @media (max-width: 768px) {
          .hangman-grid-responsive {
            grid-template-columns: 1fr !important;
            padding: 1.5rem !important;
            gap: 1.5rem !important;
          }
        }
      `}</style>

    </div>
  );
}
