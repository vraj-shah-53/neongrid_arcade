import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { useAuth } from '../context/AuthContext';

export default function Nodehack({ roomId, isOnline, onBack }) {
  const { user } = useAuth();
  const pollTimerRef = useRef(null);
  const transitioningRef = useRef(false);

  // States
  const [roomData, setRoomData] = useState(null);
  const [isAborted, setIsAborted] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [isWon, setIsWon] = useState(false);
  const [winnerName, setWinnerName] = useState(null);
  const [isTie, setIsTie] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Quick pointers
  const isPlayer1 = roomData && user && String(roomData.player_1.id) === String(user.id);
  const isPlayer2 = roomData && user && String(roomData.player_2.id) === String(user.id);
  const myIdStr = user ? String(user.id) : '';
  const oppIdStr = roomData ? (isPlayer1 ? String(roomData.player_2.id) : String(roomData.player_1.id)) : '';
  const opponentName = isOnline && roomData 
    ? (isPlayer1 ? roomData.player_2.name : roomData.player_1.name)
    : "Opponent";

  // Decompose board state
  const bState = roomData?.board_state || {};
  const questionsList = bState.questions || [];
  const currentIdx = bState.current_index !== undefined ? bState.current_index : 0;
  const currentQ = questionsList[currentIdx] || null;
  const nodePos = bState.node_pos !== undefined ? bState.node_pos : 50;

  // Have I answered the current question?
  const answersForCurrentQ = bState.answered?.[String(currentIdx)] || {};
  const myAnswer = answersForCurrentQ[myIdStr] || null;
  const oppAnswer = answersForCurrentQ[oppIdStr] || null;
  const bothAnswered = myAnswer !== null && oppAnswer !== null;

  const fetchRoomState = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/state/`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setRoomData(data);

        // Abort check
        if (data.board_state && data.board_state.aborted) {
          setIsAborted(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          return;
        }

        const nextBState = data.board_state || {};
        const qList = nextBState.questions || [];
        const cIdx = nextBState.current_index || 0;
        const answers = nextBState.answered?.[String(cIdx)] || {};
        const p1Id = String(data.player_1.id);
        const p2Id = String(data.player_2.id);

        // Reset local choice state when moving to a new question
        if (cIdx > currentIdx) {
          setSelectedChoice(null);
          transitioningRef.current = false;
        }

        // Host checks if both players answered current question and advances
        const hostIsMe = user && data && data.player_1 && String(data.player_1.id) === String(user.id);
        if (hostIsMe && data.status !== 'ended') {
          if (answers[p1Id] !== undefined && answers[p2Id] !== undefined) {
            // Both answered! Transition to next question after 2.5 seconds delay
            if (!transitioningRef.current) {
              transitioningRef.current = true;
              setTimeout(() => {
                advanceToNextQuestion(data);
              }, 2500);
            }
          }
        }

        // Check for winner
        if (data.status === 'ended') {
          if (data.winner_id) {
            if (data.winner_id === data.player_1.id) {
              setWinnerName(data.player_1.name);
            } else {
              setWinnerName(data.player_2.name);
            }
          } else {
            setIsTie(true);
            setWinnerName(null);
          }
        } else {
          setWinnerName(null);
          setIsTie(false);
        }
      }
    } catch (e) {
      console.warn("Failed fetching Nodehack state:", e);
    }
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
        setWinnerName(null);
        setIsTie(false);
        setSelectedChoice(null);
        transitioningRef.current = false;
        fetchRoomState();
      }
    } catch (e) {
      console.error("Failed to reset online Nodehack game:", e);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    if (roomId) {
      fetchRoomState();
      pollTimerRef.current = setInterval(fetchRoomState, 1500);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [roomId, currentIdx]);

  const advanceToNextQuestion = async (roomInfo) => {
    const nextBState = { ...roomInfo.board_state };
    const cIdx = nextBState.current_index || 0;
    const qList = nextBState.questions || [];

    // Check node win thresholds instantly
    let winnerId = null;
    let ended = false;
    
    if (nextBState.node_pos <= 0) {
      winnerId = roomInfo.player_1.id;
      ended = true;
    } else if (nextBState.node_pos >= 100) {
      winnerId = roomInfo.player_2.id;
      ended = true;
    }

    if (!ended && cIdx + 1 >= qList.length) {
      // Questions exhausted, decide winner based on node position
      ended = true;
      if (nextBState.node_pos < 50) {
        winnerId = roomInfo.player_1.id;
      } else if (nextBState.node_pos > 50) {
        winnerId = roomInfo.player_2.id;
      } else {
        winnerId = 0; // Tie
      }
    }

    if (!ended) {
      nextBState.current_index = cIdx + 1;
    }

    try {
      await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          board_state: nextBState,
          winner_id: ended ? winnerId : null
        })
      });
      fetchRoomState();
    } catch (e) {
      console.warn("Failed to advance question:", e);
    }
  };

  const handleChoiceSelect = async (choiceText) => {
    if (myAnswer !== null || isPending || isWon || isTie) return;
    setSelectedChoice(choiceText);
    setIsPending(true);
    playSound('click');

    const isCorrect = choiceText === currentQ.answer;
    
    // Calculate node movement
    let nodeShift = 0;
    if (isPlayer1) {
      // Player 1: Correct pulls left (-10), Incorrect pushes right (+5)
      nodeShift = isCorrect ? -10 : 5;
    } else {
      // Player 2: Correct pulls right (+10), Incorrect pushes left (-5)
      nodeShift = isCorrect ? 10 : -5;
    }

    const nextPos = Math.max(0, Math.min(100, nodePos + nodeShift));

    // Prepare state update
    const nextAnswered = bState.answered ? { ...bState.answered } : {};
    if (!nextAnswered[String(currentIdx)]) {
      nextAnswered[String(currentIdx)] = {};
    }
    nextAnswered[String(currentIdx)][myIdStr] = choiceText;

    const nextBState = {
      ...bState,
      node_pos: nextPos,
      answered: nextAnswered
    };

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ board_state: nextBState })
      });
      if (res.ok) {
        fetchRoomState();
        if (isCorrect) {
          playSound('score');
        } else {
          playSound('error');
        }
      }
    } catch (e) {
      console.warn("Failed posting answer:", e);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="nodehack-game-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1.5rem' }}>
      <style>{`
        .nodehack-dashboard {
          display: flex;
          justify-content: space-between;
          width: 500px;
          max-width: 100%;
          padding: 0.6rem 1.2rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          border: 1px solid var(--glass-border);
        }
        .node-track-bar {
          width: 500px;
          max-width: 100%;
          height: 12px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 6px;
          position: relative;
          margin: 1.5rem 0;
          border: 1px solid var(--glass-border);
        }
        .node-pointer {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          position: absolute;
          top: -6px;
          transform: translateX(-50%);
          transition: left 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        .question-panel {
          width: 500px;
          max-width: 100%;
          padding: 1.5rem;
          background: rgba(14, 21, 37, 0.6);
          border: 1px solid var(--border-neon);
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
          text-align: center;
        }
        .choice-btn-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          width: 500px;
          max-width: 100%;
          margin-top: 1rem;
        }
        .choice-option-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          color: var(--text-main);
          padding: 0.8rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
          text-align: left;
        }
        .choice-option-btn:hover:not(:disabled) {
          border-color: var(--primary);
          background: rgba(0, 255, 178, 0.08);
          transform: translateY(-2px);
        }
        .choice-option-btn.selected {
          border-color: var(--info);
          background: rgba(0, 180, 216, 0.15);
        }
        .choice-option-btn.correct {
          border-color: var(--primary) !important;
          background: rgba(0, 255, 178, 0.2) !important;
          box-shadow: 0 0 10px var(--primary-glow);
        }
        .choice-option-btn.incorrect {
          border-color: var(--accent) !important;
          background: rgba(255, 0, 127, 0.2) !important;
        }
        .lock-indicator {
          font-size: 0.85rem;
          margin-top: 1rem;
          color: var(--text-muted);
        }
      `}</style>

      {roomData && (
        <div className="nodehack-dashboard">
          <div>
            <span style={{ color: 'var(--primary)' }}>{roomData.player_1.name}</span> (Left)
          </div>
          <div>
            Question {currentIdx + 1} of {questionsList.length}
          </div>
          <div>
            (Right) <span style={{ color: 'var(--accent)' }}>{roomData.player_2.name}</span>
          </div>
        </div>
      )}

      {/* Network tug of war slider */}
      <div className="node-track-bar">
        <div 
          className="node-pointer" 
          style={{ 
            left: `${nodePos}%`,
            background: nodePos < 50 ? 'var(--primary)' : nodePos > 50 ? 'var(--accent)' : '#fff',
            boxShadow: nodePos < 50 ? '0 0 15px var(--primary-glow)' : nodePos > 50 ? '0 0 15px var(--accent-glow)' : '0 0 10px rgba(255,255,255,0.4)'
          }} 
        />
      </div>

      {currentQ && (
        <div className="question-panel">
          <div style={{ color: 'var(--info)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>
            TERMINAL ENIGMA
          </div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', lineHeight: '1.4' }}>
            {currentQ.question}
          </p>
        </div>
      )}

      {currentQ && (
        <div className="choice-btn-grid">
          {currentQ.choices.map((choice, i) => {
            const isSelected = selectedChoice === choice || myAnswer === choice;
            
            let btnClass = "choice-option-btn";
            if (isSelected) btnClass += " selected";
            
            // If both answered, reveal correct/incorrect answers visually
            if (bothAnswered) {
              if (choice === currentQ.answer) {
                btnClass += " correct";
              } else if (isSelected) {
                btnClass += " incorrect";
              }
            }

            return (
              <button
                key={i}
                className={btnClass}
                onClick={() => handleChoiceSelect(choice)}
                disabled={myAnswer !== null || isPending || isWon || isTie}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}

      <div className="lock-indicator">
        {myAnswer && !bothAnswered && (
          <span style={{ color: 'var(--primary)' }}>Choice locked. Waiting for opponent...</span>
        )}
        {bothAnswered && (
          <span style={{ color: 'var(--info)' }}>Next question initializing...</span>
        )}
      </div>

      <button className="btn-secondary" onClick={() => onBack(false)} style={{ marginTop: '1rem' }}>
        Exit Match
      </button>

      {(winnerName || isTie) && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">{isTie ? '🤝' : '🏆'}</div>
            <div className="victory-title">{isTie ? 'TIE LOG DETECTED' : 'NODE CAPTURED'}</div>
            <div className="victory-text">
              {isTie 
                ? "The connection remains perfectly balanced. Both hackers tie!"
                : `Hacker ${winnerName} successfully overloaded the network node!`
              }
            </div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
              <button className="btn-primary" onClick={handleOnlineReset} disabled={isPending} style={{ flex: 1 }}>
                {isPending ? 'Resetting...' : 'Play Again'}
              </button>
              <button className="btn-secondary" onClick={() => onBack(true)} style={{ flex: 1 }}>
                Exit Room
              </button>
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
