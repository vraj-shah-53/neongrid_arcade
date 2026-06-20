import React, { useState, useEffect } from 'react';
import { playSound } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import { HelpCircle, RefreshCw, Trophy, Brain, Zap, Check, X, Coins } from 'lucide-react';

const SHAPE_POOL = ['🔺', '🟩', '🟡', '🔷', '⭐', '❤️', '🌙', '🌀', '🛑', '🔔'];
const COLOR_POOL = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '⚫', '⚪', '🟤'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Dynamic AI Pattern Generator Engine (constructs 10,000+ unique patterns)
const generatePattern = (mode) => {
  const selectedMode = mode === 'mixed' 
    ? ['number', 'letter', 'shape', 'color'][Math.floor(Math.random() * 4)] 
    : mode;

  let sequence = [];
  let answer = '';
  let options = [];
  let explanation = '';

  if (selectedMode === 'number') {
    const type = Math.floor(Math.random() * 7);
    if (type === 0) {
      // Arithmetic
      const start = Math.floor(Math.random() * 20) + 1;
      const step = Math.floor(Math.random() * 8) + 2;
      for (let i = 0; i < 4; i++) sequence.push(start + i * step);
      answer = String(start + 4 * step);
      explanation = `Arithmetic progression with a step of +${step}.`;
      // Generate options
      options = [
        answer,
        String(start + 4 * step + step),
        String(start + 4 * step - 1),
        String(start + 4 * step + 2)
      ];
    } else if (type === 1) {
      // Geometric
      const start = Math.floor(Math.random() * 5) + 2;
      const ratio = Math.floor(Math.random() * 2) + 2; // 2 or 3
      for (let i = 0; i < 4; i++) sequence.push(start * Math.pow(ratio, i));
      answer = String(start * Math.pow(ratio, 4));
      explanation = `Geometric progression multiplying by ${ratio} each time.`;
      options = [
        answer,
        String(start * Math.pow(ratio, 4) + start),
        String(start * Math.pow(ratio, 3) * (ratio + 1)),
        String(start * Math.pow(ratio, 4) - ratio)
      ];
    } else if (type === 2) {
      // Fibonacci
      const start1 = Math.floor(Math.random() * 5) + 1;
      const start2 = Math.floor(Math.random() * 5) + start1;
      sequence.push(start1);
      sequence.push(start2);
      sequence.push(start1 + start2);
      sequence.push(start2 + start1 + start2);
      answer = String(sequence[2] + sequence[3]);
      explanation = "Fibonacci sequence: each number is the sum of the preceding two.";
      options = [
        answer,
        String(sequence[3] + 5),
        String(sequence[3] * 2),
        String(sequence[2] + sequence[3] + 2)
      ];
    } else if (type === 3) {
      // Squares
      const start = Math.floor(Math.random() * 6) + 1;
      for (let i = 0; i < 4; i++) sequence.push(Math.pow(start + i, 2));
      answer = String(Math.pow(start + 4, 2));
      explanation = `Sequence of square numbers starting from ${start}².`;
      options = [
        answer,
        String(Math.pow(start + 4, 2) + 5),
        String(Math.pow(start + 5, 2)),
        String(Math.pow(start + 4, 2) - 3)
      ];
    } else if (type === 4) {
      // Cubes
      const start = Math.floor(Math.random() * 4) + 1;
      for (let i = 0; i < 4; i++) sequence.push(Math.pow(start + i, 3));
      answer = String(Math.pow(start + 4, 3));
      explanation = `Sequence of cube numbers starting from ${start}³.`;
      options = [
        answer,
        String(Math.pow(start + 4, 3) + 12),
        String(Math.pow(start + 4, 3) - start),
        String(Math.pow(start + 5, 3))
      ];
    } else if (type === 5) {
      // Alternating
      const start = Math.floor(Math.random() * 20) + 10;
      const step1 = Math.floor(Math.random() * 5) + 3;
      const step2 = Math.floor(Math.random() * 2) + 1;
      sequence.push(start);
      sequence.push(start + step1);
      sequence.push(sequence[1] - step2);
      sequence.push(sequence[2] + step1);
      sequence.push(sequence[3] - step2);
      answer = String(sequence[4] + step1);
      explanation = `Alternating pattern of +${step1} and -${step2}.`;
      options = [
        answer,
        String(sequence[4] - step2),
        String(sequence[4] + step1 - step2),
        String(sequence[4] + 1)
      ];
    } else {
      // Primes
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
      const startIndex = Math.floor(Math.random() * 6); // Up to 13
      for (let i = 0; i < 4; i++) sequence.push(primes[startIndex + i]);
      answer = String(primes[startIndex + 4]);
      explanation = "Sequence of consecutive prime numbers.";
      options = [
        answer,
        String(primes[startIndex + 4] + 2),
        String(primes[startIndex + 4] - 1),
        String(primes[startIndex + 4] + 4)
      ];
    }

  } else if (selectedMode === 'letter') {
    const type = Math.floor(Math.random() * 4);
    if (type === 0) {
      // Simple skip skip skip
      const start = Math.floor(Math.random() * 10);
      const step = Math.floor(Math.random() * 3) + 2; // step of 2 or 3
      for (let i = 0; i < 4; i++) {
        sequence.push(ALPHABET[(start + i * step) % 26]);
      }
      answer = ALPHABET[(start + 4 * step) % 26];
      explanation = `Letters skipping by ${step} positions forward.`;
      options = [
        answer,
        ALPHABET[(start + 4 * step + 1) % 26],
        ALPHABET[(start + 4 * step - 1) % 26],
        ALPHABET[(start + 4 * step + step) % 26]
      ];
    } else if (type === 1) {
      // Incremental skip (A C F J ?)
      const start = Math.floor(Math.random() * 5);
      let curr = start;
      for (let i = 1; i <= 4; i++) {
        sequence.push(ALPHABET[curr % 26]);
        curr += i;
      }
      answer = ALPHABET[curr % 26];
      explanation = "Skip increment increases by 1 each letter (+1, +2, +3, +4...).";
      options = [
        answer,
        ALPHABET[(curr + 1) % 26],
        ALPHABET[(curr - 1) % 26],
        ALPHABET[(curr + 5) % 26]
      ];
    } else if (type === 2) {
      // Backwards
      const start = 25 - Math.floor(Math.random() * 5);
      const step = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < 4; i++) {
        sequence.push(ALPHABET[(start - i * step + 26) % 26]);
      }
      answer = ALPHABET[(start - 4 * step + 52) % 26];
      explanation = `Letters moving backwards by ${step} positions.`;
      options = [
        answer,
        ALPHABET[(start - 4 * step + 53) % 26],
        ALPHABET[(start - 4 * step + step + 52) % 26],
        ALPHABET[(start - 3 * step + 52) % 26]
      ];
    } else {
      // Double Letters
      const start = Math.floor(Math.random() * 15);
      for (let i = 0; i < 4; i++) {
        const char = ALPHABET[start + i];
        sequence.push(char + char);
      }
      const ansChar = ALPHABET[start + 4];
      answer = ansChar + ansChar;
      explanation = "Sequence of consecutive double letters.";
      options = [
        answer,
        ALPHABET[start + 4] + ALPHABET[start + 5],
        ALPHABET[start + 3] + ALPHABET[start + 3],
        ALPHABET[start + 5] + ALPHABET[start + 5]
      ];
    }

  } else if (selectedMode === 'shape') {
    const size = Math.floor(Math.random() * 2) + 2; // 2 or 3 repeating
    const shapes = Math.random() > 0.5 
      ? SHAPE_POOL.sort(() => 0.5 - Math.random()).slice(0, size)
      : ['🔺', '🟩', '🟡'].slice(0, size);
    
    for (let i = 0; i < 5; i++) {
      sequence.push(shapes[i % size]);
    }
    answer = shapes[5 % size];
    explanation = `Repeating shape sequence of length ${size}: ${shapes.join(' ')}.`;
    options = [
      answer,
      shapes[(5 + 1) % size] || SHAPE_POOL[9],
      SHAPE_POOL[0] === answer ? SHAPE_POOL[1] : SHAPE_POOL[0],
      SHAPE_POOL[2] === answer ? SHAPE_POOL[3] : SHAPE_POOL[2]
    ];

  } else {
    // Colors
    const size = Math.floor(Math.random() * 2) + 2; // 2 or 3 repeating
    const colors = Math.random() > 0.5 
      ? COLOR_POOL.sort(() => 0.5 - Math.random()).slice(0, size)
      : ['🔴', '🔵', '🟢'].slice(0, size);
      
    for (let i = 0; i < 5; i++) {
      sequence.push(colors[i % size]);
    }
    answer = colors[5 % size];
    explanation = `Repeating color sequence of length ${size}: ${colors.join(' ')}.`;
    options = [
      answer,
      colors[(5 + 1) % size] || COLOR_POOL[7],
      COLOR_POOL[0] === answer ? COLOR_POOL[1] : COLOR_POOL[0],
      COLOR_POOL[2] === answer ? COLOR_POOL[3] : COLOR_POOL[2]
    ];
  }

  // Deduplicate and shuffle options
  let uniqueOptions = Array.from(new Set(options)).filter(o => o !== undefined);
  while (uniqueOptions.length < 4) {
    if (selectedMode === 'number') {
      uniqueOptions.push(String(Math.floor(Math.random() * 100)));
    } else if (selectedMode === 'letter') {
      uniqueOptions.push(ALPHABET[Math.floor(Math.random() * 26)]);
    } else if (selectedMode === 'shape') {
      uniqueOptions.push(SHAPE_POOL[Math.floor(Math.random() * SHAPE_POOL.length)]);
    } else {
      uniqueOptions.push(COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)]);
    }
    uniqueOptions = Array.from(new Set(uniqueOptions));
  }

  // Shuffle options
  const shuffledOptions = uniqueOptions.sort(() => Math.random() - 0.5);

  return {
    mode: selectedMode,
    sequence: sequence.join(' '),
    answer,
    options: shuffledOptions,
    explanation
  };
};

export default function Patternmaster() {
  const { user, addCoins } = useAuth();
  const [mode, setMode] = useState('mixed'); // 'number', 'letter', 'shape', 'color', 'mixed'
  const [currentPattern, setCurrentPattern] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  const startNewPattern = (newMode = mode) => {
    playSound('click');
    setCurrentPattern(generatePattern(newMode));
    setSelectedAnswer(null);
    setIsAnswered(false);
  };

  useEffect(() => {
    startNewPattern(mode);
  }, [mode]);

  const handleOptionClick = (option) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
    setIsAnswered(true);
    setTotalAnswered(t => t + 1);

    const isCorrect = option === currentPattern.answer;
    if (isCorrect) {
      playSound('win');
      setScore(s => s + 5);
      setStreak(st => st + 1);
      if (addCoins) {
        addCoins(5);
      }
    } else {
      playSound('error');
      setStreak(0);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', width: '100%' }}>
      
      {/* Top Banner */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex' }}>
            <Brain size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff', fontWeight: 700 }}>PATTERN MASTER</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              AI Sequence Decoder
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '2px', border: '1px solid var(--glass-border)' }}>
          {['mixed', 'number', 'letter', 'shape', 'color'].map((m) => (
            <button 
              key={m}
              onClick={() => { setMode(m); }}
              style={{
                padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: 'none', borderRadius: '4px',
                background: mode === m ? 'var(--primary)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: '0.2s',
                textTransform: 'capitalize'
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Display */}
      <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: '420px', justifyContent: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Coins size={16} color="#fbbf24" />
          <span style={{ fontSize: '0.85rem' }}>Points: <strong style={{ color: 'var(--primary)' }}>{score}</strong></span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={16} color="#f97316" />
          <span style={{ fontSize: '0.85rem' }}>Streak: <strong style={{ color: '#f97316' }}>{streak}</strong></span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={16} color="#fbbf24" />
          <span style={{ fontSize: '0.85rem' }}>Solved: <strong>{totalAnswered}</strong></span>
        </div>
      </div>

      {/* Question Card */}
      {currentPattern && (
        <div style={{
          width: '100%', maxWidth: '460px', background: 'rgba(0,0,0,0.3)', border: '2px solid var(--glass-border)', borderRadius: '12px', padding: '2rem 1.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative', overflow: 'hidden'
        }}>
          {/* Neon backdrop glow */}
          <div style={{
            position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '60px',
            background: 'var(--primary)', filter: 'blur(40px)', opacity: 0.15, borderRadius: '50%', pointerEvents: 'none'
          }} />

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Decode the sequence:
          </span>

          <div style={{
            fontSize: currentPattern.mode === 'shape' || currentPattern.mode === 'color' ? '2.5rem' : '2.2rem',
            fontWeight: 800, color: '#fff', letterSpacing: '8px', textShadow: '0 0 10px rgba(255,255,255,0.2)', textAlign: 'center'
          }}>
            {currentPattern.sequence} <span style={{ color: 'var(--primary)', textShadow: '0 0 10px var(--primary-glow)' }}>?</span>
          </div>

          {/* Options Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', width: '100%', marginTop: '1rem' }}>
            {currentPattern.options.map((option, idx) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === currentPattern.answer;
              let bg = 'rgba(255,255,255,0.04)';
              let border = '1px solid var(--glass-border)';
              let color = '#fff';

              if (isAnswered) {
                if (isCorrect) {
                  bg = 'rgba(21, 128, 61, 0.2)';
                  border = '1px solid #22c55e';
                  color = '#4ade80';
                } else if (isSelected) {
                  bg = 'rgba(220, 38, 38, 0.2)';
                  border = '1px solid #ef4444';
                  color = '#f87171';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  disabled={isAnswered}
                  style={{
                    background: bg, border: border, color: color, borderRadius: '8px', padding: '1rem',
                    fontSize: currentPattern.mode === 'shape' || currentPattern.mode === 'color' ? '1.8rem' : '1.1rem',
                    fontWeight: 700, cursor: isAnswered ? 'default' : 'pointer', transition: 'all 0.2s',
                    boxShadow: isSelected ? '0 0 12px rgba(255,255,255,0.05)' : 'none'
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {/* Answer Reveal Alert */}
          {isAnswered && (
            <div style={{
              width: '100%', background: selectedAnswer === currentPattern.answer ? 'rgba(21, 128, 61, 0.08)' : 'rgba(220, 38, 38, 0.08)',
              border: `1px solid ${selectedAnswer === currentPattern.answer ? '#22c55e' : '#ef4444'}`,
              borderRadius: '8px', padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700, color: selectedAnswer === currentPattern.answer ? '#4ade80' : '#f87171' }}>
                {selectedAnswer === currentPattern.answer ? (
                  <><Check size={16} /> Correct! +5 Neon Coins 🪙</>
                ) : (
                  <><X size={16} /> Incorrect! Correct is: {currentPattern.answer}</>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {currentPattern.explanation}
              </p>
            </div>
          )}

          {/* Next Question Control */}
          {isAnswered && (
            <button className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => startNewPattern()}>
              Next Sequence
            </button>
          )}
        </div>
      )}
    </div>
  );
}
