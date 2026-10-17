// ============================================
// Room Manager — Multiplayer Communication
// Uses BroadcastChannel + localStorage for
// same-device multiplayer demo
// ============================================

const ROOM_STORAGE_KEY = 'soundforge_rooms';

class RoomManager {
  constructor() {
    this.channel = null;
    this.roomCode = null;
    this.isHost = false;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onGameStart = null;
    this.onRoundData = null;
    this.onPlayerAnswer = null;
    this.onGameEnd = null;
    this.onMessage = null;
  }

  /**
   * Create a new room
   */
  createRoom(roomCode, hostPlayer) {
    this.roomCode = roomCode;
    this.isHost = true;

    // Store room data
    const rooms = this._getRooms();
    rooms[roomCode] = {
      code: roomCode,
      host: hostPlayer,
      players: [hostPlayer],
      status: 'waiting',
      createdAt: Date.now(),
      settings: {}
    };
    this._saveRooms(rooms);

    // Set up communication channel
    this._initChannel(roomCode);

    return rooms[roomCode];
  }

  /**
   * Join an existing room
   */
  joinRoom(roomCode, player) {
    const rooms = this._getRooms();
    const room = rooms[roomCode];

    if (!room) {
      return { error: 'Room not found' };
    }

    if (room.status !== 'waiting') {
      return { error: 'Game already in progress' };
    }

    // Check if player already in room
    const existing = room.players.find(p => p.id === player.id);
    if (!existing) {
      room.players.push(player);
      this._saveRooms(rooms);
    }

    this.roomCode = roomCode;
    this.isHost = false;

    // Set up communication channel
    this._initChannel(roomCode);

    // Notify others
    this._broadcast({
      type: 'player_joined',
      player: player,
      players: room.players
    });

    return room;
  }

  /**
   * Leave a room
   */
  leaveRoom(playerId) {
    if (!this.roomCode) return;

    const rooms = this._getRooms();
    const room = rooms[this.roomCode];

    if (room) {
      room.players = room.players.filter(p => p.id !== playerId);

      if (room.players.length === 0) {
        delete rooms[this.roomCode];
      } else if (room.host.id === playerId) {
        room.host = room.players[0];
      }

      this._saveRooms(rooms);

      this._broadcast({
        type: 'player_left',
        playerId: playerId,
        players: room.players
      });
    }

    this._closeChannel();
    this.roomCode = null;
    this.isHost = false;
  }

  /**
   * Get room data
   */
  getRoom(roomCode) {
    const rooms = this._getRooms();
    return rooms[roomCode] || null;
  }

  /**
   * Get current room players
   */
  getPlayers() {
    if (!this.roomCode) return [];
    const room = this.getRoom(this.roomCode);
    return room ? room.players : [];
  }

  /**
   * Broadcast game start
   */
  broadcastGameStart(gameState) {
    if (!this.isHost) return;

    const rooms = this._getRooms();
    if (rooms[this.roomCode]) {
      rooms[this.roomCode].status = 'playing';
      this._saveRooms(rooms);
    }

    this._broadcast({
      type: 'game_start',
      totalRounds: gameState.totalRounds,
      tracks: gameState.tracks,
      players: gameState.players,
      playlistName: gameState.playlistName
    });
  }

  /**
   * Broadcast round data
   */
  broadcastRound(roundData, roundNumber) {
    this._broadcast({
      type: 'round_data',
      round: roundData,
      roundNumber: roundNumber
    });
  }

  /**
   * Broadcast a player's answer
   */
  broadcastAnswer(playerId, result) {
    this._broadcast({
      type: 'player_answer',
      playerId: playerId,
      result: result
    });
  }

  /**
   * Broadcast game end
   */
  broadcastGameEnd(results) {
    this._broadcast({
      type: 'game_end',
      results: results
    });

    // Update room status
    const rooms = this._getRooms();
    if (rooms[this.roomCode]) {
      rooms[this.roomCode].status = 'finished';
      this._saveRooms(rooms);
    }
  }

  /**
   * Generate invite link
   */
  getInviteLink() {
    const url = new URL(window.location.href);
    url.searchParams.set('join', this.roomCode);
    return url.toString();
  }

  // --- Private Methods ---

  _initChannel(roomCode) {
    this._closeChannel();
    this.channel = new BroadcastChannel(`soundforge_${roomCode}`);
    this.channel.onmessage = (event) => {
      const data = event.data;
      this._handleMessage(data);
    };
  }

  _closeChannel() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  _broadcast(data) {
    if (this.channel) {
      this.channel.postMessage(data);
    }
  }

  _handleMessage(data) {
    switch (data.type) {
      case 'player_joined':
        if (this.onPlayerJoined) this.onPlayerJoined(data.player, data.players);
        break;
      case 'player_left':
        if (this.onPlayerLeft) this.onPlayerLeft(data.playerId, data.players);
        break;
      case 'game_start':
        if (this.onGameStart) this.onGameStart(data);
        break;
      case 'round_data':
        if (this.onRoundData) this.onRoundData(data.round, data.roundNumber);
        break;
      case 'player_answer':
        if (this.onPlayerAnswer) this.onPlayerAnswer(data.playerId, data.result);
        break;
      case 'game_end':
        if (this.onGameEnd) this.onGameEnd(data.results);
        break;
    }

    if (this.onMessage) this.onMessage(data);
  }

  _getRooms() {
    try {
      return JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  _saveRooms(rooms) {
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(rooms));
  }

  /**
   * Clean up old rooms (>1 hour)
   */
  cleanupRooms() {
    const rooms = this._getRooms();
    const cutoff = Date.now() - 3600000;
    let changed = false;

    for (const code in rooms) {
      if (rooms[code].createdAt < cutoff) {
        delete rooms[code];
        changed = true;
      }
    }

    if (changed) this._saveRooms(rooms);
  }
}

export const roomManager = new RoomManager();
