import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { RefreshCw, HelpCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const THEMES = {
  CYBER: {
    name: "Cyber & Arcade",
    words: [
      "ROBOT", "MATRIX", "GRID", "HACKER", "CYPHER", "LASER", "NODE", "DATABASE",
      "CYBER", "SYSTEM", "CODING", "FIREWALL", "NETWORK", "INTERNET", "SOFTWARE", "HARDWARE",
      "PROGRAM", "BINARY", "VECTOR", "MEMORY", "PIXEL", "SCREEN", "CONSOLE", "ROUTER",
      "VIRTUAL", "GLITCH", "ENGINE", "CHIP", "DATA", "ONLINE", "ACCESS", "CRYPTO",
      "SHIELD", "SIGNAL", "SERVER", "BYTES", "KERNEL", "REBOOT", "BACKUP", "PLUGINS",
      "MODEM", "ARCADE", "HELIX", "PROTOCOL", "DUPLEX", "PHREAK", "DONGLE", "COMPILER",
      "EMULATOR", "BACKDOOR"
    ]
  },
  INDIA: {
    name: "India & Culture",
    words: [
      "DIWALI", "GANGA", "TAJMAHAL", "MUMBAI", "PUNJAB", "YOGA", "SPICES", "RUPEE",
      "HOLI", "SARI", "MANDIR", "CHAI", "CURRY", "BAZAAR", "HIMALAYA", "BENGAL",
      "KERALA", "DELHI", "JAIPUR", "SHANTI", "DANCE", "TABLA", "SITAR", "RAGA",
      "TEMPLE", "FESTIVAL", "LOTUS", "GANDHI", "ASHOKA", "AYURVEDA", "RICE", "NAAN",
      "KULFI", "MANGO", "SAMOSA", "BIRYANI", "DHOKLA", "CHUTNEY", "PETHA", "BHARAT",
      "KARMA", "GHEE", "ROTI", "MASALA", "VEENA", "MONSOON", "PEACOCK", "HENNA",
      "SHIVA", "GANESH"
    ]
  },
  ANIMALS: {
    name: "Animals",
    words: [
      "TIGER", "GIRAFFE", "ELEPHANT", "DOLPHIN", "PARROT", "MONKEY", "KANGAROO", "PANDA",
      "LION", "CHEETAH", "LEOPARD", "ZEBRA", "HIPPO", "RHINO", "BEAR", "KOALA",
      "LEMUR", "GORILLA", "WOLF", "FOX", "COYOTE", "DEER", "BISON", "EAGLE",
      "HAWK", "FALCON", "OWL", "PENGUIN", "FLAMINGO", "PEACOCK", "SWAN", "WHALE",
      "SHARK", "OCTOPUS", "TURTLE", "FROG", "TOAD", "LIZARD", "SNAKE", "SEAL",
      "WALRUS", "OTTER", "BADGER", "SQUIRREL", "RABBIT", "JAGUAR", "PANTHER", "BEAVER",
      "CAMEL", "DONKEY"
    ]
  },
  FOOD: {
    name: "Delicious Foods",
    words: [
      "BIRYANI", "SAMOSA", "DOSA", "DHOKLA", "CURRY", "CHUTNEY", "PETHA", "MANGO",
      "PIZZA", "PASTA", "BURGER", "SUSHI", "TACO", "BURRITO", "RAMEN", "NOODLES",
      "DUMPLING", "SALAD", "SOUP", "STEAK", "KEBAB", "WAFFLE", "PANCAKE", "CREPE",
      "ICECREAM", "COOKIE", "BROWNIE", "DONUT", "CUPCAKE", "PASTRY", "CHEESE", "BUTTER",
      "BREAD", "SANDWICH", "HOTDOG", "POPCORN", "NACHOS", "LASAGNA", "RISOTTO", "FALAFEL",
      "HUMMUS", "SHAWARMA", "PAELLA", "GELATO", "TIRAMISU", "MACARON", "PUDDING", "MUFFIN",
      "SALMON", "HONEY"
    ]
  }
};

const NEON_COLORS = [
  '#00f0ff', // Neon Cyan
  '#39ff14', // Neon Green
  '#ff00ff', // Neon Magenta
  '#ff5f1f', // Neon Orange
  '#ffff00', // Neon Yellow
  '#ff007f', // Neon Pink
  '#b026ff', // Neon Purple
  '#00ffb2', // Neon Mint
];

export default function Wordsearch() {
  const [gridSize, setGridSize] = useState(12);
  const [activeTheme, setActiveTheme] = useState("CYBER");
  const [grid, setGrid] = useState([]);
  const [targetWords, setTargetWords] = useState([]);
  const [foundWords, setFoundWords] = useState([]); // list of strings
  const [foundPaths, setFoundPaths] = useState([]); // list of { start: {r,c}, end: {r,c}, word, color }
  
  // Selection dragging states
  const [isDrawing, setIsDrawing] = useState(false);
  const [startCell, setStartCell] = useState(null); // { r, c }
  const [currentCell, setCurrentCell] = useState(null); // { r, c }
  
  // Timer & Stats
  const [time, setTime] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const timerRef = useRef(null);
  const boardRef = useRef(null);
  const { addCoins } = useAuth();

  // Initialize a new game
  const initGame = (size = gridSize, themeKey = activeTheme) => {
    playSound('click');
    setFoundWords([]);
    setFoundPaths([]);
    setIsWon(false);
    setTime(0);
    setIsDrawing(false);
    setStartCell(null);
    setCurrentCell(null);

    if (timerRef.current) clearInterval(timerRef.current);

    const theme = THEMES[themeKey];
    
    // Shuffle helper to pick random subset of words
    const shuffleArray = (array) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // Determine how many words to place based on grid size
    const wordCount = size === 10 ? 6 : size === 12 ? 7 : 8;
    const wordsToPlace = shuffleArray(theme.words).slice(0, wordCount);

    // Generate grid
    let newGrid = Array(size).fill(null).map(() => Array(size).fill(null));
    const directions = [
      { dr: 0, dc: 1 },   // Right
      { dr: 0, dc: -1 },  // Left
      { dr: 1, dc: 0 },   // Down
      { dr: -1, dc: 0 },  // Up
      { dr: 1, dc: 1 },   // Down-Right
      { dr: -1, dc: 1 },  // Up-Right
      { dr: 1, dc: -1 },  // Down-Left
      { dr: -1, dc: -1 }  // Up-Left
    ];

    const placedWords = [];

    // Place each word
    wordsToPlace.forEach(word => {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 200) {
        attempts++;
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        const dir = directions[Math.floor(Math.random() * directions.length)];

        // Check if word fits in boundaries
        const endR = r + dir.dr * (word.length - 1);
        const endC = c + dir.dc * (word.length - 1);

        if (endR >= 0 && endR < size && endC >= 0 && endC < size) {
          // Check for letter collisions
          let canPlace = true;
          for (let i = 0; i < word.length; i++) {
            const currR = r + dir.dr * i;
            const currC = c + dir.dc * i;
            if (newGrid[currR][currC] !== null && newGrid[currR][currC] !== word[i]) {
              canPlace = false;
              break;
            }
          }

          if (canPlace) {
            // Place word
            for (let i = 0; i < word.length; i++) {
              const currR = r + dir.dr * i;
              const currC = c + dir.dc * i;
              newGrid[currR][currC] = word[i];
            }
            placed = true;
            placedWords.push(word);
          }
        }
      }
    });

    setTargetWords(placedWords);

    // Fill remaining empty cells with random letters
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newGrid[r][c] === null) {
          newGrid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      }
    }

    setGrid(newGrid);

    // Start timer
    timerRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  };

  useEffect(() => {
    initGame(gridSize, activeTheme);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Helper to determine if a line can be formed between start and current cell
  // Returns { rList, cList, directionDescription } if valid, null otherwise
  const getSelectedCells = (start, end) => {
    if (!start || !end) return null;
    const diffR = end.r - start.r;
    const diffC = end.c - start.c;

    const absR = Math.abs(diffR);
    const absC = Math.abs(diffC);

    // Check if straight horizontal, vertical, or 45-degree diagonal
    const isHorizontal = diffR === 0;
    const isVertical = diffC === 0;
    const isDiagonal = absR === absC;

    if (!isHorizontal && !isVertical && !isDiagonal) {
      return null;
    }

    const steps = Math.max(absR, absC);
    const stepR = diffR === 0 ? 0 : diffR / absR;
    const stepC = diffC === 0 ? 0 : diffC / absC;

    const cells = [];
    for (let i = 0; i <= steps; i++) {
      cells.push({
        r: start.r + stepR * i,
        c: start.c + stepC * i
      });
    }
    return cells;
  };

  const getSelectionString = (cells) => {
    if (!cells || cells.length === 0) return "";
    return cells.map(cell => grid[cell.r][cell.c]).join("");
  };

  // Mouse selection event mapping
  const handleCellMouseDown = (e, r, c) => {
    if (isWon) return;
    e.preventDefault();
    setIsDrawing(true);
    setStartCell({ r, c });
    setCurrentCell({ r, c });
    playSound('keypress');
  };

  const handleCellMouseEnter = (r, c) => {
    if (isDrawing) {
      setCurrentCell({ r, c });
    }
  };

  const handleMouseUpOrLeave = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const cells = getSelectedCells(startCell, currentCell);
    if (cells) {
      const selectedStr = getSelectionString(cells);
      const reversedStr = selectedStr.split('').reverse().join('');

      let matchedWord = null;
      if (targetWords.includes(selectedStr) && !foundWords.includes(selectedStr)) {
        matchedWord = selectedStr;
      } else if (targetWords.includes(reversedStr) && !foundWords.includes(reversedStr)) {
        matchedWord = reversedStr;
      }

      if (matchedWord) {
        // Play score chime
        playSound('score');
        const nextFoundWords = [...foundWords, matchedWord];
        setFoundWords(nextFoundWords);

        // Save persistent segment visual with its own neon color
        const color = NEON_COLORS[foundPaths.length % NEON_COLORS.length];
        setFoundPaths([...foundPaths, {
          start: startCell,
          end: currentCell,
          word: matchedWord,
          color
        }]);

        // Check victory
        if (nextFoundWords.length === targetWords.length) {
          clearInterval(timerRef.current);
          setIsWon(true);
          playSound('win');
          if (time <= 30 && addCoins) {
            addCoins(5);
          }
        }
      }
    }

    setStartCell(null);
    setCurrentCell(null);
  };

  // Touch selection event mapping
  const handleCellTouchStart = (e, r, c) => {
    if (isWon) return;
    if (e.cancelable) e.preventDefault();
    setIsDrawing(true);
    setStartCell({ r, c });
    setCurrentCell({ r, c });
    playSound('keypress');
  };

  const handleCellTouchMove = (e) => {
    if (!isDrawing || !e.touches || !e.touches[0]) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;
    const cell = element.closest('[data-r]');
    if (cell) {
      const r = parseInt(cell.dataset.r);
      const c = parseInt(cell.dataset.c);
      setCurrentCell({ r, c });
    }
  };

  // Layout conversion mapping for SVG line coordinates
  const getCellCenterPercent = (r, c) => {
    const cellWidth = 500 / gridSize;
    const x = (c + 0.5) * cellWidth;
    const y = (r + 0.5) * cellWidth;
    return { x, y };
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentSelectionCells = getSelectedCells(startCell, currentCell);
  const currentSelectionString = getSelectionString(currentSelectionCells);

  return (
    <div 
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', userSelect: 'none' }}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
    >
      <style>{`
        .wordsearch-grid-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 14, 23, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.03);
          font-family: monospace;
          font-size: 1.15rem;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          aspect-ratio: 1;
          z-index: 12;
          position: relative;
          transition: background 0.15s ease;
        }
        .wordsearch-grid-cell:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .wordsearch-word-item {
          padding: 0.35rem 0.75rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          transition: all 0.3s ease;
        }
        .wordsearch-word-item.found {
          text-decoration: line-through;
          background: rgba(0, 255, 178, 0.08);
          border-color: var(--primary);
          color: var(--primary);
          text-shadow: 0 0 8px var(--primary-glow);
        }
        .theme-select {
          padding: 0.4rem 0.8rem;
          background: var(--bg-card-hover);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          color: #fff;
          outline: none;
          cursor: pointer;
          font-size: 0.85rem;
        }
      `}</style>

      {/* Settings Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center', width: '100%' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[10, 12, 14].map((s) => (
            <button
              key={s}
              onClick={() => {
                setGridSize(s);
                initGame(s, activeTheme);
              }}
              className={gridSize === s ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              {s}x{s} Grid
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Theme:</span>
          <select
            value={activeTheme}
            onChange={(e) => {
              const theme = e.target.value;
              setActiveTheme(theme);
              initGame(gridSize, theme);
            }}
            className="theme-select"
          >
            {Object.keys(THEMES).map(key => (
              <option key={key} value={key}>{THEMES[key].name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Board */}
      <div className="memory-stats" style={{ width: '100%', justifyContent: 'space-around' }}>
        <span>Words Found: <strong>{foundWords.length}/{targetWords.length}</strong></span>
        <span>Time: <strong>{formatTime(time)}</strong></span>
      </div>

      {/* Selection Display */}
      <div style={{ height: '1.5rem', fontSize: '1rem', fontWeight: 700, color: 'var(--info)' }}>
        {currentSelectionString && `Selecting: ${currentSelectionString}`}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: '2rem', justifyContent: 'center', width: '100%', alignItems: 'center' }}>
        {/* Words Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '150px' }}>
          <h4 style={{ fontSize: '0.85rem', color: '#fff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Target Checklist</h4>
          {targetWords.map((word) => (
            <div 
              key={word} 
              className={`wordsearch-word-item ${foundWords.includes(word) ? 'found' : ''}`}
            >
              {word}
            </div>
          ))}
        </div>

        {/* Word Search Grid */}
        <div 
          ref={boardRef}
          onTouchMove={handleCellTouchMove}
          onTouchEnd={handleMouseUpOrLeave}
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gap: '1px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '2px solid var(--glass-border)',
            borderRadius: '16px',
            maxWidth: '380px',
            width: '100%',
            aspectRatio: '1',
            overflow: 'hidden'
          }}
        >
          {/* SVG Overlay to Draw Selection Line & Permanent Highlight Lines */}
          <svg
            viewBox="0 0 500 500"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 14
            }}
          >
            {/* Draw permanent highlighting tubes for found words */}
            {foundPaths.map((path, idx) => {
              const startPos = getCellCenterPercent(path.start.r, path.start.c);
              const endPos = getCellCenterPercent(path.end.r, path.end.c);
              return (
                <line
                  key={idx}
                  x1={startPos.x}
                  y1={startPos.y}
                  x2={endPos.x}
                  y2={endPos.y}
                  stroke={path.color}
                  strokeWidth={(500 / gridSize) * 0.75}
                  strokeLinecap="round"
                  opacity={0.35}
                  style={{
                    filter: `drop-shadow(0 0 6px ${path.color})`
                  }}
                />
              );
            })}

            {/* Draw active drag highlighting line */}
            {isDrawing && startCell && currentCell && currentSelectionCells && (
              (() => {
                const startPos = getCellCenterPercent(startCell.r, startCell.c);
                const endPos = getCellCenterPercent(currentCell.r, currentCell.c);
                return (
                  <line
                    x1={startPos.x}
                    y1={startPos.y}
                    x2={endPos.x}
                    y2={endPos.y}
                    stroke="var(--info)"
                    strokeWidth={(500 / gridSize) * 0.75}
                    strokeLinecap="round"
                    opacity={0.4}
                    style={{
                      filter: 'drop-shadow(0 0 6px var(--info-glow))'
                    }}
                  />
                );
              })()
            )}
          </svg>

          {/* Grid Letters */}
          {grid.map((row, rIdx) => 
            row.map((letter, cIdx) => (
              <div
                key={`${rIdx}-${cIdx}`}
                data-r={rIdx}
                data-c={cIdx}
                onMouseDown={(e) => handleCellMouseDown(e, rIdx, cIdx)}
                onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)}
                onTouchStart={(e) => handleCellTouchStart(e, rIdx, cIdx)}
                className="wordsearch-grid-cell"
              >
                {letter}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <button className="btn-secondary" onClick={() => initGame(gridSize, activeTheme)}>
          <RefreshCw size={16} style={{ marginRight: '0.5rem' }} /> Restart Game
        </button>
      </div>

      {isWon && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">🧠</div>
            <div className="victory-title">Grid Decoded!</div>
            <div className="victory-text">
              Found all {targetWords.length} words under the <strong>{THEMES[activeTheme].name}</strong> theme in <strong>{formatTime(time)}</strong>!{time <= 30 ? " 🪙 Earned 5 Neon Coins!" : ""}
            </div>
            <button className="btn-primary" onClick={() => initGame(gridSize, activeTheme)}>
              Next Puzzle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
