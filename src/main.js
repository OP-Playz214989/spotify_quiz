// ============================================
// SOUNDFORGE — Main Application
// ============================================

import './style.css';
import * as spotify from './spotify.js';
import * as game from './game.js';
import { roomManager } from './room.js';
import { initParticles, showToast, showScreen, confettiBurst, getDefaultAvatar } from './effects.js';

// ---- State ----
let currentUser = null;
let userPlaylists = [];
let selectedPlaylist = null;
let selectedRounds = 10;
let gameState = null;
let audioPlayer = null;
let timerInterval = null;
let timeRemaining = 10;
let currentRoundData = null;
let isAnswered = false;

// ---- DOM Elements ----
const $ = (sel) => document.getElementById(sel);

// ---- Initialize ----
async function init() {
  // Spotify forbids 'localhost' redirect URIs and requires '127.0.0.1'.
  // Auto-redirect if accessed via localhost so the origins match seamlessly.
  if (window.location.hostname === 'localhost') {
    window.location.replace(window.location.href.replace('//localhost', '//127.0.0.1'));
    return;
  }

  // Init particles
  initParticles();

  // Set up audio player
  audioPlayer = $('audio-player');

  // Clean up old rooms
  roomManager.cleanupRooms();

  // Check for join link
  const urlParams = new URLSearchParams(window.location.search);
  const joinCode = urlParams.get('join');

  // Check auth
  const authResult = await spotify.handleCallback();
  if (authResult === true) {
    await onAuthenticated();
    if (joinCode) {
      handleJoinFromLink(joinCode);
    }
  } else if (authResult && authResult.error) {
    showToast(`Spotify Auth Notice: ${authResult.error}`, 'error', 6000);
  } else if (spotify.isAuthenticated()) {
    await onAuthenticated();
    if (joinCode) {
      handleJoinFromLink(joinCode);
    }
  }

  // Bind events
  bindEvents();
}

// ---- Auth ----
async function onAuthenticated() {
  try {
    currentUser = await spotify.getCurrentUser();

    // Show user profile
    const avatar = $('user-avatar');
    const nameEl = $('user-name');
    const profileEl = $('user-profile');
    const connectBtn = $('btn-connect-spotify');
    const configBtn = $('btn-config-client-id');
    const demoBtn = $('btn-demo-mode');
    const modeSelection = $('mode-selection');

    avatar.src = currentUser.images?.[0]?.url || getDefaultAvatar(currentUser.display_name || 'Player');
    avatar.onerror = () => { avatar.src = getDefaultAvatar(currentUser.display_name || 'Player'); };
    nameEl.textContent = currentUser.display_name || 'Player';

    // Show win streak
    const streak = game.getWinStreak(currentUser.id);
    $('user-streak').textContent = streak;

    profileEl.classList.remove('hidden');
    if (connectBtn) connectBtn.style.display = 'none';
    if (configBtn) configBtn.style.display = 'none';
    if (demoBtn) demoBtn.style.display = 'none';
    modeSelection.classList.remove('hidden');

    // Load playlists (merge user's Spotify playlists + curated Demo Playlists)
    const spotifyPlaylists = await spotify.getUserPlaylists();
    userPlaylists = [...spotifyPlaylists, ...spotify.DEMO_PLAYLISTS];

    showToast(`Welcome, ${currentUser.display_name || 'Player'}!`, 'success');
  } catch (err) {
    console.error('Auth error:', err);
    spotify.logout();
    showToast(`Spotify: ${err.message}. You can also use Quick Demo Play below!`, 'error', 7000);
  }
}

// ---- Demo Mode (Guaranteed Playability) ----
function startDemoMode() {
  currentUser = {
    id: 'guest-' + Math.floor(1000 + Math.random() * 9000),
    display_name: 'Guest Player',
    images: [{ url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120' }]
  };

  const avatar = $('user-avatar');
  const nameEl = $('user-name');
  const profileEl = $('user-profile');
  const connectBtn = $('btn-connect-spotify');
  const configBtn = $('btn-config-client-id');
  const demoBtn = $('btn-demo-mode');
  const modeSelection = $('mode-selection');

  avatar.src = currentUser.images[0].url;
  nameEl.textContent = currentUser.display_name;

  const streak = game.getWinStreak(currentUser.id);
  $('user-streak').textContent = streak;

  profileEl.classList.remove('hidden');
  if (connectBtn) connectBtn.style.display = 'none';
  if (configBtn) configBtn.style.display = 'none';
  if (demoBtn) demoBtn.style.display = 'none';
  modeSelection.classList.remove('hidden');

  userPlaylists = [...spotify.DEMO_PLAYLISTS];
  showToast('Welcome to Demo Mode! Choose Solo or With Friends.', 'success');
}

// ---- Event Binding ----
function bindEvents() {
  // Connect Spotify
  $('btn-connect-spotify').addEventListener('click', () => {
    spotify.login();
  });

  // Demo Mode
  const demoBtn = $('btn-demo-mode');
  if (demoBtn) {
    demoBtn.addEventListener('click', startDemoMode);
  }

  // Configure Client ID button
  const configBtn = $('btn-config-client-id');
  if (configBtn) {
    configBtn.addEventListener('click', () => {
      const newId = spotify.configureClientId();
      if (newId) {
        showToast('Spotify Client ID saved! Click Connect Spotify to login.', 'success');
      }
    });
  }

  // Mode selection
  $('btn-solo').addEventListener('click', () => {
    showScreen('screen-solo-setup');
    renderPlaylistGrid('solo-playlist-list');
  });

  $('btn-multiplayer').addEventListener('click', () => {
    showScreen('screen-multiplayer');
  });

  // Back buttons
  $('btn-back-solo').addEventListener('click', () => showScreen('screen-landing'));
  $('btn-back-multi').addEventListener('click', () => showScreen('screen-landing'));
  $('btn-back-create').addEventListener('click', () => {
    if (roomManager.roomCode) {
      roomManager.leaveRoom(currentUser.id);
    }
    showScreen('screen-multiplayer');
  });
  $('btn-back-join').addEventListener('click', () => {
    if (roomManager.roomCode) {
      roomManager.leaveRoom(currentUser.id);
    }
    showScreen('screen-multiplayer');
  });

  // Round selectors
  document.querySelectorAll('.rounds-selector').forEach(selector => {
    selector.querySelectorAll('.round-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selector.querySelectorAll('.round-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRounds = parseInt(btn.dataset.rounds);
      });
    });
  });

  // Solo start
  $('btn-start-solo').addEventListener('click', startSoloGame);

  // Multiplayer - Create Room
  $('btn-create-room').addEventListener('click', createRoom);
  $('btn-join-room').addEventListener('click', () => showScreen('screen-join-room'));

  // Copy code/link
  $('btn-copy-code').addEventListener('click', copyRoomCode);
  $('btn-copy-link').addEventListener('click', copyRoomLink);

  // Join submit
  $('btn-join-submit').addEventListener('click', joinRoom);
  $('join-code-input').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
  });
  $('join-code-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });

  // Multi start
  $('btn-start-multi').addEventListener('click', startMultiGame);

  // Playlist source toggle
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Quiz options
  $('quiz-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (btn && !isAnswered) {
      handleAnswer(parseInt(btn.dataset.index));
    }
  });

  // Play again
  $('btn-play-again').addEventListener('click', () => {
    showScreen('screen-landing');
    gameState = null;
  });
}

// ---- Playlist Rendering ----
function renderPlaylistGrid(containerId) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (userPlaylists.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 2rem;">No playlists found. Make sure you have playlists in your Spotify account.</p>';
    return;
  }

  userPlaylists.forEach(playlist => {
    const el = document.createElement('div');
    el.className = 'playlist-item';
    el.dataset.id = playlist.id;

    const coverUrl = playlist.images?.[0]?.url || getDefaultAvatar(playlist.name);

    el.innerHTML = `
      <img class="playlist-cover" src="${coverUrl}" alt="${playlist.name}" onerror="this.src='${getDefaultAvatar(playlist.name)}'" />
      <div class="playlist-info">
        <div class="playlist-name">${playlist.name}</div>
        <div class="playlist-tracks">${playlist.tracks.total} tracks</div>
      </div>
    `;

    el.addEventListener('click', () => {
      container.querySelectorAll('.playlist-item').forEach(p => p.classList.remove('selected'));
      el.classList.add('selected');
      selectedPlaylist = playlist;

      // Enable start button
      const soloBtn = $('btn-start-solo');
      const multiBtn = $('btn-start-multi');
      if (soloBtn) soloBtn.disabled = false;
      if (multiBtn) multiBtn.disabled = false;
    });

    container.appendChild(el);
  });
}

// ---- Solo Game ----
async function startSoloGame() {
  if (!selectedPlaylist) {
    showToast('Please select a playlist first', 'error');
    return;
  }

  showToast('Loading tracks...', 'info');

  try {
    const tracks = await spotify.getPlaylistTracks(selectedPlaylist.id);

    if (tracks.length < 4) {
      showToast('Playlist needs at least 4 tracks with previews', 'error');
      return;
    }

    const player = {
      id: currentUser.id,
      name: currentUser.display_name,
      avatar: currentUser.images?.[0]?.url || getDefaultAvatar(currentUser.display_name)
    };

    const roundsToPlay = Math.min(selectedRounds, tracks.length);

    gameState = game.createGameState({
      mode: 'solo',
      totalRounds: roundsToPlay,
      tracks: tracks,
      players: [player]
    });

    gameState.isActive = true;
    showScreen('screen-quiz');
    renderScoreboard();
    playNextRound();
  } catch (err) {
    console.error('Failed to load tracks:', err);
    showToast('Failed to load playlist tracks', 'error');
  }
}

// ---- Multiplayer ----
function createRoom() {
  const code = game.generateRoomCode();

  const hostPlayer = {
    id: currentUser.id,
    name: currentUser.display_name,
    avatar: currentUser.images?.[0]?.url || getDefaultAvatar(currentUser.display_name)
  };

  roomManager.createRoom(code, hostPlayer);

  $('room-code').textContent = code;

  // Set up room event handlers
  roomManager.onPlayerJoined = (player, players) => {
    renderLobbyPlayers(players);
    showToast(`${player.name} joined!`, 'success');
  };

  roomManager.onPlayerLeft = (playerId, players) => {
    renderLobbyPlayers(players);
  };

  showScreen('screen-create-room');
  renderPlaylistGrid('create-playlist-list');
  renderLobbyPlayers(roomManager.getPlayers());

  // Enable start button
  $('btn-start-multi').disabled = false;
}

function renderLobbyPlayers(players) {
  const containers = ['lobby-player-list', 'join-lobby-players'];

  containers.forEach(id => {
    const container = $(id);
    if (!container) return;

    container.innerHTML = players.map(p => `
      <div class="player-chip ${p.id === currentUser?.id && roomManager.isHost ? 'host' : ''}">
        <img class="avatar" src="${p.avatar}" alt="${p.name}" onerror="this.src='${getDefaultAvatar(p.name)}'" />
        <span class="player-name">${p.name}</span>
      </div>
    `).join('');
  });
}

function copyRoomCode() {
  const code = $('room-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Room code copied!', 'success');
  });
}

function copyRoomLink() {
  const link = roomManager.getInviteLink();
  navigator.clipboard.writeText(link).then(() => {
    showToast('Invite link copied!', 'success');
  });
}

function joinRoom() {
  const code = $('join-code-input').value.trim();
  if (code.length !== 6) {
    showToast('Please enter a valid 6-digit code', 'error');
    return;
  }

  const player = {
    id: currentUser.id,
    name: currentUser.display_name,
    avatar: currentUser.images?.[0]?.url || getDefaultAvatar(currentUser.display_name)
  };

  const result = roomManager.joinRoom(code, player);

  if (result.error) {
    showToast(result.error, 'error');
    return;
  }

  // Set up event handlers for joined player
  roomManager.onGameStart = async (data) => {
    gameState = game.createGameState({
      mode: 'multiplayer',
      totalRounds: data.totalRounds,
      tracks: data.tracks,
      players: data.players
    });
    gameState.isActive = true;
    showScreen('screen-quiz');
    renderScoreboard();
    playNextRound();
  };

  roomManager.onPlayerJoined = (player, players) => {
    renderLobbyPlayers(players);
  };

  // Show waiting screen
  $('join-code-input').closest('.join-form').classList.add('hidden');
  $('join-waiting').classList.remove('hidden');
  renderLobbyPlayers(result.players);

  showToast('Joined room! Waiting for host...', 'success');
}

function handleJoinFromLink(code) {
  $('join-code-input').value = code;
  showScreen('screen-join-room');
  joinRoom();
  // Clean URL
  const url = new URL(window.location.href);
  url.searchParams.delete('join');
  window.history.replaceState({}, '', url.toString());
}

async function startMultiGame() {
  if (!selectedPlaylist) {
    showToast('Please select a playlist first', 'error');
    return;
  }

  showToast('Loading tracks...', 'info');

  try {
    const tracks = await spotify.getPlaylistTracks(selectedPlaylist.id);

    if (tracks.length < 4) {
      showToast('Playlist needs at least 4 tracks with previews', 'error');
      return;
    }

    const players = roomManager.getPlayers();
    const roundsToPlay = Math.min(selectedRounds, tracks.length);

    gameState = game.createGameState({
      mode: 'multiplayer',
      totalRounds: roundsToPlay,
      tracks: tracks,
      players: players,
      roomCode: roomManager.roomCode
    });

    gameState.isActive = true;

    // Broadcast game start to other players
    roomManager.broadcastGameStart(gameState);

    showScreen('screen-quiz');
    renderScoreboard();
    playNextRound();
  } catch (err) {
    console.error('Failed to start multiplayer game:', err);
    showToast('Failed to load playlist tracks', 'error');
  }
}

// ---- Quiz Gameplay ----
function renderScoreboard() {
  const scoreboard = $('quiz-scoreboard');
  scoreboard.innerHTML = gameState.players.map(p => `
    <div class="score-chip" data-player-id="${p.id}">
      <img class="avatar" src="${p.avatar}" alt="${p.name}" onerror="this.src='${getDefaultAvatar(p.name)}'" />
      <span class="score-value">${p.score}</span>
    </div>
  `).join('');

  $('total-rounds').textContent = gameState.totalRounds;
}

function updateScoreboard() {
  gameState.players.forEach(p => {
    const chip = document.querySelector(`.score-chip[data-player-id="${p.id}"] .score-value`);
    if (chip) chip.textContent = p.score;
  });
}

function playNextRound() {
  isAnswered = false;

  const round = game.startNextRound(gameState);

  if (!round) {
    // Game over
    endGame();
    return;
  }

  currentRoundData = round;
  $('current-round').textContent = gameState.currentRound;

  // Set options
  const optionBtns = document.querySelectorAll('.option-btn');
  optionBtns.forEach((btn, i) => {
    btn.classList.remove('correct', 'wrong');
    btn.disabled = false;
    const track = round.options[i];
    btn.querySelector('.option-text').textContent = `${track.name} — ${track.artist}`;
  });

  // Hide round result overlay
  $('round-result').classList.add('hidden');

  // Start playing audio
  playAudio(round.correctTrack.previewUrl);

  // Start timer
  startTimer();
}

function playAudio(url) {
  if (!audioPlayer) return;
  audioPlayer.src = url;
  audioPlayer.volume = 0.6;
  audioPlayer.currentTime = 0;

  const playPromise = audioPlayer.play();
  if (playPromise) {
    playPromise.catch(err => {
      console.warn('Audio autoplay blocked:', err);
      showToast('Click anywhere to enable audio', 'info');
    });
  }

  // Start vinyl spinning
  $('vinyl-record').classList.add('spinning');
}

function stopAudio() {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
  $('vinyl-record').classList.remove('spinning');
}

function startTimer() {
  timeRemaining = 10;
  $('timer-text').textContent = '10';

  const circumference = 2 * Math.PI * 90;
  const timerProgress = $('timer-progress');
  timerProgress.style.strokeDasharray = circumference;
  timerProgress.style.strokeDashoffset = '0';

  clearInterval(timerInterval);

  const startTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    timeRemaining = Math.max(0, 10 - elapsed);

    $('timer-text').textContent = Math.ceil(timeRemaining);

    // Update ring
    const progress = elapsed / 10;
    timerProgress.style.strokeDashoffset = (circumference * progress).toString();

    // Color change near end
    if (timeRemaining <= 3) {
      timerProgress.style.stroke = '#e74c3c';
    } else {
      timerProgress.style.stroke = 'var(--accent-primary)';
    }

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      if (!isAnswered) {
        handleTimeout();
      }
    }
  }, 50);
}

function handleAnswer(selectedIndex) {
  if (isAnswered) return;
  isAnswered = true;

  clearInterval(timerInterval);
  stopAudio();

  const result = game.processAnswer(gameState, currentUser.id, selectedIndex, timeRemaining);

  // Highlight correct and wrong
  const optionBtns = document.querySelectorAll('.option-btn');
  optionBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === result.correctIndex) {
      btn.classList.add('correct');
    } else if (i === selectedIndex && !result.isCorrect) {
      btn.classList.add('wrong');
    }
  });

  // Update scoreboard
  updateScoreboard();

  // Broadcast answer in multiplayer
  if (gameState.mode === 'multiplayer') {
    roomManager.broadcastAnswer(currentUser.id, result);
  }

  // Show round result
  showRoundResult(result);

  // Auto-proceed after delay
  setTimeout(() => {
    playNextRound();
  }, 2500);
}

function handleTimeout() {
  isAnswered = true;
  stopAudio();

  // Process as wrong answer (index -1, can't match)
  const result = game.processAnswer(gameState, currentUser.id, -1, 0);

  const optionBtns = document.querySelectorAll('.option-btn');
  optionBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === currentRoundData.correctOptionIndex) {
      btn.classList.add('correct');
    }
  });

  if (gameState.mode === 'multiplayer') {
    roomManager.broadcastAnswer(currentUser.id, result);
  }

  showRoundResult({ ...result, isTimeout: true });

  setTimeout(() => {
    playNextRound();
  }, 2500);
}

function showRoundResult(result) {
  const overlay = $('round-result');
  const icon = $('result-icon');
  const text = $('result-text');
  const score = $('result-score');
  const song = $('result-song');

  overlay.classList.remove('hidden');

  if (result.isTimeout) {
    icon.textContent = '⏰';
    text.textContent = 'TIME\'S UP!';
    text.className = 'timeout-text';
    score.textContent = '+0 points';
  } else if (result.isCorrect) {
    icon.textContent = '⚡';
    text.textContent = 'CORRECT!';
    text.className = 'correct-text';
    score.textContent = `+${result.score} points`;
  } else {
    icon.textContent = '✕';
    text.textContent = 'WRONG!';
    text.className = 'wrong-text';
    score.textContent = '+0 points';
  }

  song.textContent = `${result.correctTrack.name} — ${result.correctTrack.artist}`;
}

// ---- End Game ----
function endGame() {
  stopAudio();
  clearInterval(timerInterval);

  gameState.isActive = false;
  gameState.isFinished = true;

  const results = game.getResults(gameState);

  // Determine if current user won
  const isWinner = results.players[0]?.id === currentUser.id;
  const newStreak = game.updateWinStreak(currentUser.id, isWinner);

  // Broadcast results in multiplayer
  if (gameState.mode === 'multiplayer') {
    roomManager.broadcastGameEnd(results);
  }

  renderResults(results, newStreak, isWinner);
  showScreen('screen-results');

  if (isWinner) {
    setTimeout(confettiBurst, 500);
  }
}

function renderResults(results, streak, isWinner) {
  const players = results.players;

  // Podium
  const podium1 = $('podium-1st');
  const podium2 = $('podium-2nd');
  const podium3 = $('podium-3rd');

  // Fill podium positions
  function fillPodium(el, player) {
    if (!player) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'flex';
    el.querySelector('.podium-avatar').src = player.avatar;
    el.querySelector('.podium-avatar').onerror = function() { this.src = getDefaultAvatar(player.name); };
    el.querySelector('.podium-name').textContent = player.name;
    el.querySelector('.podium-score').textContent = player.score + ' pts';
  }

  fillPodium(podium1, players[0]);
  fillPodium(podium2, players[1]);
  fillPodium(podium3, players[2]);

  // Hide podium places if single player
  if (players.length === 1) {
    podium2.style.display = 'none';
    podium3.style.display = 'none';
  } else if (players.length === 2) {
    podium3.style.display = 'none';
  }

  // Stats
  const myPlayer = players.find(p => p.id === currentUser.id);
  const statsContainer = $('results-stats');
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">YOUR SCORE</div>
      <div class="stat-value">${myPlayer?.score || 0}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">CORRECT</div>
      <div class="stat-value">${myPlayer?.correctAnswers || 0}/${results.totalRounds}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">AVG SPEED</div>
      <div class="stat-value">${(myPlayer?.avgResponseTime || 0).toFixed(1)}s</div>
    </div>
  `;

  // Full leaderboard for >3 players
  const detailContainer = $('results-detail');
  if (players.length > 3) {
    detailContainer.innerHTML = players.slice(3).map((p, i) => `
      <div class="leaderboard-row">
        <span class="leaderboard-rank">${i + 4}</span>
        <img class="avatar" src="${p.avatar}" alt="${p.name}" onerror="this.src='${getDefaultAvatar(p.name)}'" />
        <span class="leaderboard-name">${p.name}</span>
        <span class="leaderboard-score">${p.score} pts</span>
      </div>
    `).join('');
  } else {
    detailContainer.innerHTML = '';
  }

  // Streak
  $('streak-text').textContent = isWinner
    ? `🔥 Win Streak: ${streak}`
    : `Win Streak Reset — 0`;

  // Update header streak badge too
  $('user-streak').textContent = streak;
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', init);
