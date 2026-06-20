import React, { useState, useEffect } from 'react';
import { playSound } from '../utils/audio';
import { HelpCircle, RefreshCw, Cpu, CheckSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sudoku() {
  const [size, setSize] = useState(9); // 9 (Classic) or 6 (Mini)
  const [initialBoard, setInitialBoard] = useState([]);
  const [board, setBoard] = useState([]);
  const [solution, setSolution] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null); // { r, c }
  const [difficulty, setDifficulty] = useState('medium');
  const [errors, setErrors] = useState([]); // list of strings "r-c"
  const [isWon, setIsWon] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isAutoSolved, setIsAutoSolved] = useState(false);
  const { addCoins } = useAuth();

  const generateNewBoard = async (diff = difficulty, newSize = size) => {
    playSound('click');
    setIsPending(true);
    setIsWon(false);
    setSelectedCell(null);
    setErrors([]);
    setIsAutoSolved(false);
    
    try {
      const res = await fetch(window.API_BASE_URL + '/api/sudoku/generate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: diff, size: newSize })
      });
      const data = await res.json();
      if (data.board && data.solution) {
        setInitialBoard(data.board);
        setBoard(data.board.map(row => [...row]));
        setSolution(data.solution);
      }
    } catch (e) {
      console.error("Failed to generate Sudoku board", e);
      // Fallback local generation if server fails
      const fallbackGrid = newSize === 9 
        ? Array(9).fill(null).map(() => Array(9).fill(0))
        : Array(6).fill(null).map(() => Array(6).fill(0));
      setInitialBoard(fallbackGrid);
      setBoard(fallbackGrid);
      setSolution(fallbackGrid);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    generateNewBoard(difficulty, size);
  }, []);

  const handleCellClick = (r, c) => {
    setSelectedCell({ r, c });
    playSound('click');
  };

  const setNumber = (num) => {
    if (!selectedCell) return;
    const { r, c } = selectedCell;

    // Check if cell is fixed (an initial clue)
    if (initialBoard[r] && initialBoard[r][c] !== 0) return;

    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = num;
    setBoard(newBoard);
    playSound('keypress');

    const cellId = `${r}-${c}`;
    setErrors(prev => prev.filter(id => id !== cellId));

    if (checkBoardFinished(newBoard)) {
      setIsWon(true);
      playSound('win');
      if (addCoins) addCoins(5);
    }
  };

  const checkBoardFinished = (currBoard) => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (currBoard[r][c] === 0 || currBoard[r][c] !== solution[r][c]) {
          return false;
        }
      }
    }
    return true;
  };

  // Keyboard support for entry
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedCell) return;
      if (e.key >= '1' && e.key <= String(size)) {
        setNumber(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        setNumber(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, board, size]);

  const autoSolve = () => {
    playSound('click');
    setBoard(solution.map(row => [...row]));
    setSelectedCell(null);
    setErrors([]);
    setIsAutoSolved(true);
    setIsWon(true);
    playSound('win');
  };

  const verifyAnswers = () => {
    playSound('click');
    const newErrors = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== 0 && board[r][c] !== solution[r][c]) {
          newErrors.push(`${r}-${c}`);
        }
      }
    }
    setErrors(newErrors);
    if (newErrors.length > 0) {
      playSound('error');
    } else {
      playSound('match');
    }
  };

  const handleSizeChange = (newSize) => {
    setSize(newSize);
    generateNewBoard(difficulty, newSize);
  };

  // Numbers list for input buttons
  const inputNumbers = size === 9 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
      {/* Size and Difficulty Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center', width: '100%' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => handleSizeChange(9)}
            className={size === 9 ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            disabled={isPending}
          >
            Classic (9x9)
          </button>
          <button
            onClick={() => handleSizeChange(6)}
            className={size === 6 ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            disabled={isPending}
          >
            Mini (6x6)
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['easy', 'medium', 'hard'].map((d) => (
            <button
              key={d}
              onClick={() => {
                setDifficulty(d);
                generateNewBoard(d, size);
              }}
              className={difficulty === d ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
              disabled={isPending}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid rendering */}
      <div 
        className="sudoku-grid"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          maxWidth: size === 9 ? '440px' : '320px'
        }}
      >
        {board.map((row, rIdx) => 
          row.map((val, cIdx) => {
            const isSelected = selectedCell && selectedCell.r === rIdx && selectedCell.c === cIdx;
            const isFixed = initialBoard[rIdx] && initialBoard[rIdx][cIdx] !== 0;
            const hasError = errors.includes(`${rIdx}-${cIdx}`);
            
            let cellClass = "sudoku-cell";
            if (isSelected) cellClass += " selected";
            if (isFixed) cellClass += " fixed";
            if (hasError) cellClass += " error";

            // Dynamic thick borders calculations
            let borderStyle = {};
            if (size === 9) {
              if (cIdx % 3 === 2 && cIdx !== 8) borderStyle.borderRight = '2px solid #475569';
              if (rIdx % 3 === 2 && rIdx !== 8) borderStyle.borderBottom = '2px solid #475569';
            } else if (size === 6) {
              if (cIdx % 3 === 2 && cIdx !== 5) borderStyle.borderRight = '2px solid #475569';
              if (rIdx % 2 === 1 && rIdx !== 5) borderStyle.borderBottom = '2px solid #475569';
            }

            return (
              <button
                key={`${rIdx}-${cIdx}`}
                className={cellClass}
                style={borderStyle}
                onClick={() => handleCellClick(rIdx, cIdx)}
                disabled={isPending}
              >
                {val !== 0 ? val : ''}
              </button>
            );
          })
        )}
      </div>

      {/* Input numbers pad */}
      {(() => {
        const isSelectedCellFixed = selectedCell && initialBoard[selectedCell.r] && initialBoard[selectedCell.r][selectedCell.c] !== 0;
        return (
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${inputNumbers.length + 1}, 1fr)`, 
              gap: '0.4rem', 
              maxWidth: size === 9 ? '400px' : '320px', 
              width: '100%' 
            }}
          >
            {inputNumbers.map((num) => (
              <button
                key={num}
                onClick={() => setNumber(num)}
                className="btn-secondary"
                style={{ padding: '0.8rem 0', fontWeight: 'bold', fontSize: '1.1rem' }}
                disabled={!selectedCell || isSelectedCellFixed || isPending}
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => setNumber(0)}
              className="btn-secondary"
              style={{ padding: '0.8rem 0', fontWeight: 'bold', fontSize: '0.85rem' }}
              disabled={!selectedCell || isSelectedCellFixed || isPending}
            >
              Clear
            </button>
          </div>
        );
      })()}

      <div className="puzzle-controls" style={{ marginTop: '0.5rem' }}>
        <button className="btn-secondary" onClick={verifyAnswers} disabled={isPending || board.length === 0}>
          <CheckSquare size={16} style={{ marginRight: '0.5rem' }} /> Verify
        </button>
        <button className="btn-primary" onClick={autoSolve} disabled={isPending || board.length === 0}>
          <Cpu size={16} style={{ marginRight: '0.5rem' }} /> Auto Solve
        </button>
      </div>

      {isWon && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">🧠</div>
            <div className="victory-title">Grid Solved!</div>
            <div className="victory-text">
              Excellent! You solved the {size}x{size} Sudoku puzzle board successfully!{!isAutoSolved && " 🪙 Earned 5 Neon Coins!"}
            </div>
            <button className="btn-primary" onClick={() => generateNewBoard(difficulty, size)}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
