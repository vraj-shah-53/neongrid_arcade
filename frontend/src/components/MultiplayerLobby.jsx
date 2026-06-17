import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { playSound } from '../utils/audio';
import { Shield, Send, Check, X, RefreshCw, Trophy, Flame } from 'lucide-react';

const MULTIPLAYER_GAMES = [
  { id: 'tictactoe', name: 'Tic-Tac-Toe' },
  { id: 'rps', name: 'Rock Paper Scissors' },
  { id: 'memory', name: 'Memory Match Duel' },
  { id: 'numberguess', name: 'Smart Guessing Duel' },
  { id: 'scribbles', name: 'Scribbles Synced Canvas' },
  { id: 'nodehack', name: 'Hack the Node (Trivia)' }
];

export default function MultiplayerLobby({ onLaunchRoom }) {
  const { user, logout, checkUser } = useAuth();
  const [receiverEmail, setReceiverEmail] = useState('');
  const [selectedGame, setSelectedGame] = useState('tictactoe');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const pollTimerRef = useRef(null);

  const fetchChallenges = async () => {
    try {
      const res = await fetch(window.API_BASE_URL + '/api/challenges/list/', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setIncoming(data.incoming || []);
        setOutgoing(data.outgoing || []);
        
        // Proactively auto-launch if one of our outgoing challenges was accepted
        if (data.accepted && data.accepted.length > 0) {
          const validAccepted = data.accepted.filter(c => MULTIPLAYER_GAMES.some(mg => mg.id === c.game_type));
          if (validAccepted.length > 0) {
            const firstAccepted = validAccepted[0];
            playSound('match');
            onLaunchRoom(firstAccepted.room_id, firstAccepted.game_type);
          }
        }
      }
    } catch (e) {
      console.warn("Error polling challenges:", e);
    }
  };

  useEffect(() => {
    fetchChallenges();
    if (checkUser) checkUser();
    // Poll every 3 seconds
    pollTimerRef.current = setInterval(fetchChallenges, 3000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleSendChallenge = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    playSound('click');

    if (!receiverEmail.trim()) {
      setError("Please input a valid player email.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(window.API_BASE_URL + '/api/challenges/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiver_email: receiverEmail.trim().toLowerCase(),
          game_type: selectedGame
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Challenge sent successfully to ${receiverEmail}`);
        setReceiverEmail('');
        fetchChallenges();
      } else {
        setError(data.error || "Could not send challenge.");
      }
    } catch (err) {
      setError("Network error sending challenge.");
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (challengeId, action) => {
    playSound('click');
    try {
      const res = await fetch(window.API_BASE_URL + '/api/challenges/respond/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challenge_id: challengeId,
          action: action
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'accept') {
          playSound('match');
          onLaunchRoom(data.room_id, incoming.find(c => c.challenge_id === challengeId).game_type);
        } else {
          fetchChallenges();
        }
      } else {
        setError(data.error || "Error responding to challenge.");
      }
    } catch (err) {
      setError("Network error responding to challenge.");
    }
  };

  const getGameName = (id) => {
    const g = MULTIPLAYER_GAMES.find(item => item.id === id);
    return g ? g.name : id;
  };

  return (
    <div className="lobby-container">
      <div className="lobby-grid">
        {/* Left Side: Stats & Challenge Panel */}
        <div className="lobby-left">
          {/* User Profile Card */}
          <div className="lobby-profile-card">
            <div className="profile-header">
              <div className="avatar-placeholder">
                <Shield size={36} color="var(--primary)" />
              </div>
              <div>
                <h2>{user.name}</h2>
                <p className="profile-email">{user.email}</p>
              </div>
            </div>
            
            <div className="profile-stats-grid">
              <div className="stat-box wins">
                <Trophy size={18} />
                <span className="stat-label">Wins</span>
                <span className="stat-value">{user.wins}</span>
              </div>
              <div className="stat-box losses">
                <Flame size={18} />
                <span className="stat-label">Losses</span>
                <span className="stat-value">{user.losses}</span>
              </div>
              <div className="stat-box ties">
                <span className="stat-label">Ties</span>
                <span className="stat-value">{user.ties}</span>
              </div>
            </div>

            <button className="btn-secondary logout-btn" onClick={() => { playSound('click'); logout(); }}>
              Disconnect Account
            </button>
          </div>

          {/* Send Challenge Form */}
          <div className="lobby-challenge-card">
            <h3>SEND INVITATION CHALLENGE</h3>
            {error && <div className="lobby-error">{error}</div>}
            {message && <div className="lobby-success">{message}</div>}
            
            <form onSubmit={handleSendChallenge} className="lobby-form">
              <div className="form-group">
                <label>Opponent's Net Email</label>
                <input
                  type="email"
                  placeholder="enter opponent email id..."
                  value={receiverEmail}
                  onChange={(e) => setReceiverEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Select Game Module</label>
                <select 
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className="lobby-select"
                >
                  {MULTIPLAYER_GAMES.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn-primary invite-submit-btn" disabled={loading}>
                <Send size={16} /> {loading ? 'SENDING INTRUSION...' : 'SEND CHALLENGE REQUEST'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Active Challenges lists */}
        <div className="lobby-right">
          {/* Incoming challenges */}
          <div className="lobby-list-card">
            <div className="card-header-with-action">
              <h3>INCOMING REQUESTS</h3>
              <button className="btn-refresh" onClick={fetchChallenges} title="Sync Lists">
                <RefreshCw size={14} />
              </button>
            </div>
            {incoming.length === 0 ? (
              <div className="empty-list-placeholder">No active incoming invites.</div>
            ) : (
              <div className="challenge-items">
                {incoming.map(c => (
                  <div key={c.challenge_id} className="challenge-item incoming">
                    <div className="challenge-item-details">
                      <span className="challenge-sender">{c.sender_name}</span>
                      <span className="challenge-game">{getGameName(c.game_type)}</span>
                      <span className="challenge-subtext">{c.sender_email}</span>
                    </div>
                    <div className="challenge-item-actions">
                      <button className="btn-accept" onClick={() => handleRespond(c.challenge_id, 'accept')} title="Accept Invite">
                        <Check size={16} /> Accept
                      </button>
                      <button className="btn-decline" onClick={() => handleRespond(c.challenge_id, 'reject')} title="Decline Invite">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing challenges */}
          <div className="lobby-list-card">
            <h3>SENT INVITATIONS</h3>
            {outgoing.length === 0 ? (
              <div className="empty-list-placeholder">No active sent invitations.</div>
            ) : (
              <div className="challenge-items">
                {outgoing.map(c => (
                  <div key={c.challenge_id} className="challenge-item outgoing">
                    <div className="challenge-item-details">
                      <span className="challenge-receiver">Invited: {c.receiver_name}</span>
                      <span className="challenge-game">{getGameName(c.game_type)}</span>
                      <span className="challenge-subtext">{c.receiver_email}</span>
                    </div>
                    <div className="challenge-item-status">
                      <span className="status-badge pending">Awaiting Response...</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
