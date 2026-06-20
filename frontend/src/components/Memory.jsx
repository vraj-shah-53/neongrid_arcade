import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { useAuth } from '../context/AuthContext';

const EMOJIS = ['😍', '🌀', '🥶', '🥳', '🍁', '😂', '😎', '👊'];

export default function Memory({ roomId, isOnline, onBack }) {
  const { user } = useAuth();

  // Common States
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState([]);
  const [matches, setMatches] = useState([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isWon, setIsWon] = useState(false);
  
  // Offline State Timer
  const timerRef = useRef(null);

  // Online Multiplayer States
  const [roomData, setRoomData] = useState(null);
  const [scores, setScores] = useState({});
  const [isPending, setIsPending] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const pollTimerRef = useRef(null);

  const isPlayer1 = roomData && user && roomData.player_1.id === user.id;
  const isPlayer2 = roomData && user && roomData.player_2.id === user.id;
  const isMyTurn = roomData && user && roomData.turn_id === user.id;
  const opponentName = isOnline && roomData
    ? (isPlayer1 ? roomData.player_2.name : roomData.player_1.name)
    : "Opponent";

  // ----------------------------------------------------
  // OFFLINE GAME LOGIC
  // ----------------------------------------------------
  const initOfflineGame = () => {
    playSound('click');
    const shuffled = [...EMOJIS, ...EMOJIS]
      .map((emoji, index) => ({ id: index, emoji, flipped: false, matched: false }))
      .sort(() => Math.random() - 0.5);
    
    setCards(shuffled);
    setSelected([]);
    setMatches([]);
    setMoves(0);
    setTime(0);
    setIsActive(true);
    setIsWon(false);
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
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
        fetchRoomState();
      }
    } catch (e) {
      console.error("Failed to reset online Memory game:", e);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    if (!isOnline) {
      initOfflineGame();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline && matches.length === EMOJIS.length) {
      clearInterval(timerRef.current);
      setIsActive(false);
      setIsWon(true);
      playSound('win');
    }
  }, [matches, isOnline]);

  const handleOfflineCardClick = (id) => {
    if (!isActive || selected.length >= 2) return;
    const clickedCard = cards.find(c => c.id === id);
    if (clickedCard.matched || selected.includes(id)) return;

    playSound('flip');
    const newSelected = [...selected, id];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setMoves(m => m + 1);
      const [firstId, secondId] = newSelected;
      const firstCard = cards.find(c => c.id === firstId);
      const secondCard = cards.find(c => c.id === secondId);

      if (firstCard.emoji === secondCard.emoji) {
        setTimeout(() => {
          playSound('match');
          setMatches(m => [...m, firstCard.emoji]);
          setCards(prevCards => prevCards.map(c => 
            (c.id === firstId || c.id === secondId) ? { ...c, matched: true } : c
          ));
          setSelected([]);
        }, 500);
      } else {
        setTimeout(() => {
          setSelected([]);
        }, 1000);
      }
    }
  };

  // ----------------------------------------------------
  // ONLINE GAME LOGIC
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
        
        const bState = data.board_state || {};
        if (bState.cards) setCards(bState.cards);
        if (bState.selected) setSelected(bState.selected || []);
        if (bState.scores) setScores(bState.scores || {});

        // Compute local matches list
        if (bState.cards) {
          const matchedSet = new Set();
          bState.cards.forEach(c => {
            if (c.matched) matchedSet.add(c.emoji);
          });
          setMatches(Array.from(matchedSet));
        }

        if (data.status === 'ended') {
          setIsWon(true);
        } else {
          setIsWon(false);
        }
      }
    } catch (e) {
      console.warn("Error polling memory room:", e);
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

  const handleOnlineCardClick = async (id) => {
    if (!isMyTurn || selected.length >= 2 || isPending) return;
    const clickedCard = cards.find(c => c.id === id);
    if (clickedCard.matched || selected.includes(id)) return;

    playSound('flip');
    const newSelected = [...selected, id];
    setSelected(newSelected);

    // Save immediate selection so opponent sees the card flip
    setIsPending(true);
    try {
      const currentScores = { ...scores };
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          board_state: {
            cards: cards,
            scores: currentScores,
            selected: newSelected,
            status: 'playing'
          }
        })
      });
      if (!res.ok) throw new Error("Selection sync failed");
      
      // If this is the second card selected, check match
      if (newSelected.length === 2) {
        const [firstId, secondId] = newSelected;
        const firstCard = cards.find(c => c.id === firstId);
        const secondCard = cards.find(c => c.id === secondId);

        const isMatch = firstCard.emoji === secondCard.emoji;
        let nextCards = [...cards];
        let nextScores = { ...currentScores };

        if (isMatch) {
          playSound('match');
          // Mark matched
          nextCards = cards.map(c => 
            (c.id === firstId || c.id === secondId) ? { ...c, matched: true } : c
          );
          // Reward point
          const myIdStr = String(user.id);
          nextScores[myIdStr] = (nextScores[myIdStr] || 0) + 1;
        }

        // Check if game is completed
        const isGameFinished = nextCards.every(c => c.matched);
        let winnerId = null;

        if (isGameFinished) {
          const p1Id = String(roomData.player_1.id);
          const p2Id = String(roomData.player_2.id);
          const s1 = nextScores[p1Id] || 0;
          const s2 = nextScores[p2Id] || 0;
          if (s1 === s2) winnerId = 0; // Tie
          else winnerId = s1 > s2 ? roomData.player_1.id : roomData.player_2.id;
        }

        // Wait 1 second so both players can view the cards, then commit changes
        setTimeout(async () => {
          try {
            await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                board_state: {
                  cards: nextCards,
                  scores: nextScores,
                  selected: [],
                  status: isGameFinished ? 'ended' : 'playing'
                },
                switch_turn: !isMatch && !isGameFinished, // If match, keep turn
                winner_id: winnerId
              })
            });
            if (isGameFinished) {
              playSound(winnerId === user.id ? 'win' : winnerId === 0 ? 'match' : 'lose');
            }
            fetchRoomState();
          } catch (err) {
            console.error("Match commit failed", err);
          } finally {
            setIsPending(false);
          }
        }, 1200);

      } else {
        // Just one card clicked, fetch latest
        fetchRoomState();
        setIsPending(false);
      }

    } catch (err) {
      console.error("Selection failed", err);
      setIsPending(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  // Determine text display
  let statusText = "";
  if (isOnline) {
    statusText = isMyTurn ? "Your Turn! Find a Match." : `Waiting for ${opponentName}...`;
  } else {
    statusText = `Moves: ${moves}`;
  }

  // Determine online scores
  const p1Score = roomData ? (scores[String(roomData.player_1.id)] || 0) : 0;
  const p2Score = roomData ? (scores[String(roomData.player_2.id)] || 0) : 0;

  // Determine victory overlay details
  let victoryTitle = "You Win!";
  let victoryEmoji = "🏆";
  let victoryDesc = "";

  if (isWon) {
    if (isOnline && roomData) {
      const myIdStr = String(user.id);
      const oppIdStr = String(isPlayer1 ? roomData.player_2.id : roomData.player_1.id);
      const myS = scores[myIdStr] || 0;
      const oppS = scores[oppIdStr] || 0;
      if (myS === oppS) {
        victoryTitle = "It's a Tie!";
        victoryEmoji = "🤝";
        victoryDesc = `Both players finished with ${myS} matches!`;
      } else if (myS > oppS) {
        victoryTitle = "You Win!";
        victoryEmoji = "🏆";
        victoryDesc = `You defeated ${opponentName} by ${myS} to ${oppS} matches!`;
      } else {
        victoryTitle = `${opponentName} Wins!`;
        victoryEmoji = "💥";
        victoryDesc = `${opponentName} won by ${oppS} to ${myS} matches!`;
      }
    } else {
      victoryTitle = "You Win!";
      victoryEmoji = "🏆";
      victoryDesc = `Finished in ${moves} moves and ${formatTime(time)}!`;
    }
  }

  return (
    <div className="memory-board-container">
      {isOnline && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Room: <span style={{ color: 'var(--primary)' }}>{roomId.substring(0, 8)}...</span> | 
          Duel: <span style={{ color: '#fff' }}>{roomData?.player_1.name} ({p1Score})</span> vs <span style={{ color: '#fff' }}>{roomData?.player_2.name} ({p2Score})</span>
        </div>
      )}

      <div className="memory-stats">
        <span>{statusText}</span>
        {!isOnline && <span>Time: <strong>{formatTime(time)}</strong></span>}
      </div>

      <div className="memory-grid">
        {cards.map((card) => {
          const isFlipped = selected.includes(card.id) || card.matched;
          const isMatched = card.matched;
          return (
            <div
              key={card.id}
              className={`memory-card-tile ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''} ${isOnline && !isMyTurn ? 'disabled' : ''}`}
              onClick={() => isOnline ? handleOnlineCardClick(card.id) : handleOfflineCardClick(card.id)}
            >
              <div className="memory-card-inner">
                <div className="memory-card-back"></div>
                <div className="memory-card-front">
                  {card.emoji}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isOnline ? (
        <button className="btn-reset-game" onClick={onBack} style={{ marginTop: '1.5rem' }}>
          Exit Room
        </button>
      ) : (
        <button className="btn-reset-game" onClick={initOfflineGame} style={{ marginTop: '1.5rem' }}>
          Reset Game
        </button>
      )}

      {isWon && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">{victoryEmoji}</div>
            <div className="victory-title">{victoryTitle}</div>
            <div className="victory-text">
              {victoryDesc}
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
                <button className="btn-primary" onClick={initOfflineGame} style={{ width: '100%' }}>
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
            <button className="btn-primary" onClick={onBack} style={{ background: 'var(--accent)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
              Return to Lounge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
