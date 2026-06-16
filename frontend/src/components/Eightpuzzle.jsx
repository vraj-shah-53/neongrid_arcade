import React, { useState, useEffect } from 'react';
import { playSound } from '../utils/audio';
import { HelpCircle, RefreshCw, Cpu, Award } from 'lucide-react';

const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0];

export default function Eightpuzzle() {
  const [board, setBoard] = useState(GOAL);
  const [moves, setMoves] = useState(0);
  const [isSolving, setIsSolving] = useState(false);
  const [solvedPath, setSolvedPath] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  const getInversions = (arr) => {
    let count = 0;
    const tiles = arr.filter(x => x !== 0);
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (tiles[i] > tiles[j]) count++;
      }
    }
    return count;
  };

  const isSolvable = (arr) => {
    return getInversions(arr) % 2 === 0;
  };

  const shuffleBoard = () => {
    playSound('click');
    setErrorMsg(null);
    setMoves(0);
    setSolvedPath([]);
    setIsSolving(false);

    let temp;
    while (true) {
      temp = [...GOAL].sort(() => Math.random() - 0.5);
      if (isSolvable(temp) && JSON.stringify(temp) !== JSON.stringify(GOAL)) {
        break;
      }
    }
    setBoard(temp);
  };

  useEffect(() => {
    shuffleBoard();
  }, []);

  const handleTileClick = (index) => {
    if (isSolving) return;
    
    const zeroIdx = board.indexOf(0);
    const validMoves = getValidMoves(zeroIdx);

    if (validMoves.includes(index)) {
      playSound('flip');
      const newBoard = [...board];
      newBoard[zeroIdx] = board[index];
      newBoard[index] = 0;
      setBoard(newBoard);
      setMoves(m => m + 1);
    } else {
      playSound('error');
    }
  };

  const getValidMoves = (zeroIdx) => {
    const r = Math.floor(zeroIdx / 3);
    const c = zeroIdx % 3;
    const list = [];
    if (r > 0) list.push(zeroIdx - 3); // Up
    if (r < 2) list.push(zeroIdx + 3); // Down
    if (c > 0) list.push(zeroIdx - 1); // Left
    if (c < 2) list.push(zeroIdx + 1); // Right
    return list;
  };

  const triggerAutoSolve = async () => {
    if (isSolving) return;
    playSound('click');
    setIsSolving(true);
    setErrorMsg(null);

    try {
      const response = await fetch(window.API_BASE_URL + '/api/eightpuzzle/solve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board })
      });
      const data = await response.json();
      
      if (data.solvable && data.moves) {
        playbackSolution(data.moves);
      } else {
        setErrorMsg(data.error || "Cannot find solution.");
        setIsSolving(false);
        playSound('error');
      }
    } catch (e) {
      setErrorMsg("Failed to reach solve server. Fallback to manual mode.");
      setIsSolving(false);
      playSound('error');
    }
  };

  const playbackSolution = (steps) => {
    // steps is a list of boards (flat lists of 9)
    let i = 1; // start from first step (index 0 is current board)
    
    const interval = setInterval(() => {
      if (i < steps.length) {
        setBoard(steps[i]);
        setMoves(m => m + 1);
        playSound('flip');
        i++;
      } else {
        clearInterval(interval);
        setIsSolving(false);
        playSound('win');
      }
    }, 450); // Playback delay
  };

  const isCompleted = JSON.stringify(board) === JSON.stringify(GOAL);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
      <div className="memory-stats">
        <span>Moves: <strong>{moves}</strong></span>
        <span>Solvable: <strong>{isSolvable(board) ? "Yes" : "No"}</strong></span>
      </div>

      <div className="puzzle-board">
        {board.map((value, index) => (
          <div
            key={index}
            className={`puzzle-tile ${value === 0 ? 'empty' : ''}`}
            onClick={() => handleTileClick(index)}
          >
            {value !== 0 ? value : ''}
          </div>
        ))}
      </div>

      <div className="puzzle-controls">
        <button className="btn-secondary" onClick={shuffleBoard} disabled={isSolving}>
          <RefreshCw size={18} style={{ marginRight: '0.5rem' }} /> Shuffle
        </button>
        <button className="btn-primary" onClick={triggerAutoSolve} disabled={isSolving || isCompleted}>
          <Cpu size={18} style={{ marginRight: '0.5rem' }} /> Auto Solve
        </button>
      </div>

      {errorMsg && (
        <span style={{ color: 'var(--accent)', fontSize: '0.9rem', textAlign: 'center' }}>
          {errorMsg}
        </span>
      )}

      {isCompleted && !isSolving && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">🧩</div>
            <div className="victory-title">Puzzle Solved!</div>
            <div className="victory-text">
              Completed the 8-puzzle in <strong>{moves}</strong> moves!
            </div>
            <button className="btn-primary" onClick={shuffleBoard}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
