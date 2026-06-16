import React, { useState, useEffect } from 'react';
import { playSound } from '../utils/audio';

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['ENTER', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'BACK']
];

export default function Wordle() {
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState(Array(MAX_ATTEMPTS).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [isLost, setIsLost] = useState(false);
  const [invalidMsg, setInvalidMsg] = useState('');

  const startNewGame = async () => {
    playSound('click');
    setGuesses(Array(MAX_ATTEMPTS).fill(''));
    setCurrentGuess('');
    setAttempt(0);
    setIsWon(false);
    setIsLost(false);
    setInvalidMsg('');

    try {
      // Call Django backend to generate word
      const res = await fetch('http://localhost:8000/api/wordle/validate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' })
      });
      const data = await res.json();
      if (data.word) {
        setTargetWord(data.word.toLowerCase());
      } else {
        setTargetWord('react'); // fallback
      }
    } catch (e) {
      setTargetWord('react'); // fallback
    }
  };

  useEffect(() => {
    startNewGame();
  }, []);

  const handleKeyPress = (key) => {
    if (isWon || isLost) return;
    setInvalidMsg('');

    if (key === 'BACK' || key === 'Backspace') {
      setCurrentGuess(g => g.slice(0, -1));
      playSound('keypress');
    } else if (key === 'ENTER' || key === 'Enter') {
      submitGuess();
    } else if (/^[a-zA-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(g => g + key.toLowerCase());
      playSound('keypress');
    }
  };

  const submitGuess = async () => {
    if (currentGuess.length < WORD_LENGTH) {
      playSound('error');
      setInvalidMsg("Not enough letters.");
      return;
    }

    // Verify word exists in dictionary via Django backend
    try {
      const res = await fetch('http://localhost:8000/api/wordle/validate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: currentGuess })
      });
      const data = await res.json();
      if (!data.valid) {
        playSound('error');
        setInvalidMsg("Not in word list.");
        return;
      }
    } catch (e) {
      // If server is offline, just let it proceed
    }

    // Process guess
    const newGuesses = [...guesses];
    newGuesses[attempt] = currentGuess;
    setGuesses(newGuesses);
    
    if (currentGuess === targetWord) {
      setIsWon(true);
      playSound('win');
    } else if (attempt + 1 >= MAX_ATTEMPTS) {
      setIsLost(true);
      playSound('lose');
    } else {
      setAttempt(a => a + 1);
      setCurrentGuess('');
      playSound('match');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      handleKeyPress(e.key);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, attempt, isWon, isLost]);

  // Helper to color keys
  const getTileStatus = (char, index, guessStr) => {
    if (!guessStr) return '';
    if (targetWord[index] === char) return 'correct';
    if (targetWord.includes(char)) {
      // Check if not already used as correct in another index
      return 'present';
    }
    return 'absent';
  };

  // Compute key classes
  const getKeyStatus = (key) => {
    let status = '';
    guesses.forEach(g => {
      if (!g) return;
      for (let i = 0; i < g.length; i++) {
        if (g[i] === key) {
          if (targetWord[i] === key) {
            status = 'correct';
          } else if (targetWord.includes(key) && status !== 'correct') {
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
      <div className="wordle-board">
        {guesses.map((guess, rIndex) => {
          const isCurrentRow = rIndex === attempt;
          const displayStr = isCurrentRow ? currentGuess.padEnd(WORD_LENGTH, ' ') : guess.padEnd(WORD_LENGTH, ' ');
          
          return (
            <div key={rIndex} className="wordle-row">
              {Array.from(displayStr).map((char, cIndex) => {
                const status = isCurrentRow || rIndex > attempt ? '' : getTileStatus(char, cIndex, guess);
                return (
                  <div key={cIndex} className={`wordle-tile ${status}`}>
                    {char.trim()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {invalidMsg && (
        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
          {invalidMsg}
        </span>
      )}

      {/* Virtual Keyboard */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', maxWidth: '420px', marginTop: '1rem' }}>
        {KEYBOARD_ROWS.map((row, rIdx) => (
          <div key={rIdx} style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem' }}>
            {row.map((key) => {
              const status = getKeyStatus(key);
              return (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  style={{
                    flex: key === 'ENTER' || key === 'BACK' ? 1.5 : 1,
                    background: status === 'correct' ? '#15803d' : status === 'present' ? '#a16207' : status === 'absent' ? '#374151' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.8rem 0.3rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s'
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <button className="btn-secondary" onClick={startNewGame} style={{ marginTop: '1rem' }}>
        New Game
      </button>

      {(isWon || isLost) && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">{isWon ? '🎯' : '😢'}</div>
            <div className="victory-title">{isWon ? 'Winner!' : 'Game Over'}</div>
            <div className="victory-text">
              {isWon ? (
                <span>You solved the Wordle in <strong>{attempt + 1}</strong> attempts!</span>
              ) : (
                <span>The target word was <strong>{targetWord.toUpperCase()}</strong>.</span>
              )}
            </div>
            <button className="btn-primary" onClick={startNewGame}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
