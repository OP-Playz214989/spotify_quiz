// ============================================
// Quiz Game Engine
// ============================================

/**
 * Shuffles an array in place (Fisher-Yates)
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a quiz round from available tracks
 */
export function generateRound(tracks, usedTrackIds = new Set()) {
  // Filter out already-used tracks for the correct answer
  let availableTracks = tracks.filter(t => !usedTrackIds.has(t.id));

  // If we've used all tracks, reset
  if (availableTracks.length < 1) {
    usedTrackIds.clear();
    availableTracks = [...tracks];
  }

  // Pick correct answer
  const correctIndex = Math.floor(Math.random() * availableTracks.length);
  const correctTrack = availableTracks[correctIndex];

  // Pick 3 wrong answers (can be from any track)
  const wrongTracks = shuffle(
    tracks.filter(t => t.id !== correctTrack.id)
  ).slice(0, 3);

  // Combine and shuffle options
  const options = shuffle([correctTrack, ...wrongTracks]);
  const correctOptionIndex = options.findIndex(t => t.id === correctTrack.id);

  return {
    correctTrack,
    options,
    correctOptionIndex
  };
}

/**
 * Calculate score based on remaining time
 * Max 1000 points, decreases as time runs out
 */
export function calculateScore(timeRemaining, totalTime = 10) {
  const ratio = timeRemaining / totalTime;
  // Base score: 500 for correct answer
  // Time bonus: up to 500 based on speed
  const baseScore = 500;
  const timeBonus = Math.round(500 * ratio);
  return baseScore + timeBonus;
}

/**
 * Generate a 6-digit room code
 */
export function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create a game state object
 */
export function createGameState({
  mode = 'solo',
  totalRounds = 10,
  tracks = [],
  players = [],
  roomCode = null,
  playlistSource = 'select'
}) {
  return {
    mode,
    totalRounds,
    currentRound: 0,
    tracks,
    players: players.map(p => ({
      ...p,
      score: 0,
      correctAnswers: 0,
      avgResponseTime: 0,
      responseTimes: []
    })),
    roomCode,
    playlistSource,
    usedTrackIds: new Set(),
    rounds: [],
    isActive: false,
    isFinished: false
  };
}

/**
 * Process a player's answer for a round
 */
export function processAnswer(gameState, playerId, selectedIndex, timeRemaining) {
  const currentRound = gameState.rounds[gameState.currentRound - 1];
  if (!currentRound) return null;

  const isCorrect = selectedIndex === currentRound.correctOptionIndex;
  const score = isCorrect ? calculateScore(timeRemaining) : 0;
  const responseTime = 10 - timeRemaining;

  // Update player stats
  const player = gameState.players.find(p => p.id === playerId);
  if (player) {
    player.score += score;
    if (isCorrect) player.correctAnswers++;
    player.responseTimes.push(responseTime);
    player.avgResponseTime = player.responseTimes.reduce((a, b) => a + b, 0) / player.responseTimes.length;
  }

  return {
    isCorrect,
    score,
    responseTime,
    correctTrack: currentRound.correctTrack,
    correctIndex: currentRound.correctOptionIndex
  };
}

/**
 * Start next round
 */
export function startNextRound(gameState) {
  if (gameState.currentRound >= gameState.totalRounds) {
    gameState.isFinished = true;
    return null;
  }

  gameState.currentRound++;
  const round = generateRound(gameState.tracks, gameState.usedTrackIds);
  gameState.usedTrackIds.add(round.correctTrack.id);
  gameState.rounds.push(round);

  return round;
}

/**
 * Get final results sorted by score
 */
export function getResults(gameState) {
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

  return {
    players: sortedPlayers,
    totalRounds: gameState.totalRounds,
    mode: gameState.mode
  };
}

/**
 * Win streak management
 */
export function getWinStreak(userId) {
  const streaks = JSON.parse(localStorage.getItem('soundforge_streaks') || '{}');
  return streaks[userId] || 0;
}

export function updateWinStreak(userId, won) {
  const streaks = JSON.parse(localStorage.getItem('soundforge_streaks') || '{}');
  if (won) {
    streaks[userId] = (streaks[userId] || 0) + 1;
  } else {
    streaks[userId] = 0;
  }
  localStorage.setItem('soundforge_streaks', JSON.stringify(streaks));
  return streaks[userId];
}
