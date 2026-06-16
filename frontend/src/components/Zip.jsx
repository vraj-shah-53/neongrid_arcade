import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { RefreshCw, Play, Circle, HelpCircle } from 'lucide-react';

const SEGMENT_COLORS = [
  '#00f0ff', // Neon Cyan (1->2)
  '#39ff14', // Neon Green (2->3)
  '#ff00ff', // Neon Magenta (3->4)
  '#ff5f1f', // Neon Orange (4->5)
  '#ffff00', // Neon Yellow (5->6)
  '#ff007f', // Neon Pink (6->7)
  '#b026ff', // Neon Purple (7->8)
  '#00ffb2', // Neon Mint (8->9)
  '#0080ff', // Neon Blue (9->10)
];

export default function Zip() {
  const [gridSize, setGridSize] = useState(5);
  const [numDigits, setNumDigits] = useState(8);
  const [digits, setDigits] = useState([]); // list of { r, c, val }
  const [path, setPath] = useState([]); // list of { r, c } (cells in current drawn path)
  const [isDragging, setIsDragging] = useState(false);
  
  const [time, setTime] = useState(0);
  const [moves, setMoves] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef(null);
  
  const boardRef = useRef(null);

  const initGame = async (size = gridSize, digitsCount = numDigits) => {
    playSound('click');
    setIsPending(true);
    setIsWon(false);
    setPath([]);
    setMoves(0);
    setTime(0);
    setIsDragging(false);

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch(window.API_BASE_URL + '/api/zip/generate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid_size: size, num_digits: digitsCount })
      });
      const data = await res.json();
      if (data.digits) {
        setDigits(data.digits);
        const startDigit = data.digits.find(d => d.val === 1);
        if (startDigit) {
          setPath([{ r: startDigit.r, c: startDigit.c }]);
        }
        
        timerRef.current = setInterval(() => {
          setTime(t => t + 1);
        }, 1000);
      }
    } catch (e) {
      console.error("Failed to generate ZIP puzzle via server", e);
      generateFallbackPuzzle(size, digitsCount);
    } finally {
      setIsPending(false);
    }
  };

  const generateFallbackPuzzle = (size, digitsCount) => {
    // Basic fallback sequential placement
    const fallbackDigits = [];
    for (let i = 0; i < digitsCount; i++) {
      // diagonal scatter
      const cellId = i * 2;
      fallbackDigits.push({
        r: Math.floor(cellId / size) % size,
        c: cellId % size,
        val: i + 1
      });
    }
    setDigits(fallbackDigits);
    setPath([{ r: fallbackDigits[0].r, c: fallbackDigits[0].c }]);
    
    timerRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  };

  useEffect(() => {
    initGame(gridSize, numDigits);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Check if grid cell has a digit
  const getDigitAt = (r, c) => {
    return digits.find(d => d.r === r && d.c === c);
  };

  // Get current target digit value we need to connect to
  const getNextTargetValue = () => {
    // Smallest digit whose cell is NOT in the path
    for (let i = 1; i <= digits.length; i++) {
      const d = digits.find(x => x.val === i);
      if (d && !path.some(p => p.r === d.r && p.c === d.c)) {
        return i;
      }
    }
    return null;
  };

  const tryExtendPath = (r, c) => {
    if (isWon || isPending || path.length === 0) return;

    const last = path[path.length - 1];
    
    // 1. Must be adjacent
    const isAdjacent = Math.abs(r - last.r) + Math.abs(c - last.c) === 1;
    if (!isAdjacent) return;

    // 2. Can retract if clicking/hovering the second-to-last cell
    if (path.length > 1) {
      const secondLast = path[path.length - 2];
      if (secondLast.r === r && secondLast.c === c) {
        // retract path
        setPath(p => p.slice(0, -1));
        playSound('keypress');
        return;
      }
    }

    // 3. Cannot cross already drawn path
    const isVisited = path.some(p => p.r === r && p.c === c);
    if (isVisited) {
      // If visited, let's retract/truncate the path back to this cell! (convenient undo)
      const index = path.findIndex(p => p.r === r && p.c === c);
      // Don't truncate to index 0 if it deletes digit 1 starts
      setPath(p => p.slice(0, index + 1));
      playSound('keypress');
      return;
    }

    // 4. Check digit cell constraints
    const targetDigit = getDigitAt(r, c);
    const nextExpectedVal = getNextTargetValue();

    if (targetDigit) {
      if (targetDigit.val === nextExpectedVal) {
        // Correct next digit connected!
        const newPath = [...path, { r, c }];
        setPath(newPath);
        
        if (targetDigit.val === digits.length) {
          // Completed the full path! Check if all cells are covered
          const totalCells = gridSize * gridSize;
          if (newPath.length === totalCells) {
            clearInterval(timerRef.current);
            setIsWon(true);
            playSound('win');
          } else {
            // Did not cover all squares
            playSound('error');
          }
        } else {
          playSound('match');
        }
      } else {
        // Blocked: hit a digit cell out of order
        playSound('error');
      }
    } else {
      // Extended into an empty cell
      setPath(p => [...p, { r, c }]);
      playSound('flip');
    }
  };

  const handleCellMouseDown = (e, r, c) => {
    e.preventDefault(); // Prevents selection/drag blockers!
    const last = path[path.length - 1];
    if (last && last.r === r && last.c === c) {
      setIsDragging(true);
    } else {
      tryExtendPath(r, c);
    }
  };

  const handleCellMouseEnter = (r, c) => {
    if (isDragging) {
      tryExtendPath(r, c);
    }
  };

  const handleCellTouchStart = (e, r, c) => {
    if (e.cancelable) e.preventDefault();
    const last = path[path.length - 1];
    if (last && last.r === r && last.c === c) {
      setIsDragging(true);
    } else {
      tryExtendPath(r, c);
    }
  };

  const handleCellTouchMove = (e) => {
    if (!isDragging || !e.touches || !e.touches[0]) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;
    const cell = element.closest('[data-r]');
    if (cell) {
      const r = parseInt(cell.dataset.r);
      const c = parseInt(cell.dataset.c);
      tryExtendPath(r, c);
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleResetPath = () => {
    playSound('click');
    setMoves(m => m + 1);
    setIsWon(false);
    const startDigit = digits.find(d => d.val === 1);
    if (startDigit) {
      setPath([{ r: startDigit.r, c: startDigit.c }]);
    }
  };

  // Helper to slice path into segments for styling (1->2, 2->3, etc.)
  const getPathSegments = () => {
    if (path.length === 0 || digits.length === 0) return [];
    
    const segments = [];
    let currentSegment = [];
    
    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      currentSegment.push(cell);
      
      const digit = getDigitAt(cell.r, cell.c);
      if (digit && digit.val > 1) {
        // End segment on this digit
        segments.push({
          cells: currentSegment,
          color: SEGMENT_COLORS[(digit.val - 2) % SEGMENT_COLORS.length]
        });
        // Start next segment with this digit as the starting cell
        currentSegment = [cell];
      }
    }
    
    // Add remaining incomplete drawing segment if there are cells left
    if (currentSegment.length > 1) {
      segments.push({
        cells: currentSegment,
        color: '#00ffb2', // Pulsing neon color
        isIncomplete: true
      });
    }
    
    return segments;
  };

  // Math helper for SVG path creation (uses 500x500 coordinate system)
  const getCellCenterPercent = (r, c) => {
    const cellWidth = 500 / gridSize;
    const x = (c + 0.5) * cellWidth;
    const y = (r + 0.5) * cellWidth;
    return { x, y };
  };

  const makeSvgPath = (cells) => {
    if (cells.length < 2) return '';
    return cells.map((cell, idx) => {
      const pos = getCellCenterPercent(cell.r, cell.c);
      return `${idx === 0 ? 'M' : 'L'} ${pos.x} ${pos.y}`;
    }).join(' ');
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const segments = getPathSegments();

  return (
    <div 
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', userSelect: 'none' }}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
    >
      {/* Settings Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center', width: '100%' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[4, 5, 6].map((s) => (
            <button
              key={s}
              onClick={() => {
                setGridSize(s);
                const maxDigits = Math.min(numDigits, s * s - 3);
                setNumDigits(maxDigits);
                initGame(s, maxDigits);
              }}
              className={gridSize === s ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
              disabled={isPending}
            >
              {s}x{s} Board
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Digits:</span>
          <select
            value={numDigits}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setNumDigits(val);
              initGame(gridSize, val);
            }}
            style={{
              padding: '0.4rem 0.8rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: '#fff',
              outline: 'none',
              cursor: 'pointer'
            }}
            disabled={isPending}
          >
            {Array.from({ length: gridSize * gridSize - 4 }, (_, i) => i + 4)
              .filter(val => val <= 10)
              .map(val => (
                <option key={val} value={val}>{val}</option>
              ))
            }
          </select>
        </div>
      </div>

      <div className="memory-stats" style={{ width: '100%', justifyContent: 'space-around' }}>
        <span>Coverage: <strong>{path.length}/{gridSize * gridSize} cells</strong></span>
        <span>Time: <strong>{formatTime(time)}</strong></span>
      </div>

      <div 
        ref={boardRef}
        onTouchMove={handleCellTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gap: '1px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '2px solid var(--glass-border)',
          borderRadius: '16px',
          maxWidth: '350px',
          width: '100%',
          aspectRatio: '1',
          overflow: 'hidden'
        }}
      >
        <svg
          viewBox="0 0 500 500"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          {segments.map((seg, idx) => (
            <path
              key={idx}
              d={makeSvgPath(seg.cells)}
              fill="none"
              stroke={seg.color}
              strokeWidth={(500 / gridSize) * 0.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: seg.isIncomplete ? '15, 15' : 'none',
                opacity: 1.0,
                filter: `drop-shadow(0 0 8px ${seg.color})`
              }}
            />
          ))}
        </svg>

        {/* Render grid tiles */}
        {Array.from({ length: gridSize }).map((_, rIdx) => 
          Array.from({ length: gridSize }).map((_, cIdx) => {
            const digit = getDigitAt(rIdx, cIdx);
            const isStart = digit && digit.val === 1;
            
            return (
              <div
                key={`${rIdx}-${cIdx}`}
                data-r={rIdx}
                data-c={cIdx}
                onMouseDown={(e) => handleCellMouseDown(e, rIdx, cIdx)}
                onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)}
                onTouchStart={(e) => handleCellTouchStart(e, rIdx, cIdx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isStart ? 'rgba(37, 99, 235, 0.25)' : 'rgba(10, 14, 23, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  cursor: 'crosshair',
                  aspectRatio: '1',
                  zIndex: 12,
                  position: 'relative'
                }}
              >
                {digit && (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#000000',
                      border: '2px solid #ffffff',
                      color: '#ffffff',
                      fontSize: '1rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                      pointerEvents: 'none',
                      zIndex: 15
                    }}
                  >
                    {digit.val}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="puzzle-controls" style={{ marginTop: '0.5rem' }}>
        <button className="btn-secondary" onClick={handleResetPath}>
          <RefreshCw size={16} style={{ marginRight: '0.5rem' }} /> Clear Path
        </button>
      </div>

      {isWon && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">⚡</div>
            <div className="victory-title">Grid Connected!</div>
            <div className="victory-text">
              Connected all {digits.length} digits in ascending order and covered 100% of the grid in <strong>{formatTime(time)}</strong>!
            </div>
            <button className="btn-primary" onClick={() => initGame()}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
