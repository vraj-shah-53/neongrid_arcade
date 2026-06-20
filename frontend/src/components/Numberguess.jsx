import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { HelpCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Numberguess({ roomId, isOnline, onBack }) {
  const { user, addCoins } = useAuth();

  // Offline/AI Mode States
  const [maxRange, setMaxRange] = useState(100);
  const [targetNumber, setTargetNumber] = useState(50);
  const [guess, setGuess] = useState('');
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Pick a number and make a guess!");
  const [diffPercent, setDiffPercent] = useState(0); // 0 (cold) to 100 (hot)
  const [isWon, setIsWon] = useState(false);

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

  // ----------------------------------------------------
  // OFFLINE GAME LAUNCH
  // ----------------------------------------------------
  const startNewGame = (newMax = maxRange) => {
    playSound('click');
    const rand = Math.floor(Math.random() * newMax) + 1;
    setTargetNumber(rand);
    setGuess('');
    setHistory([]);
    setStatus(`Guess a number between 1 and ${newMax}!`);
    setDiffPercent(0);
    setIsWon(false);
  };

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
        setSecretInput('');
        fetchRoomState();
      }
    } catch (e) {
      console.error("Failed to reset online Numberguess game:", e);
    } finally {
      setIsPending(false);
    }
  };

  const handleRangeChange = (e) => {
    const val = parseInt(e.target.value);
    setMaxRange(val);
    startNewGame(val);
  };

  useEffect(() => {
    if (!isOnline) {
      startNewGame();
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOnline]);

  // Offline Submission
  const handleOfflineGuessSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(guess);
    if (isNaN(num) || num < 1 || num > maxRange) {
      playSound('error');
      setStatus(`Please enter a valid number between 1 and ${maxRange}.`);
      return;
    }

    playSound('click');
    const difference = Math.abs(num - targetNumber);
    const pct = Math.max(0, 100 - (difference / maxRange) * 250);
    setDiffPercent(pct);

    const newHistory = [{ guess: num, diff: difference }, ...history];
    setHistory(newHistory);

    if (num === targetNumber) {
      setStatus("Correct!");
      setIsWon(true);
      playSound('win');
      if (newHistory.length <= 3 && addCoins) {
        addCoins(3);
        setStatus("Correct! 🪙 Earned 3 Neon Coins!");
      }
    } else {
      const hint = num < targetNumber ? "Too Low!" : "Too High!";
      setStatus(`${hint} (${difference > maxRange * 0.15 ? "Cold ❄️" : "Hot 🔥"})`);
      playSound('flip');
    }
    setGuess('');
  };

  // ----------------------------------------------------
  // ONLINE GAME STATE SYNC POLLING
  // ----------------------------------------------------
  const fetchRoomState = async () => {
    if (!isOnline || !roomId) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/state/`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setRoomData(data);

        // Check if game aborted by opponent
        if (data.board_state && data.board_state.aborted) {
          setIsAborted(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          return;
        }
 
        const bState = data.board_state || {};
        const currentIsCodemaker = data && user && data.player_1 && data.player_1.id === user.id;
        const isCurrentlySetting = currentIsCodemaker && (data.status === 'setting' || bState.status === 'setting');
        if (bState.max_range && !isCurrentlySetting) setMaxRange(bState.max_range);
        if (bState.target) setTargetNumber(bState.target);
        if (bState.guesses) {
          setHistory(bState.guesses);
          if (bState.guesses.length > 0) {
            setDiffPercent(bState.guesses[0].diffPercent || 0);
          }
        }

        if (data.status === 'ended' || bState.status === 'ended') {
          setIsWon(true);
          setStatus("Target Acquired!");
        } else {
          setIsWon(false);
          if (bState.status === 'playing') {
            setStatus("Seek out the secret number!");
          } else {
            setStatus("Waiting for target initialization...");
          }
        }
      }
    } catch (e) {
      console.warn("Error polling number guess room:", e);
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

  // Online Target Initializer (by Codemaker)
  const handleOnlineTargetSubmit = async (e) => {
    e.preventDefault();
    const val = parseInt(secretInput);
    if (isNaN(val) || val < 1 || val > maxRange) {
      playSound('error');
      alert(`Please input a valid target number between 1 and ${maxRange}`);
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
            target: val,
            max_range: maxRange,
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
    } catch (err) {
      console.error("Failed to post secret target:", err);
    } finally {
      setIsPending(false);
    }
  };

  // Online Guess Submit (by Guesser)
  const handleOnlineGuessSubmit = async (e) => {
    e.preventDefault();
    const num = parseInt(guess);
    if (isNaN(num) || num < 1 || num > maxRange) {
      playSound('error');
      setStatus(`Please enter a valid guess between 1 and ${maxRange}.`);
      return;
    }

    playSound('click');
    setIsPending(true);

    const difference = Math.abs(num - targetNumber);
    const pct = Math.max(0, 100 - (difference / maxRange) * 250);
    setDiffPercent(pct);

    const isMatch = num === targetNumber;
    const directionHint = num < targetNumber ? "Too Low!" : "Too High!";
    const distanceHint = difference > maxRange * 0.15 ? "Cold ❄️" : "Hot 🔥";
    const feedbackText = isMatch ? "Correct!" : `${directionHint} (${distanceHint})`;

    const newGuesses = [{
      guess: num,
      diff: difference,
      diffPercent: pct,
      hint: feedbackText
    }, ...history];

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          board_state: {
            target: targetNumber,
            max_range: maxRange,
            guesses: newGuesses,
            status: isMatch ? 'ended' : 'playing',
            codemaker_id: roomData.player_1.id,
            guesser_id: roomData.player_2.id
          },
          winner_id: isMatch ? roomData.player_2.id : null
        })
      });

      if (res.ok) {
        if (isMatch) {
          playSound('win');
        } else {
          playSound('flip');
        }
        setGuess('');
        fetchRoomState();
      }
    } catch (err) {
      console.error("Failed to post guess:", err);
    } finally {
      setIsPending(false);
    }
  };

  // Binary search steps remaining estimation
  const estimateStepsLeft = () => {
    const totalBinarySteps = Math.ceil(Math.log2(maxRange));
    return Math.max(1, totalBinarySteps - history.length);
  };

  // ----------------------------------------------------
  // VIEWS RENDERING
  // ----------------------------------------------------
  if (isOnline && roomData?.board_state?.status === 'setting') {
    return (
      <div className="guess-container" style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Room: <span style={{ color: 'var(--primary)' }}>{roomId.substring(0, 8)}...</span>
        </div>
        
        {isCodemaker ? (
          <form onSubmit={handleOnlineTargetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '350px' }}>
            <h2 style={{ color: 'var(--primary)', textShadow: '0 0 10px var(--primary-glow)' }}>SET SECRET TARGET</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Choose the max range and target number for your opponent to guess!</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Max Range Limit:</span>
                <strong style={{ color: '#fff' }}>{maxRange}</strong>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                step="50"
                value={maxRange}
                onChange={(e) => setMaxRange(parseInt(e.target.value))}
                className="guess-range-slider"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target Number (1 to {maxRange})</label>
              <input
                type="number"
                min="1"
                max={maxRange}
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="e.g. 42"
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--glass-border)',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  outline: 'none'
                }}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '0.8rem' }} disabled={isPending}>
              {isPending ? 'INITIALIZING...' : 'LOCK SECRET TARGET'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ color: 'var(--text-muted)' }}>Waiting for Codemaker ({opponentName}) to choose target number...</h3>
            <button className="btn-secondary" onClick={onBack} style={{ marginTop: '1rem' }}>Exit Room</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="guess-container">
      {isOnline && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', width: '100%', textAlign: 'center', marginBottom: '0.5rem' }}>
          Room: <span style={{ color: 'var(--primary)' }}>{roomId.substring(0, 8)}...</span> | 
          Duel: <span style={{ color: '#fff' }}>{roomData?.player_1.name} (Codemaker)</span> vs <span style={{ color: '#fff' }}>{roomData?.player_2.name} (Guesser)</span>
        </div>
      )}

      {/* Range controls (only active in offline mode) */}
      {!isOnline ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Set Max Range: <strong>{maxRange}</strong></span>
            <span>Theoretical Binary Steps: <strong>{Math.ceil(Math.log2(maxRange))}</strong></span>
          </div>
          <input
            type="range"
            min="50"
            max="1000"
            step="50"
            value={maxRange}
            onChange={handleRangeChange}
            className="guess-range-slider"
            disabled={isWon}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          <span>Search Bounds: <strong>1 to {maxRange}</strong></span>
          {isCodemaker && <span>Target Lock: <strong style={{ color: 'var(--accent)' }}>{targetNumber}</strong></span>}
        </div>
      )}

      {/* Thermometer closeness bar */}
      <div className="thermometer-container" style={{ marginTop: '0.5rem' }}>
        <div
          className="thermometer-bar"
          style={{
            width: `${diffPercent}%`,
            backgroundColor: diffPercent > 70 ? 'var(--accent)' : diffPercent > 40 ? '#ffb703' : 'var(--info)'
          }}
        />
      </div>

      {/* Guess submission forms */}
      {isOnline ? (
        isGuesser ? (
          <form onSubmit={handleOnlineGuessSubmit} style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <input
              type="number"
              min="1"
              max={maxRange}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Enter your guess..."
              style={{
                flex: 1,
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1.2rem',
                padding: '0.8rem 1.2rem',
                outline: 'none'
              }}
              disabled={isWon || isPending}
              required
            />
            <button type="submit" className="btn-primary" disabled={isWon || isPending}>
              Guess
            </button>
          </form>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '1.05rem', padding: '0.5rem 0', fontWeight: 600 }}>
            {isWon ? "Target cracked!" : "Opponent is currently making guesses..."}
          </div>
        )
      ) : (
        <form onSubmit={handleOfflineGuessSubmit} style={{ display: 'flex', gap: '1rem', width: '100%' }}>
          <input
            type="number"
            min="1"
            max={maxRange}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Enter your guess..."
            style={{
              flex: 1,
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1.2rem',
              padding: '0.8rem 1.2rem',
              outline: 'none'
            }}
            disabled={isWon}
            required
          />
          <button type="submit" className="btn-primary" disabled={isWon}>
            Guess
          </button>
        </form>
      )}

      <h3 style={{
        color: isWon ? 'var(--primary)' : 'inherit',
        textShadow: isWon ? '0 0 10px var(--primary-glow)' : 'none',
        marginTop: '0.5rem',
        fontSize: '1.2rem'
      }}>
        {isOnline 
          ? (history.length > 0 ? history[0].hint : status)
          : status
        }
      </h3>

      {/* History logs */}
      {history.length > 0 && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            <span>Guesses Made: <strong>{history.length}</strong></span>
            {!isOnline && <span>Est. Binary Steps Remaining: <strong>{estimateStepsLeft()}</strong></span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '100px', overflowY: 'auto' }}>
            {history.map((h, i) => (
              <span
                key={i}
                style={{
                  padding: '0.3rem 0.6rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}
              >
                {h.guess} {isOnline ? '' : `(${h.guess < targetNumber ? 'L' : 'H'})`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reset/Back buttons */}
      <div style={{ marginTop: '1.5rem' }}>
        {isOnline ? (
          <button className="btn-secondary" onClick={() => onBack(false)}>
            Exit Room
          </button>
        ) : (
          <button className="btn-secondary" onClick={() => startNewGame()}>
            Reset Game
          </button>
        )}
      </div>

      {isWon && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">🎯</div>
            <div className="victory-title">Target Acquired!</div>
            <div className="victory-text">
              {isOnline ? (
                isGuesser 
                  ? `You successfully cracked ${opponentName}'s secret number ${targetNumber} in ${history.length} attempts!`
                  : `${opponentName} successfully cracked your secret number ${targetNumber} in ${history.length} attempts!`
              ) : (
                `You guessed the number ${targetNumber} correctly in ${history.length} attempts!`
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
              {isOnline ? (
                <>
                  <button className="btn-primary" onClick={handleOnlineReset} disabled={isPending} style={{ flex: 1 }}>
                    {isPending ? 'Resetting...' : 'Play Again'}
                  </button>
                  <button className="btn-secondary" onClick={() => onBack(true)} style={{ flex: 1 }}>
                    Exit Room
                  </button>
                </>
              ) : (
                <button className="btn-primary" onClick={() => startNewGame()} style={{ width: '100%' }}>
                  Play Again
                </button>
              )}
            </div>
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
