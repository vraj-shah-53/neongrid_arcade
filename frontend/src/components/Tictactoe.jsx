import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { useAuth } from '../context/AuthContext';

export default function Tictactoe({ roomId, isOnline, onBack }) {
  const { user, addCoins } = useAuth();
  
  // Base states
  const [board, setBoard] = useState(Array(9).fill(""));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [tictactoeStreak, setTictactoeStreak] = useState(0);

  // Online specific state
  const [roomData, setRoomData] = useState(null);
  const [isAborted, setIsAborted] = useState(false);
  const pollTimerRef = useRef(null);

  // Determine user symbol in online mode
  // Player 1 (challenger) is X, Player 2 (receiver) is O
  const isPlayer1 = roomData && user && roomData.player_1.id === user.id;
  const isPlayer2 = roomData && user && roomData.player_2.id === user.id;
  const mySymbol = isPlayer1 ? "X" : isPlayer2 ? "O" : null;
  const opponentName = isOnline && roomData 
    ? (isPlayer1 ? roomData.player_2.name : roomData.player_1.name)
    : "Opponent";

  const checkWinner = (cells) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let line of lines) {
      const [a, b, c] = line;
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
        return cells[a];
      }
    }
    if (cells.every(cell => cell !== "")) return "Tie";
    return null;
  };

  // ----------------------------------------------------
  // ONLINE PLAY STATE POLLING
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
        
        const syncBoard = data.board_state.board || Array(9).fill("");
        setBoard(syncBoard);

        // Turn tracking: player_1 is X (turn_id === player_1.id means X next)
        const isX = data.turn_id === data.player_1.id;
        setIsXNext(isX);

        if (data.status === 'ended') {
          if (data.winner_id === 0) {
            setWinner('Tie');
          } else {
            const winSym = data.winner_id === data.player_1.id ? 'X' : 'O';
            setWinner(winSym);
          }
        } else {
          setWinner(null);
        }
      }
    } catch (e) {
      console.warn("Error fetching room state:", e);
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

  // Handle cell click
  const handleClick = async (index) => {
    if (board[index] || winner || isPending) return;

    if (isOnline) {
      // Online validation
      const myTurn = (isXNext && isPlayer1) || (!isXNext && isPlayer2);
      if (!myTurn) return; // Not your turn

      playSound('click');
      const newBoard = [...board];
      newBoard[index] = mySymbol;
      setBoard(newBoard);

      const gameWinner = checkWinner(newBoard);
      const postWinnerId = gameWinner 
        ? (gameWinner === 'Tie' ? 0 : (gameWinner === 'X' ? roomData.player_1.id : roomData.player_2.id))
        : null;

      setIsPending(true);
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/room/${roomId}/move/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            board_state: { board: newBoard, status: gameWinner ? 'ended' : 'playing' },
            switch_turn: !gameWinner,
            winner_id: postWinnerId
          })
        });
        if (res.ok) {
          fetchRoomState();
        }
      } catch (err) {
        console.error("Failed to post online move", err);
      } finally {
        setIsPending(false);
      }

    } else {
      // Offline AI validation
      if (!isXNext) return;

      playSound('click');
      const newBoard = [...board];
      newBoard[index] = "X";
      setBoard(newBoard);
      setIsXNext(false);

      const gameWinner = checkWinner(newBoard);
      if (gameWinner) {
        endGame(gameWinner);
        return;
      }

      // Call unbeatable AI on Django backend
      setIsPending(true);
      try {
        const response = await fetch(window.API_BASE_URL + '/api/tictactoe/move/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board: newBoard,
            ai_player: 'O',
            human_player: 'X'
          })
        });
        const data = await response.json();
        if (data.move !== undefined && data.move !== null) {
          newBoard[data.move] = "O";
          setBoard(newBoard);
          setIsXNext(true);

          const postAiWinner = checkWinner(newBoard);
          if (postAiWinner) {
            endGame(postAiWinner);
          } else {
            playSound('flip');
          }
        }
      } catch (e) {
        console.error("AI Request Failed, using fallback random move", e);
        const emptyIndices = newBoard.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
        if (emptyIndices.length > 0) {
          const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          newBoard[randomIdx] = "O";
          setBoard(newBoard);
          setIsXNext(true);
          const fallbackWinner = checkWinner(newBoard);
          if (fallbackWinner) endGame(fallbackWinner);
        }
      } finally {
        setIsPending(false);
      }
    }
  };

  const endGame = (gameWinner) => {
    setWinner(gameWinner);
    if (gameWinner === 'X') {
      playSound('win');
      setTictactoeStreak(s => {
        const next = s + 1;
        if (next === 3 && addCoins) {
          addCoins(3);
        }
        return next;
      });
    } else {
      playSound(gameWinner === 'O' ? 'lose' : 'match');
      setTictactoeStreak(0);
    }
  };

  const resetGame = () => {
    playSound('click');
    setBoard(Array(9).fill(""));
    setIsXNext(true);
    setWinner(null);
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
        setWinner(null);
        fetchRoomState();
      }
    } catch (e) {
      console.error("Failed to reset online game:", e);
    } finally {
      setIsPending(false);
    }
  };

  // Determine displayed turn text
  let turnText = "";
  if (isOnline) {
    const myTurn = (isXNext && isPlayer1) || (!isXNext && isPlayer2);
    turnText = myTurn ? "Your Turn!" : `Waiting for ${opponentName}...`;
  } else {
    turnText = isXNext ? "Your Turn (X)" : "AI thinking... (O)";
  }

  // Determine victory text
  let victoryText = "";
  let victoryEmoji = "🎉";
  if (winner) {
    if (winner === 'Tie') {
      victoryText = "It's a Tie!";
      victoryEmoji = "🤝";
    } else if (isOnline) {
      const isWinnerMe = (winner === 'X' && isPlayer1) || (winner === 'O' && isPlayer2);
      victoryText = isWinnerMe ? "You Win!" : `${opponentName} Wins!`;
      victoryEmoji = isWinnerMe ? "🏆" : "💥";
    } else {
      victoryText = winner === 'X' ? "You Win!" : "AI Wins!";
      victoryEmoji = winner === 'X' ? "🎉" : "🤖";
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
      {isOnline && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Room: <span style={{ color: 'var(--primary)' }}>{roomId.substring(0, 8)}...</span> | 
          Players: <span style={{ color: '#fff' }}>{roomData?.player_1.name} (X)</span> vs <span style={{ color: '#fff' }}>{roomData?.player_2.name} (O)</span>
        </div>
      )}
      
      <div className="memory-stats">
        <span>Status: <strong>{turnText}</strong></span>
      </div>

      <div className="ttt-board">
        {board.map((value, index) => (
          <button
            key={index}
            className={`ttt-cell ${value} ${isOnline && !((isXNext && isPlayer1) || (!isXNext && isPlayer2)) ? 'disabled' : ''}`}
            onClick={() => handleClick(index)}
          >
            {value}
          </button>
        ))}
      </div>

      {!isOnline ? (
        <button className="btn-secondary" onClick={resetGame} style={{ marginTop: '1rem' }}>
          Reset Grid
        </button>
      ) : (
        <button className="btn-secondary" onClick={onBack} style={{ marginTop: '1rem' }}>
          Exit Room
        </button>
      )}

      {winner && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">{victoryEmoji}</div>
            <div className="victory-title">
              {victoryText}
            </div>
            <div className="victory-text">
              {winner === 'Tie' 
                ? 'A well-fought match!' 
                : (isOnline 
                    ? ((winner === 'X' && isPlayer1) || (winner === 'O' && isPlayer2) ? 'Victory is yours!' : 'Better luck next time!')
                    : (winner === 'X' ? ('Congratulations, you beat the machine!' + (tictactoeStreak >= 3 ? ' 🪙 Earned 3 Neon Coins!' : '')) : 'The AI was too smart this time!')
                  )
              }
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
                <button className="btn-primary" onClick={resetGame} style={{ width: '100%' }}>
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
