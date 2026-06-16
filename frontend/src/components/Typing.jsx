import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../utils/audio';
import { RefreshCw, Play, Clock } from 'lucide-react';

export default function Typing() {
  const [passage, setPassage] = useState({ text: 'Loading passage...', author: '', category: '' });
  const [inputVal, setInputVal] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef(null);

  const fetchPassage = async () => {
    playSound('click');
    setPassage({ text: 'Loading...', author: '', category: '' });
    setInputVal('');
    setStartTime(null);
    setTimeElapsed(0);
    setWpm(0);
    setAccuracy(100);
    setIsFinished(false);
    
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch(window.API_BASE_URL + '/api/typing/passage/');
      const data = await res.json();
      setPassage(data);
    } catch (e) {
      setPassage({
        text: "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet.",
        author: "Classic Pangram",
        category: "Warm-up"
      });
    }
  };

  useEffect(() => {
    fetchPassage();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (isFinished) return;

    // Start timer on first keystroke
    if (!startTime) {
      setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }

    setInputVal(val);
    playSound('keypress');

    // Calculate WPM and Accuracy
    calculateStats(val);

    // Check if finished
    if (val === passage.text) {
      setIsFinished(true);
      clearInterval(timerRef.current);
      playSound('win');
    }
  };

  const calculateStats = (input) => {
    if (!input) {
      setWpm(0);
      setAccuracy(100);
      return;
    }

    // WPM calculation: (correct chars / 5) / (minutes elapsed)
    const elapsedMinutes = timeElapsed > 0 ? timeElapsed / 60 : 1 / 60;
    
    let correctChars = 0;
    let errors = 0;
    
    for (let i = 0; i < input.length; i++) {
      if (input[i] === passage.text[i]) {
        correctChars++;
      } else {
        errors++;
      }
    }

    const words = correctChars / 5;
    const currentWpm = Math.round(words / elapsedMinutes);
    setWpm(currentWpm);

    const currentAccuracy = Math.round(((input.length - errors) / input.length) * 100);
    setAccuracy(currentAccuracy);
  };

  // Recalculate WPM as time ticks up
  useEffect(() => {
    if (startTime && !isFinished) {
      calculateStats(inputVal);
    }
  }, [timeElapsed]);

  const renderPassageChars = () => {
    const chars = passage.text.split('');
    return chars.map((char, index) => {
      let charClass = '';
      if (index < inputVal.length) {
        charClass = inputVal[index] === char ? 'char-correct' : 'char-incorrect';
      } else if (index === inputVal.length) {
        charClass = 'char-current';
      }
      return (
        <span key={index} className={charClass}>
          {char}
        </span>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '750px' }}>
      <div className="memory-stats" style={{ width: '100%', justifyContent: 'space-around' }}>
        <span>Speed: <strong>{wpm} WPM</strong></span>
        <span>Accuracy: <strong>{accuracy}%</strong></span>
        <span>Time: <strong>{timeElapsed}s</strong></span>
      </div>

      <div className="typing-passage">
        {renderPassageChars()}
      </div>

      <textarea
        value={inputVal}
        onChange={handleInputChange}
        placeholder="Start typing the text above to launch speed showdown..."
        disabled={isFinished}
        style={{
          width: '100%',
          minHeight: '120px',
          background: 'var(--bg-card-hover)',
          border: '2px solid var(--glass-border)',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '1.15rem',
          padding: '1rem',
          outline: 'none',
          resize: 'none',
          fontFamily: 'monospace',
          lineHeight: '1.5',
          transition: 'all 0.3s ease'
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', color: 'var(--text-muted)' }}>
        <span>Author: <strong>{passage.author || "Unknown"}</strong></span>
        <button className="btn-secondary" onClick={fetchPassage}>
          <RefreshCw size={16} style={{ marginRight: '0.5rem' }} /> New Text
        </button>
      </div>

      {isFinished && (
        <div className="victory-modal-overlay">
          <div className="victory-modal">
            <div className="victory-emoji">⚡</div>
            <div className="victory-title">Showdown Finished!</div>
            <div className="victory-text">
              You typed at <strong>{wpm} WPM</strong> with <strong>{accuracy}%</strong> accuracy in <strong>{timeElapsed}s</strong>!
            </div>
            <button className="btn-primary" onClick={fetchPassage}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
