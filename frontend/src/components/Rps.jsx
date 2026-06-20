import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { useAuth } from '../context/AuthContext';

const OPTIONS = [
  { name: 'Rock', emoji: '✊', beats: 'Scissors' },
  { name: 'Paper', emoji: '✋', beats: 'Rock' },
  { name: 'Scissors', emoji: '✌️', beats: 'Paper' }
];

export default function Rps({ roomId, isOnline, onBack }) {
  const { user, addCoins } = useAuth();

  // Local/AI Mode States
  const [userChoice, setUserChoice] = useState(null);
  const [cpuChoice, setCpuChoice] = useState(null);
  const [result, setResult] = useState("Choose your fighter!");
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState([]);

  // Online Multiplayer States
  const [roomData, setRoomData] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const pollTimerRef = useRef(null);

  const isPlayer1 = roomData && user && roomData.player_1.id === user.id;
  const isPlayer2 = roomData && user && roomData.player_2.id === user.id;
  const opponentName = isOnline && roomData
    ? (isPlayer1 ? roomData.player_2.name : roomData.player_1.name)
    : "Opponent";

  // Check choices from roomData
  const myChoiceName = roomData?.board_state?.choices?.[String(user?.id)] || null;
  const myChoice = OPTIONS.find(o => o.name === myChoiceName);

  const oppId = roomData ? (isPlayer1 ? roomData.player_2.id : roomData.player_1.id) : null;
  const oppChoiceName = roomData?.board_state?.choices?.[String(oppId)] || null;
  const oppChoice = OPTIONS.find(o => o.name === oppChoiceName);

  const bothSelected = myChoiceName && oppChoiceName;

  // ----------------------------------------------------
  // ONLINE GAME STATE POLLING
  // ----------------------------------------------------
  const fetchRoomState = async () => {
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

        // If both selected and game is ended, calculate result message locally
        const choices = data.board_state.choices || {};
        const p1IdStr = String(data.player_1.id);
        const p2IdStr = String(data.player_2.id);

        if (choices[p1IdStr] && choices[p2IdStr]) {
          const c1 = OPTIONS.find(o => o.name === choices[p1IdStr]);
          const c2 = OPTIONS.find(o => o.name === choices[p2IdStr]);
          
          if (c1.name === c2.name) {
            setResult("It's a Tie!");
          } else if (c1.beats === c2.name) {
            setResult(`${data.player_1.name} Wins!`);
          } else {
            setResult(`${data.player_2.name} Wins!`);
          }
        } else {
          setResult("Awaiting choice submissions...");
        }
      }
    } catch (e) {
      console.warn("Error polling RPS state:", e);
    }
  };

  useEffect(() => {
    if (isOnline && roomId) {
      fetchRoomState();
      pollTimerRef.current = setInterval(fetchRoomState, 1200);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOnline, roomId]);

  // Offline handler
  const handleOfflineChoice = (playerSelection) => {
    playSound('click');
    const cpuSelection = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
    setUserChoice(playerSelection);
    setCpuChoice(cpuSelection);

    if (playerSelection.name === cpuSelection.name) {
      setResult("It's a Tie!");
      setHistory(h => ["Tie", ...h].slice(0, 5));
    } else if (playerSelection.beats === cpuSelection.name) {
      setResult("You Win!");
      setStreak(s => {
        const next = s + 1;
        if (next === 5 && addCoins) {
          addCoins(5);
          setResult("You Win! 🪙 Earned 5 Neon Coins!");
        }
        return next;
      });
      setHistory(h => ["Win", ...h].slice(0, 5));
      playSound('match');
    } else {
      setResult("CPU Wins!");
      setStreak(0);
      setHistory(h => ["Lose", ...h].slice(0, 5));
      playSound('lose');
    }
  };

  // Online handler
  const handleOnlineChoice = async (option) => {
    if (myChoiceName || isPending) return; // Already chose

    playSound('click');
    setIsPending(true);

    const currentChoices = roomData?.board_state?.choices || {};
    const newChoices = {
      ...currentChoices,
      [String(user.id)]: option.name
    };

    // Check if we are second player to select
    const p1Id = roomData.player_1.id;
    const p2Id = roomData.player_2.id;
    const p1Choice = newChoices[String(p1Id)];
    const p2Choice = newChoices[String(p2Id)];
    
    const isBothSelected = p1Choice && p2Choice;
    let winnerId = null;

    if (isBothSelected) {
      const c1 = OPTIONS.find(o => o.name === p1Choice);
      const c2 = OPTIONS.find(o => o.name === p2Choice);
      if (c1.name === c2.name) {
        winnerId = 0; // Tie
      } else if (c1.beats === c2.name) {
        winnerId = p1Id;
      } else {
        winnerId = p2Id;
      }
    }

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          board_state: { choices: newChoices, status: isBothSelected ? 'ended' : 'playing' },
          winner_id: winnerId
        })
      });
      if (res.ok) {
        if (isBothSelected) {
          playSound(winnerId === user.id ? 'win' : winnerId === 0 ? 'match' : 'lose');
        }
        fetchRoomState();
      }
    } catch (err) {
      console.error("RPS online move failed", err);
    } finally {
      setIsPending(false);
    }
  };

  const handleResetOnline = async () => {
    playSound('click');
    setIsPending(true);
    try {
      await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_reset: true })
      });
      setResult("Awaiting choices...");
      fetchRoomState();
    } catch (err) {
      console.error("RPS reset failed", err);
    } finally {
      setIsPending(false);
    }
  };

  const handleResetOffline = () => {
    setUserChoice(null);
    setCpuChoice(null);
    setResult("Choose your fighter!");
  };

  return (
    <div className="rps-container">
      {isOnline && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Room: <span style={{ color: 'var(--primary)' }}>{roomId.substring(0, 8)}...</span> | 
          Combat: <span style={{ color: '#fff' }}>{roomData?.player_1.name}</span> vs <span style={{ color: '#fff' }}>{roomData?.player_2.name}</span>
        </div>
      )}

      {!isOnline && (
        <div className="memory-stats">
          <span>Win Streak: <strong>{streak}</strong></span>
        </div>
      )}

      {isOnline ? (
        <div className="rps-showdown">
          <div className="rps-fighter">
            <div className="rps-fighter-icon">
              {myChoice ? myChoice.emoji : '❓'}
            </div>
            <span>You ({myChoiceName ? "READY" : "CHOOSING"})</span>
          </div>
          
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>VS</div>

          <div className="rps-fighter">
            <div className="rps-fighter-icon">
              {bothSelected && oppChoice ? oppChoice.emoji : '❓'}
            </div>
            <span>{opponentName} ({oppChoiceName ? "READY" : "CHOOSING"})</span>
          </div>
        </div>
      ) : (
        <div className="rps-showdown">
          <div className="rps-fighter">
            <div className="rps-fighter-icon">
              {userChoice ? userChoice.emoji : '❓'}
            </div>
            <span>You</span>
          </div>
          
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>VS</div>

          <div className="rps-fighter">
            <div className="rps-fighter-icon">
              {cpuChoice ? cpuChoice.emoji : '❓'}
            </div>
            <span>CPU</span>
          </div>
        </div>
      )}

      <h2 style={{ 
        color: result.includes('Win') || result.includes('You') ? 'var(--primary)' : result.includes('CPU') || result.includes('lost') ? 'var(--accent)' : 'inherit', 
        textShadow: '0 0 10px rgba(255,255,255,0.1)',
        marginTop: '1rem',
        fontSize: '1.4rem'
      }}>
        {result}
      </h2>

      <div className="rps-choices">
        {OPTIONS.map((option) => (
          <button
            key={option.name}
            className={`rps-btn ${(isOnline && myChoiceName) ? 'disabled' : ''}`}
            onClick={() => isOnline ? handleOnlineChoice(option) : handleOfflineChoice(option)}
            disabled={isOnline && myChoiceName}
          >
            {option.emoji}
            <span>{option.name}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        {isOnline ? (
          <>
            {bothSelected && (
              <button className="btn-primary" onClick={handleResetOnline} disabled={isPending}>
                Next Round
              </button>
            )}
            <button className="btn-secondary" onClick={() => onBack(bothSelected)}>
              Exit Room
            </button>
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={handleResetOffline}>
              Reset Round
            </button>
          </>
        )}
      </div>

      {!isOnline && history.length > 0 && (
        <div style={{ marginTop: '2rem', width: '100%' }}>
          <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Recent Rounds</h4>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {history.map((res, i) => (
              <span
                key={i}
                style={{
                  padding: '0.3rem 0.8rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: res === 'Win' ? 'rgba(0, 255, 178, 0.15)' : res === 'Lose' ? 'rgba(255, 0, 127, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: res === 'Win' ? 'var(--primary)' : res === 'Lose' ? 'var(--accent)' : 'var(--text-muted)',
                  border: `1px solid ${res === 'Win' ? 'var(--primary)' : res === 'Lose' ? 'var(--accent)' : 'var(--glass-border)'}`
                }}
              >
                {res}
              </span>
            ))}
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
            <button className="btn-primary" onClick={onBack} style={{ background: 'var(--accent)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
              Return to Lounge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
