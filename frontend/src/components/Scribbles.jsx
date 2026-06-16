import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { Download, Trash2, Edit3, HelpCircle, RefreshCcw, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const COLORS = [
  '#000000', '#ffffff', '#ff007f', '#00ffb2', '#9d4edd', '#00b4d8', '#ffb703', '#d90429'
];

export default function Scribbles({ roomId, isOnline, onBack }) {
  const { user } = useAuth();
  const canvasRef = useRef(null);

  // Common states
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [prompt, setPrompt] = useState({ word: 'Loading...', hint: '', category: '' });
  const [isErasing, setIsErasing] = useState(false);

  // Online Multiplayer specific states
  const [roomData, setRoomData] = useState(null);
  const [isDrawer, setIsDrawer] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [guessText, setGuessText] = useState('');
  const [guessFeedback, setGuessFeedback] = useState('');
  const [isWon, setIsWon] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const pollTimerRef = useRef(null);
  const currentPathPointsRef = useRef([]);
  const roomDataRef = useRef(null);

  // Word selection & timers
  const [wordOptions, setWordOptions] = useState([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [totalTime, setTotalTime] = useState(90);
  const [isTimeOut, setIsTimeOut] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const getDynamicRevealText = (word, elapsed) => {
    if (!word) return "";
    const chars = word.split('');
    const midIdx = Math.floor(word.length / 2);
    
    // Collect candidate indices for random reveals (excluding index 0, midIdx, and spaces)
    const availIndices = [];
    for (let i = 0; i < word.length; i++) {
      if (i !== 0 && i !== midIdx && chars[i] !== ' ') {
        availIndices.push(i);
      }
    }
    
    // Deterministic random indices to keep them stable across renders
    const randomIdx1 = availIndices.length > 0 ? availIndices[0] : -1;
    const randomIdx2 = availIndices.length > 1 ? availIndices[availIndices.length - 1] : -1;

    // Mask string characters
    const maskedChars = chars.map((char, idx) => {
      if (char === ' ') return ' ';
      
      // Phase 1 (0 to 10s): word length blanks only
      if (elapsed <= 10) {
        return '_';
      }
      // Phase 2 (11 to 25s): first letter revealed
      if (elapsed <= 25) {
        return idx === 0 ? char : '_';
      }
      // Phase 3 (26 to 55s): first + middle letter revealed
      if (elapsed <= 55) {
        return (idx === 0 || idx === midIdx) ? char : '_';
      }
      // Phase 4 (56 to 70s): first + middle + 1st random letter
      if (elapsed <= 70) {
        return (idx === 0 || idx === midIdx || idx === randomIdx1) ? char : '_';
      }
      // Phase 5 (71 to 90s): first + middle + 1st random + 2nd random letter
      return (idx === 0 || idx === midIdx || idx === randomIdx1 || idx === randomIdx2) ? char : '_';
    });
    
    return maskedChars.join(' ');
  };

  const getDynamicHints = (wordText, categoryText, hintText, remainingTime, maxTime = 90) => {
    if (!wordText) return [];
    const elapsed = maxTime - remainingTime;
    const hints = [];
    
    // 1. Current reveal pattern
    const revealPattern = getDynamicRevealText(wordText, elapsed);
    hints.push(`Word Reveal: ${revealPattern}`);
    
    // 2. Category (revealed after 10 seconds, i.e. starting Phase 2 at 11s)
    if (elapsed >= 11) {
      hints.push(`Category: ${categoryText}`);
    }
    
    // 3. Description hint text (revealed starting Phase 5 at 71s)
    if (elapsed >= 71) {
      hints.push(`Description Clue: ${hintText}`);
    }
    
    return hints;
  };

  const handleTimeout = async () => {
    if (isTimeOut || isWon) return;
    setIsTimeOut(true);
    playSound('lose');
    
    try {
      await fetch(`http://localhost:8000/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          board_state: {
            ...roomData?.board_state,
            status: 'ended'
          },
          winner_id: 0
        })
      });
    } catch (e) {
      console.error("Timeout request failed:", e);
    }
  };

  const handleSelectWord = async (selectedPrompt) => {
    if (isPending) return;
    playSound('click');
    setIsPending(true);
    
    try {
      const nextBState = {
        ...roomData?.board_state,
        status: 'playing',
        word: selectedPrompt.word,
        hint: selectedPrompt.hint,
        category: selectedPrompt.category,
        start_time: Date.now()
      };
      
      const res = await fetch(`http://localhost:8000/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          board_state: nextBState
        })
      });
      if (res.ok) {
        fetchRoomState();
      }
    } catch (e) {
      console.error("Failed to select word:", e);
    } finally {
      setIsPending(false);
    }
  };

  // ----------------------------------------------------
  // INITIALIZATION & SINGLE-PLAYER ACTIONS
  // ----------------------------------------------------
  const fetchPrompt = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/scribbles/prompt/');
      const data = await res.json();
      setPrompt(data);
    } catch (e) {
      setPrompt({ word: 'Rocket Ship', hint: 'A vehicle used to travel to outer space.', category: 'Space' });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!isOnline) {
      fetchPrompt();
    }
  }, [isOnline]);

  // ----------------------------------------------------
  // ONLINE STATE SYNC POLLING
  // ----------------------------------------------------
  const fetchRoomState = async () => {
    if (!isOnline || !roomId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/room/${roomId}/state/`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setRoomData(data);
        roomDataRef.current = data;

        // Check if game aborted by opponent
        if (data.board_state && data.board_state.aborted) {
          setIsAborted(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          return;
        }

        // Map drawer vs guesser
        const drawerMode = data.board_state?.drawer_id === user.id;
        setIsDrawer(drawerMode);

        // Sync prompt data
        setPrompt({
          word: data.board_state?.word || '',
          hint: data.board_state?.hint || '',
          category: data.board_state?.category || ''
        });

        // Sync strokes for guesser
        if (!drawerMode) {
          const incomingStrokes = data.canvas_strokes || [];
          setStrokes(incomingStrokes);
          drawStrokesOnCanvas(incomingStrokes);
        }

        // Sync board state details: options or timers
        const bState = data.board_state || {};
        if (bState.status === 'word_selection') {
          setWordOptions(bState.word_options || []);
        } else if (bState.status === 'playing') {
          setWordOptions([]);
          
          // Fallback if start_time is missing (e.g. legacy room or direct page refresh load)
          if (!bState.start_time) {
            bState.start_time = Date.now();
            bState.time_limit = 90;
            const isDrawerUser = bState.drawer_id === user.id;
            if (isDrawerUser) {
              fetch(`http://localhost:8000/api/room/${roomId}/move/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ board_state: bState })
              }).catch(err => console.warn("Failed to set fallback start_time:", err));
            }
          }

          if (bState.start_time) {
            const timeLimit = bState.time_limit || 90;
            setTotalTime(timeLimit);
            const elapsed = Math.floor((Date.now() - bState.start_time) / 1000);
            const remaining = Math.max(0, timeLimit - elapsed);
            setTimeLeft(remaining);
            if (remaining === 0 && !bState.guessed && data.status !== 'ended') {
              handleTimeout();
            }
          }
        }

        // Check victory or timeout status
        if (data.status === 'ended') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (bState.guessed) {
            setIsWon(true);
          } else {
            setIsTimeOut(true);
          }
        } else if (bState.guessed) {
          setIsWon(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
      }
    } catch (e) {
      console.warn("Error polling scribbles state:", e);
    }
  };

  useEffect(() => {
    if (isOnline && roomId) {
      fetchRoomState();
      pollTimerRef.current = setInterval(fetchRoomState, 1500);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOnline, roomId]);

  // Tick timer locally using ref to avoid stale closures and constant interval restarts
  useEffect(() => {
    if (!isOnline) return;
    
    const timer = setInterval(() => {
      const currentRoomData = roomDataRef.current;
      const bState = currentRoomData?.board_state;
      if (!bState || bState.status !== 'playing' || !bState.start_time) return;
      
      const elapsed = Math.floor((Date.now() - bState.start_time) / 1000);
      const remaining = Math.max(0, bState.time_limit - elapsed);
      setTimeLeft(remaining);
      
      if (remaining === 0 && !bState.guessed && currentRoomData.status !== 'ended') {
        clearInterval(timer);
        handleTimeout();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isOnline, roomId, isWon, isTimeOut]);

  // Draw strokes back to canvas (for guesser)
  const drawStrokesOnCanvas = (strokeList) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear and fill white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokeList.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  };

  // ----------------------------------------------------
  // CANVAS DRAWING ACTIONS
  // ----------------------------------------------------
  const startDrawing = (e) => {
    if (isOnline && !isDrawer) return; // Only drawer can sketch
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { offsetX, offsetY } = getCoords(e);
    
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    playSound('keypress');

    currentPathPointsRef.current = [{ x: offsetX, y: offsetY }];
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (isOnline && !isDrawer) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { offsetX, offsetY } = getCoords(e);
    const strokeColor = isErasing ? '#ffffff' : color;
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();

    currentPathPointsRef.current.push({ x: offsetX, y: offsetY });
  };

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (isOnline && isDrawer) {
      // Append completed path to stroke list
      const strokeColor = isErasing ? '#ffffff' : color;
      const newStroke = {
        color: strokeColor,
        size: brushSize,
        points: currentPathPointsRef.current
      };

      const updatedStrokes = [...strokes, newStroke];
      setStrokes(updatedStrokes);

      // Post strokes to server
      try {
        await fetch(`http://localhost:8000/api/room/${roomId}/draw/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ strokes: updatedStrokes })
        });
      } catch (err) {
        console.error("Failed to post drawing strokes:", err);
      }
    }
  };

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Scale factor to map screen coordinates to internal canvas pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX - rect.left;
      clientY = e.touches[0].clientY - rect.top;
    } else {
      clientX = e.clientX - rect.left;
      clientY = e.clientY - rect.top;
    }
    
    return {
      offsetX: clientX * scaleX,
      offsetY: clientY * scaleY
    };
  };

  const clearCanvas = async () => {
    playSound('click');
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (isOnline && isDrawer) {
      setStrokes([]);
      try {
        await fetch(`http://localhost:8000/api/room/${roomId}/draw/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ strokes: [] })
        });
      } catch (err) {
        console.error("Failed to clear online canvas strokes:", err);
      }
    }
  };

  const downloadCanvas = () => {
    playSound('match');
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `scribble-${prompt.word.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // ----------------------------------------------------
  // GUESS SUBMISSION LOGIC
  // ----------------------------------------------------
  const handleGuessSubmit = async (e) => {
    e.preventDefault();
    if (!guessText.trim()) return;

    playSound('click');
    
    // Normalize string by converting to lowercase and stripping all non-alphanumeric chars (spaces, hyphens, etc.)
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const playerGuess = normalize(guessText);
    const targetWord = normalize(prompt.word);

    if (playerGuess === targetWord) {
      playSound('win');
      setGuessFeedback("Correct! You found the word!");
      
      try {
        const nextBState = {
          ...roomData.board_state,
          guessed: true,
          status: 'ended'
        };
        await fetch(`http://localhost:8000/api/room/${roomId}/move/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            board_state: nextBState,
            winner_id: user.id
          })
        });
        setIsWon(true);
      } catch (err) {
        console.error("Failed to submit correct guess move:", err);
      }
    } else {
      playSound('lose');
      setGuessFeedback(`"${guessText}" is incorrect! Keep guessing.`);
      setGuessText('');
      setTimeout(() => setGuessFeedback(''), 3000);
    }
  };

  const opponentName = isOnline && roomData
    ? (isDrawer ? roomData.player_2.name : roomData.player_1.name)
    : "Opponent";

  if (isOnline && roomData?.board_state?.status === 'word_selection') {
    return (
      <div className="scribble-layout">
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', textAlign: 'center' }}>
          Room: <span style={{ color: 'var(--primary)' }}>{roomId.substring(0, 8)}...</span> | 
          Role: <strong style={{ color: 'var(--info)' }}>{isDrawer ? "THE DRAWER 🎨" : "THE GUESSER 🔍"}</strong>
        </div>

        {isDrawer ? (
          <div className="word-selection-screen" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center', padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-neon)', borderRadius: '16px', animation: 'scaleUp 0.4s ease' }}>
            <h2 style={{ color: 'var(--primary)', textShadow: '0 0 10px var(--primary-glow)', fontSize: '1.6rem', fontWeight: 800 }}>CHOOSE YOUR SECRET PROMPT</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>Select one word from the options below. You will have 90 seconds to draw it while the guesser tries to crack it with clues unlocked over time!</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {wordOptions.map((opt, idx) => (
                <button
                  key={idx}
                  className="btn-secondary"
                  style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onClick={() => handleSelectWord(opt)}
                  disabled={isPending}
                >
                  <strong style={{ color: 'var(--primary)', fontSize: '1.15rem', textShadow: '0 0 8px var(--primary-glow)' }}>{opt.word}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category: {opt.category} • Hint: {opt.hint}</span>
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={onBack} style={{ marginTop: '1rem' }}>Exit Room</button>
          </div>
        ) : (
          <div className="word-selection-screen" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center', padding: '2.5rem', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '16px', animation: 'scaleUp 0.4s ease' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
            <h2 style={{ color: 'var(--text-muted)', fontSize: '1.3rem', fontWeight: 800 }}>ESTABLISHING LINK...</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>Waiting for the Drawer ({opponentName}) to select their secret prompt...</p>
            <button className="btn-secondary" onClick={onBack} style={{ marginTop: '1rem' }}>Exit Room</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="scribble-layout">
      {isOnline && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', textAlign: 'center' }}>
          Room: <span style={{ color: 'var(--primary)' }}>{roomId.substring(0, 8)}...</span> | 
          Role: <strong style={{ color: 'var(--info)' }}>{isDrawer ? "THE DRAWER 🎨" : "THE GUESSER 🔍"}</strong>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '600px' }}>
        <div>
          {(!isOnline || isDrawer) && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Category: {prompt.category}
            </span>
          )}
          <h2 style={{ fontSize: '1.8rem', color: 'var(--primary)', textShadow: '0 0 10px var(--primary-glow)' }}>
            {isOnline ? (isDrawer ? `Draw: "${prompt.word}"` : "Guess the Drawing!") : `Draw: "${prompt.word}"`}
          </h2>
        </div>
        {!isOnline && (
          <button className="btn-icon" onClick={fetchPrompt} title="New Prompt">
            <RefreshCcw size={20} />
          </button>
        )}
      </div>

      {(!isOnline || isDrawer) && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '600px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <HelpCircle size={16} color="var(--info)" />
          <span>Hint: {prompt.hint}</span>
        </div>
      )}

      {/* Clues board for online multiplayer */}
      {isOnline && roomData?.board_state?.status === 'playing' && (
        <div className="hints-container" style={{ width: '100%', maxWidth: '600px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px', textAlign: 'left', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>GRID CLUES</span>
            <span style={{ fontSize: '0.95rem', color: timeLeft <= 15 ? 'var(--accent)' : 'var(--primary)', fontWeight: 800, textShadow: timeLeft <= 15 ? '0 0 8px var(--accent-glow)' : '0 0 8px var(--primary-glow)' }}>Time Left: {timeLeft}s</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {getDynamicHints(prompt.word, prompt.category, prompt.hint, timeLeft, totalTime).map((h, i) => (
              <div key={i} style={{ fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--primary)' }}>&raquo;</span>
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!isOnline || isDrawer) && (
        <div className="scribble-tools">
          <div className="tool-group">
            {COLORS.map((c) => (
              <div
                key={c}
                className={`color-dot ${color === c && !isErasing ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setColor(c);
                  setIsErasing(false);
                  playSound('click');
                }}
              />
            ))}
          </div>

          <div className="tool-group">
            <button
              className={`btn-icon ${isErasing ? 'active' : ''}`}
              style={{ background: isErasing ? 'var(--primary-glow)' : 'rgba(255,255,255,0.05)', color: isErasing ? 'var(--primary)' : 'inherit' }}
              onClick={() => {
                setIsErasing(!isErasing);
                playSound('click');
              }}
              title="Eraser"
            >
              <Edit3 size={20} style={{ transform: 'rotate(180deg)' }} />
            </button>

            <button className="btn-icon" onClick={clearCanvas} title="Clear Canvas">
              <Trash2 size={20} />
            </button>

            <button className="btn-icon" onClick={downloadCanvas} title="Download Image">
              <Download size={20} />
            </button>
          </div>

          <div className="tool-group" style={{ flex: 1, minWidth: '150px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', minWidth: '40px' }}>Size: {brushSize}</span>
            <input
              type="range"
              min="2"
              max="30"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="guess-range-slider"
            />
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="canvas-element"
        style={{ pointerEvents: isOnline && !isDrawer ? 'none' : 'auto', border: isOnline && !isDrawer ? '2px solid var(--info)' : '2px dashed var(--glass-border)' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      {isOnline && !isDrawer && !isWon && !isTimeOut && (
        <form onSubmit={handleGuessSubmit} style={{ width: '100%', maxWidth: '600px', display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <input
            type="text"
            placeholder="Type your guess here..."
            value={guessText}
            onChange={(e) => setGuessText(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: '#fff', outline: 'none' }}
          />
          <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Send size={16} /> Guess
          </button>
        </form>
      )}

      {guessFeedback && (
        <div style={{ color: guessFeedback.includes('Correct') ? 'var(--primary)' : 'var(--accent)', marginTop: '0.5rem', fontWeight: 600, textShadow: '0 0 5px rgba(255,255,255,0.1)' }}>
          {guessFeedback}
        </div>
      )}

      {isOnline && (
        <button className="btn-secondary" onClick={() => onBack(false)} style={{ marginTop: '1.5rem' }}>
          Exit Room
        </button>
      )}

      {isWon && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">🎉</div>
            <div className="victory-title">Word Guessed!</div>
            <div className="victory-text">
              The secret word was indeed <strong>"{prompt.word}"</strong>! Excellent team play.
            </div>
            <button className="btn-primary" onClick={() => onBack(true)}>
              Return to Lounge
            </button>
          </div>
        </div>
      )}

      {isTimeOut && (
        <div className="victory-modal-overlay">
          <div className="victory-modal" style={{ borderColor: 'var(--accent)' }}>
            <div className="victory-emoji" style={{ animation: 'bounce 2s infinite' }}>⏰</div>
            <div className="victory-title" style={{ color: 'var(--accent)', textShadow: '0 0 10px var(--accent-glow)' }}>Time's Up!</div>
            <div className="victory-text">
              The countdown expired! The secret word was <strong>"{prompt.word}"</strong>.
            </div>
            <button className="btn-primary" style={{ background: 'var(--accent)', boxShadow: '0 4px 15px var(--accent-glow)', color: '#fff' }} onClick={() => onBack(true)}>
              Return to Lounge
            </button>
          </div>
        </div>
      )}

      {isAborted && (
        <div className="victory-modal-overlay">
          <div className="victory-modal" style={{ borderColor: 'var(--accent)' }}>
            <div className="victory-emoji">🔌</div>
            <div className="victory-title" style={{ color: 'var(--accent)', textShadow: '0 0 10px var(--accent-glow)' }}>
              Link Severed
            </div>
            <div className="victory-text">
              Your opponent has disconnected and exited the game room.
            </div>
            <button className="btn-primary" onClick={() => onBack(true)} style={{ background: 'var(--accent)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
              Return to Lounge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
