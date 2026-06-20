import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { HelpCircle, RefreshCw, Trophy, Flame, Zap, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MAX_ATTEMPTS = 6;
const DIGIT_LENGTH = 5;

// Helper to calculate feedback colors for each digit in a guess
const getTileFeedbacks = (guessStr, secretStr) => {
  const result = Array(DIGIT_LENGTH).fill('absent');
  const secretDigitsUsed = Array(DIGIT_LENGTH).fill(false);
  const guessDigitsUsed = Array(DIGIT_LENGTH).fill(false);

  // First pass: Find exact matches (correct)
  for (let i = 0; i < DIGIT_LENGTH; i++) {
    if (guessStr[i] === secretStr[i]) {
      result[i] = 'correct';
      secretDigitsUsed[i] = true;
      guessDigitsUsed[i] = true;
    }
  }

  // Second pass: Find partial matches (present)
  for (let i = 0; i < DIGIT_LENGTH; i++) {
    if (guessDigitsUsed[i]) continue;
    for (let j = 0; j < DIGIT_LENGTH; j++) {
      if (!secretDigitsUsed[j] && guessStr[i] === secretStr[j]) {
        result[i] = 'present';
        secretDigitsUsed[j] = true;
        break;
      }
    }
  }

  return result;
};

export default function Numberquest({ roomId, isOnline, onBack }) {
  const { user } = useAuth();

  // Mode state for offline: 'daily' or 'infinite'
  const [offlineMode, setOfflineMode] = useState('infinite');

  // Core Game States
  const [secretNumber, setSecretNumber] = useState('');
  const [guesses, setGuesses] = useState(Array(MAX_ATTEMPTS).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [isLost, setIsLost] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [showRules, setShowRules] = useState(false);

  // Local storage stats for Daily Challenge
  const [dailyStats, setDailyStats] = useState({
    played: 0,
    won: 0,
    streak: 0,
    lastPlayedDate: ''
  });

  // Online Multiplayer States
  const [roomData, setRoomData] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [isAborted, setIsAborted] = useState(false);
  const pollTimerRef = useRef(null);

  const isCodemaker = roomData && user && roomData.player_1.id === user.id;
  const isGuesser = roomData && user && roomData.player_2.id === user.id;
  const opponentName = isOnline && roomData
    ? (isCodemaker ? roomData.player_2.name : roomData.player_1.name)
    : "Opponent";

  // Generate pseudo-random daily secret number based on current date
  const getDailySecret = () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const digits = [];
    for (let i = 0; i < DIGIT_LENGTH; i++) {
      const val = Math.abs(Math.sin(hash + i) * 10000);
      digits.push(Math.floor(val) % 10);
    }
    return digits.join('');
  };

  // Generate pure random 5-digit number
  const generateRandomSecret = () => {
    const digits = [];
    for (let i = 0; i < DIGIT_LENGTH; i++) {
      digits.push(Math.floor(Math.random() * 10));
    }
    return digits.join('');
  };

  // Load stats from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('numberquest_daily_stats');
    if (saved) {
      try {
        setDailyStats(JSON.parse(saved));
      } catch (e) {
        console.warn("Failed to parse daily stats", e);
      }
    }
  }, []);

  // Offline Game launcher
  const startOfflineGame = (mode = offlineMode) => {
    playSound('click');
    setGuesses(Array(MAX_ATTEMPTS).fill(''));
    setCurrentGuess('');
    setAttempt(0);
    setIsWon(false);
    setIsLost(false);
    setFeedbackMsg('');

    if (mode === 'daily') {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
      
      // Check if already completed today
      if (dailyStats.lastPlayedDate === dateStr) {
        setFeedbackMsg("Daily Challenge already completed today!");
        setIsWon(true); // Don't allow playing
        // Load the completed game states
        const savedCompleted = localStorage.getItem(`numberquest_completed_${dateStr}`);
        if (savedCompleted) {
          try {
            const data = JSON.parse(savedCompleted);
            setGuesses(data.guesses);
            setAttempt(data.attempt);
            setIsWon(data.isWon);
            setIsLost(data.isLost);
          } catch (e) {}
        }
        return;
      }
      
      const secret = getDailySecret();
      setSecretNumber(secret);
    } else {
      const secret = generateRandomSecret();
      setSecretNumber(secret);
    }
  };

  // Start game when mode changes
  useEffect(() => {
    if (!isOnline) {
      startOfflineGame(offlineMode);
    }
  }, [offlineMode, isOnline]);

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOnline && !isGuesser) return; // Only guesser inputs keyboard
      if (isWon || isLost) return;

      const key = e.key;
      if (key === 'Backspace') {
        handleKeyPress('BACK');
      } else if (key === 'Enter') {
        handleKeyPress('ENTER');
      } else if (/^[0-9]$/.test(key)) {
        handleKeyPress(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, attempt, isWon, isLost, isOnline, isGuesser, secretNumber]);

  // Polling room state (multiplayer)
  const fetchRoomState = async () => {
    if (!isOnline || !roomId) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/state/`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setRoomData(data);

        if (data.board_state && data.board_state.aborted) {
          setIsAborted(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          return;
        }

        const bState = data.board_state || {};
        if (bState.secret) setSecretNumber(bState.secret);
        if (bState.guesses) {
          // Fill array up to MAX_ATTEMPTS
          const filledGuesses = Array(MAX_ATTEMPTS).fill('');
          bState.guesses.forEach((g, idx) => {
            filledGuesses[idx] = g;
          });
          setGuesses(filledGuesses);
          setAttempt(bState.guesses.length);
        }

        if (data.status === 'ended' || bState.status === 'ended') {
          if (data.winner_id === user.id) {
            setIsWon(true);
            setIsLost(false);
          } else if (data.winner_id === 0) {
            // Draw (not really possible in code-breaker unless tied, but handle if ended without winner)
            setIsWon(false);
            setIsLost(true);
          } else {
            setIsWon(false);
            setIsLost(true);
          }
        } else {
          setIsWon(false);
          setIsLost(false);
        }
      }
    } catch (e) {
      console.warn("Error polling room state:", e);
    }
  };

  // Start polling on mount
  useEffect(() => {
    if (isOnline && roomId) {
      fetchRoomState();
      pollTimerRef.current = setInterval(fetchRoomState, 1500);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOnline, roomId]);

  // Handle virtual key click
  const handleKeyPress = (key) => {
    if (isWon || isLost) return;
    setFeedbackMsg('');

    if (key === 'BACK') {
      setCurrentGuess(g => g.slice(0, -1));
      playSound('keypress');
    } else if (key === 'ENTER') {
      submitGuess();
    } else if (currentGuess.length < DIGIT_LENGTH) {
      setCurrentGuess(g => g + key);
      playSound('keypress');
    }
  };

  // Submit Guess
  const submitGuess = async () => {
    if (currentGuess.length < DIGIT_LENGTH) {
      playSound('error');
      setFeedbackMsg("Not enough digits!");
      return;
    }

    if (isOnline) {
      // Multiplayer Guess Submission
      const newGuessesList = [...roomData.board_state.guesses, currentGuess];
      const win = currentGuess === secretNumber;
      const lost = newGuessesList.length >= MAX_ATTEMPTS && !win;

      let winnerId = null;
      let nextStatus = 'playing';
      if (win) {
        winnerId = roomData.player_2.id; // Guesser wins
        nextStatus = 'ended';
      } else if (lost) {
        winnerId = roomData.player_1.id; // Codemaker wins
        nextStatus = 'ended';
      }

      setIsPending(true);
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            board_state: {
              ...roomData.board_state,
              guesses: newGuessesList,
              status: nextStatus
            },
            winner_id: winnerId
          })
        });
        if (res.ok) {
          setCurrentGuess('');
          fetchRoomState();
        }
      } catch (e) {
        console.error("Failed to submit guess:", e);
      } finally {
        setIsPending(false);
      }
    } else {
      // Offline Guess Submission
      const newGuesses = [...guesses];
      newGuesses[attempt] = currentGuess;
      setGuesses(newGuesses);

      if (currentGuess === secretNumber) {
        setIsWon(true);
        playSound('win');
        if (offlineMode === 'daily') {
          saveDailyStats(true, newGuesses, attempt + 1);
        }
      } else if (attempt + 1 >= MAX_ATTEMPTS) {
        setIsLost(true);
        playSound('lose');
        if (offlineMode === 'daily') {
          saveDailyStats(false, newGuesses, attempt + 1);
        }
      } else {
        setAttempt(a => a + 1);
        setCurrentGuess('');
        playSound('match');
      }
    }
  };

  // Save stats for Daily mode
  const saveDailyStats = (won, finalGuesses, finalAttempt) => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    
    // Save completion state for restoring later
    localStorage.setItem(`numberquest_completed_${dateStr}`, JSON.stringify({
      guesses: finalGuesses,
      attempt: finalAttempt,
      isWon: won,
      isLost: !won
    }));

    const newStats = {
      played: dailyStats.played + 1,
      won: dailyStats.won + (won ? 1 : 0),
      streak: won ? dailyStats.streak + 1 : 0,
      lastPlayedDate: dateStr
    };

    setDailyStats(newStats);
    localStorage.setItem('numberquest_daily_stats', JSON.stringify(newStats));
  };

  // Codemaker Target submit
  const handleTargetSubmit = async (e) => {
    e.preventDefault();
    if (secretInput.length !== DIGIT_LENGTH || !/^\d+$/.test(secretInput)) {
      playSound('error');
      alert(`Please input a valid ${DIGIT_LENGTH}-digit code.`);
      return;
    }

    playSound('click');
    setIsPending(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          board_state: {
            secret: secretInput,
            guesses: [],
            status: 'playing',
            codemaker_id: roomData.player_1.id,
            guesser_id: roomData.player_2.id
          }
        })
      });
      if (res.ok) {
        fetchRoomState();
      }
    } catch (e) {
      console.error("Failed to initialize secret:", e);
    } finally {
      setIsPending(false);
    }
  };

  // Reset Match (Multiplayer)
  const handleOnlineReset = async () => {
    playSound('click');
    setIsPending(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_reset: true })
      });
      if (res.ok) {
        setIsWon(false);
        setIsLost(false);
        setSecretInput('');
        fetchRoomState();
      }
    } catch (e) {
      console.error("Failed to reset game:", e);
    } finally {
      setIsPending(false);
    }
  };

  // Helper to get letter color logic for virtual keypad
  const getKeyStatus = (key) => {
    let status = '';
    guesses.forEach(g => {
      if (!g) return;
      for (let i = 0; i < g.length; i++) {
        if (g[i] === key) {
          if (secretNumber[i] === key) {
            status = 'correct';
          } else if (secretNumber.includes(key) && status !== 'correct') {
            status = 'present';
          } else if (status !== 'correct' && status !== 'present') {
            status = 'absent';
          }
        }
      }
    });
    return status;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', width: '100%' }}>
      
      {/* Top Banner & Info */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex' }}>
            <Trophy size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff', fontWeight: 700 }}>NUMBER QUEST</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isOnline ? `Multiplayer Duel vs ${opponentName}` : `${offlineMode === 'daily' ? 'Daily Challenge' : 'Infinite Practice'}`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn-icon" onClick={() => setShowRules(r => !r)} title="How to play">
            <HelpCircle size={18} />
          </button>
          {!isOnline && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '2px', border: '1px solid var(--glass-border)' }}>
              <button 
                onClick={() => setOfflineMode('infinite')}
                style={{
                  padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: 'none', borderRadius: '4px',
                  background: offlineMode === 'infinite' ? 'var(--primary)' : 'transparent',
                  color: offlineMode === 'infinite' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: '0.2s'
                }}
              >
                Infinite
              </button>
              <button 
                onClick={() => setOfflineMode('daily')}
                style={{
                  padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: 'none', borderRadius: '4px',
                  background: offlineMode === 'daily' ? 'var(--primary)' : 'transparent',
                  color: offlineMode === 'daily' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: '0.2s',
                  display: 'flex', alignItems: 'center', gap: '0.2rem'
                }}
              >
                <Flame size={12} color="#f97316" /> Daily
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rules Overlay */}
      {showRules && (
        <div className="victory-modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowRules(false)}>
          <div className="victory-modal" style={{ maxWidth: '420px', textAlign: 'left' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>How To Play</h3>
              <button className="btn-icon" onClick={() => setShowRules(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
              Crack the secret <strong>5-digit code</strong> in 6 attempts! Each digit can be between 0 and 9.
            </p>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
              After each guess, the tile background colors change to reveal how close you are:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ width: '32px', height: '32px', background: '#15803d', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>5</div>
                <span style={{ fontSize: '0.8rem' }}>Green: Correct digit in the exact spot.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ width: '32px', height: '32px', background: '#a16207', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</div>
                <span style={{ fontSize: '0.8rem' }}>Yellow: Digit is in the code, but wrong spot.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ width: '32px', height: '32px', background: '#374151', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>9</div>
                <span style={{ fontSize: '0.8rem' }}>Grey: Digit is not present in the code.</span>
              </div>
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowRules(false)}>Got It!</button>
          </div>
        </div>
      )}

      {/* Main Grid View */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
        
        {/* Aborted Message */}
        {isAborted && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent)' }}>
            <h3>Match Aborted</h3>
            <p>Opponent has left the game room.</p>
            <button className="btn-secondary" onClick={() => onBack(true)}>Return to Lobby</button>
          </div>
        )}

        {/* Online Setting Mode */}
        {isOnline && roomData && roomData.board_state && roomData.board_state.status === 'setting' && !isAborted && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '360px', padding: '2rem 1rem' }}>
            {isCodemaker ? (
              <form onSubmit={handleTargetSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
                <h3 style={{ margin: 0, textAlign: 'center', color: 'var(--primary)' }}>Initialize Secret Code</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Input a secret 5-digit code for <strong>{opponentName}</strong> to crack!
                </p>
                <input 
                  type="password"
                  maxLength={DIGIT_LENGTH}
                  pattern="\d*"
                  placeholder="e.g. 48391"
                  value={secretInput}
                  onChange={e => setSecretInput(e.target.value.replace(/\D/g, '').slice(0, DIGIT_LENGTH))}
                  style={{
                    letterSpacing: '8px', fontSize: '1.8rem', textAlign: 'center', padding: '0.6rem',
                    background: 'rgba(0,0,0,0.3)', border: '2px solid var(--glass-border)', color: '#fff', borderRadius: '8px',
                    width: '100%', maxWidth: '200px'
                  }}
                  autoFocus
                />
                <button type="submit" className="btn-primary" disabled={isPending || secretInput.length !== DIGIT_LENGTH} style={{ width: '100%', marginTop: '0.5rem' }}>
                  Set Code & Start Match
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
                <RefreshCw size={40} className="spin-animation" style={{ color: 'var(--primary)' }} />
                <h3>Waiting for Opponent</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>{opponentName}</strong> is setting a 5-digit secret code. Prepare your guessing grid!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Playable Grid */}
        {(!isOnline || (roomData && roomData.board_state && roomData.board_state.status !== 'setting')) && !isAborted && (
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: '2rem', width: '100%', alignItems: 'flex-start' }}>
            
            {/* Left side: Grid & Keys */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', flex: '1 1 300px', maxWidth: '360px', width: '100%' }}>
              
              {/* Multiplayer Live Status Banners */}
              {isOnline && isCodemaker && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#60a5fa', padding: '0.6rem 1rem', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', width: '100%' }}>
                  🛡️ You are the <strong>Codemaker</strong>. Secret Code is: <strong style={{ color: '#fff', letterSpacing: '2px' }}>{secretNumber}</strong>. Watching opponent's guesses live...
                </div>
              )}

              <div className="wordle-board" style={{ maxWidth: '300px', width: '100%' }}>
                {guesses.map((guess, rIndex) => {
                  const isCurrentRow = rIndex === attempt;
                  const displayStr = isCurrentRow ? currentGuess.padEnd(DIGIT_LENGTH, ' ') : guess.padEnd(DIGIT_LENGTH, ' ');
                  const feedbacks = isCurrentRow || rIndex > attempt ? [] : getTileFeedbacks(guess, secretNumber);
                  
                  return (
                    <div key={rIndex} className="wordle-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                      {Array.from(displayStr).map((char, cIndex) => {
                        const status = feedbacks[cIndex] || '';
                        return (
                          <div 
                            key={cIndex} 
                            className={`wordle-tile ${status}`}
                            style={{
                              fontSize: '1.6rem',
                              aspectRatio: '1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              borderRadius: '6px',
                              background: status === 'correct' ? '#15803d' : status === 'present' ? '#a16207' : status === 'absent' ? '#374151' : 'rgba(255,255,255,0.02)',
                              border: status ? 'none' : '2px solid var(--glass-border)'
                            }}
                          >
                            {char.trim()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {feedbackMsg && (
                <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {feedbackMsg}
                </span>
              )}

              {/* Guesser Keypad (Only show to Guesser in multiplayer, or always in offline) */}
              {(!isOnline || isGuesser) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', maxWidth: '320px', marginTop: '0.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                    {['1', '2', '3', '4', '5'].map((key) => {
                      const status = getKeyStatus(key);
                      return (
                        <button
                          key={key}
                          onClick={() => handleKeyPress(key)}
                          style={{
                            background: status === 'correct' ? '#15803d' : status === 'present' ? '#a16207' : status === 'absent' ? '#374151' : 'rgba(255,255,255,0.06)',
                            color: '#fff', border: 'none', borderRadius: '6px', padding: '0.8rem 0.3rem', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                          }}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                    {['6', '7', '8', '9', '0'].map((key) => {
                      const status = getKeyStatus(key);
                      return (
                        <button
                          key={key}
                          onClick={() => handleKeyPress(key)}
                          style={{
                            background: status === 'correct' ? '#15803d' : status === 'present' ? '#a16207' : status === 'absent' ? '#374151' : 'rgba(255,255,255,0.06)',
                            color: '#fff', border: 'none', borderRadius: '6px', padding: '0.8rem 0.3rem', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                          }}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <button
                      onClick={() => handleKeyPress('BACK')}
                      style={{
                        background: 'rgba(255,255,255,0.06)', color: 'var(--accent)', border: 'none', borderRadius: '6px', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                      }}
                    >
                      BACK
                    </button>
                    <button
                      onClick={() => handleKeyPress('ENTER')}
                      style={{
                        background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                      }}
                    >
                      ENTER
                    </button>
                  </div>
                </div>
              )}

              {/* Codemaker Waiting Message */}
              {isOnline && isCodemaker && !isWon && !isLost && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center', marginTop: '1rem' }}>
                  <RefreshCw size={24} className="spin-animation" style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Waiting for <strong>{opponentName}</strong> to make a guess...
                  </span>
                </div>
              )}
            </div>

            {/* Right side: Color Guide */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.2rem', borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', maxWidth: '280px', flex: '1 1 240px',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(4px)', width: '100%', marginTop: '1rem'
            }}>
              <h4 style={{ margin: 0, color: 'var(--primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800 }}>Color Code Key</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ width: '28px', height: '28px', background: '#15803d', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>G</div>
                  <span style={{ fontSize: '0.75rem', color: '#fff', lineHeight: '1.4' }}>Correct digit in the exact spot.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ width: '28px', height: '28px', background: '#a16207', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>Y</div>
                  <span style={{ fontSize: '0.75rem', color: '#fff', lineHeight: '1.4' }}>Digit is in the code, but wrong spot.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ width: '28px', height: '28px', background: '#374151', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>X</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>Digit is not present in the code.</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Victory / Defeat Modal */}
      {(isWon || isLost) && (
        <div className="victory-modal-overlay" style={{ zIndex: 1001 }}>
          <div className="victory-modal">
            <div className="victory-emoji">{isWon ? '🎉' : '💀'}</div>
            <div className="victory-title">
              {isOnline 
                ? (isWon ? "Victory!" : "Defeat!") 
                : (isWon ? "Target Cracked!" : "System Lockout")}
            </div>
            
            <div className="victory-text" style={{ marginBottom: '1.2rem' }}>
              {isOnline ? (
                <span>
                  {isWon 
                    ? `Success! You cracked ${opponentName}'s code in ${attempt} guesses!` 
                    : `${opponentName} successfully defended their code!`}
                  <br />
                  Secret Code was: <strong style={{ letterSpacing: '2px', color: 'var(--primary)' }}>{secretNumber}</strong>
                </span>
              ) : (
                <span>
                  {isWon 
                    ? `You successfully solved the Number Quest in ${attempt} guesses!` 
                    : `The correct target code was: ${secretNumber}`}
                </span>
              )}
            </div>

            {/* Daily stats view */}
            {!isOnline && offlineMode === 'daily' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', width: '100%', marginBottom: '1.2rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>{dailyStats.played}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Played</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {dailyStats.played > 0 ? Math.round((dailyStats.won / dailyStats.played) * 100) : 0}%
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Win %</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                    <Flame size={16} fill="#f97316" /> {dailyStats.streak}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Streak</div>
                </div>
              </div>
            )}

            {/* Reset / Action Buttons */}
            {isOnline ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
                <button className="btn-primary" onClick={handleOnlineReset} disabled={isPending}>
                  {isPending ? "Resetting..." : "Play Next Round"}
                </button>
                <button className="btn-secondary" onClick={() => onBack(true)}>
                  Exit Room
                </button>
              </div>
            ) : (
              <button 
                className="btn-primary" 
                onClick={() => startOfflineGame(offlineMode)}
                disabled={offlineMode === 'daily' && dailyStats.lastPlayedDate === `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`}
              >
                {offlineMode === 'daily' ? 'Come Back Tomorrow' : 'Play Again'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
