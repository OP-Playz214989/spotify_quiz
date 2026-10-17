// ============================================
// Spotify API Integration (PKCE OAuth Flow)
// ============================================

const CLIENT_ID = ''; // User must provide their Spotify App Client ID
// --- Dynamic Redirect URI helper ---
export function getRedirectUri() {
  const origin = window.location.origin.replace('localhost', '127.0.0.1');
  return origin + window.location.pathname;
}

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming',
  'user-library-read'
].join(' ');

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

// --- PKCE Helpers ---
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  values.forEach(v => result += chars[v % chars.length]);
  return result;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer) {
  let str = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- Auth State ---
let accessToken = null;
let refreshToken = null;
let tokenExpiry = null;
let currentUser = null;

/**
 * Configure or change the stored Client ID
 */
export function configureClientId() {
  const current = localStorage.getItem('spotify_client_id') || '';
  const redirectUri = getRedirectUri();
  const id = prompt(
    'SPOTIFY APP CONFIGURATION\n\n' +
    '1. Go to https://developer.spotify.com/dashboard\n' +
    '2. In your App settings, add this exact Redirect URI:\n   ' + redirectUri + '\n' +
    '3. Enter your Spotify Client ID below:',
    current
  );
  if (id !== null) {
    const trimmed = id.trim();
    if (trimmed) {
      localStorage.setItem('spotify_client_id', trimmed);
      return trimmed;
    }
  }
  return current;
}

/**
 * Get the stored Client ID or prompt for one
 */
export function getClientId() {
  let id = localStorage.getItem('spotify_client_id');
  if (!id) {
    id = configureClientId();
  }
  return id ? id.trim() : null;
}

/**
 * Initiate Spotify login
 */
export async function login() {
  const clientId = getClientId();
  if (!clientId) return;

  const codeVerifier = generateRandomString(64);
  sessionStorage.setItem('code_verifier', codeVerifier);

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);

  const state = generateRandomString(16);
  sessionStorage.setItem('auth_state', state);

  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  window.location.href = `${AUTH_URL}?${params.toString()}`;
}

/**
 * Handle the OAuth callback
 */
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    console.error('Auth error from Spotify:', error);
    // Clean up URL parameters
    window.history.replaceState({}, document.title, getRedirectUri());
    return { error };
  }

  if (!code) return false;

  const storedState = sessionStorage.getItem('auth_state');
  if (state !== storedState) {
    console.error('State mismatch');
    return false;
  }

  const codeVerifier = sessionStorage.getItem('code_verifier');
  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });

    const data = await response.json();

    if (data.access_token) {
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
      tokenExpiry = Date.now() + data.expires_in * 1000;

      localStorage.setItem('spotify_access_token', accessToken);
      localStorage.setItem('spotify_refresh_token', refreshToken);
      localStorage.setItem('spotify_token_expiry', tokenExpiry.toString());

      // Clean up URL
      window.history.replaceState({}, document.title, redirectUri);
      sessionStorage.removeItem('code_verifier');
      sessionStorage.removeItem('auth_state');

      return true;
    } else if (data.error_description || data.error) {
      console.error('Token error:', data);
      return { error: data.error_description || data.error };
    }
  } catch (err) {
    console.error('Token exchange failed:', err);
    return { error: err.message };
  }

  return false;
}

/**
 * Check if we have a valid token
 */
export function isAuthenticated() {
  const stored = localStorage.getItem('spotify_access_token');
  const expiry = localStorage.getItem('spotify_token_expiry');

  if (stored && expiry && Date.now() < parseInt(expiry)) {
    accessToken = stored;
    refreshToken = localStorage.getItem('spotify_refresh_token');
    tokenExpiry = parseInt(expiry);
    return true;
  }

  return false;
}

/**
 * Refresh the access token
 */
async function refreshAccessToken() {
  const clientId = getClientId();
  if (!refreshToken || !clientId) return false;

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    const data = await response.json();

    if (data.access_token) {
      accessToken = data.access_token;
      if (data.refresh_token) refreshToken = data.refresh_token;
      tokenExpiry = Date.now() + data.expires_in * 1000;

      localStorage.setItem('spotify_access_token', accessToken);
      localStorage.setItem('spotify_refresh_token', refreshToken);
      localStorage.setItem('spotify_token_expiry', tokenExpiry.toString());

      return true;
    }
  } catch (err) {
    console.error('Token refresh failed:', err);
  }

  return false;
}

/**
 * Make an authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  if (!accessToken || (tokenExpiry && Date.now() >= tokenExpiry - 60000)) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      logout();
      throw new Error('Spotify session expired. Please connect again.');
    }
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers
    }
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...options.headers
        }
      });
    } else {
      logout();
      throw new Error('Spotify authorization expired. Please connect again.');
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Spotify API error (${response.status})`;
    if (response.status === 401 || response.status === 403) {
      logout();
    }
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Get current user profile
 */
export async function getCurrentUser() {
  if (currentUser) return currentUser;
  const user = await apiRequest('/me');
  if (!user || user.error) {
    logout();
    throw new Error(user?.error?.message || 'Could not load Spotify profile');
  }
  currentUser = user;
  return currentUser;
}

/**
 * Get user's playlists
 */
export async function getUserPlaylists(limit = 50) {
  try {
    const data = await apiRequest(`/me/playlists?limit=${limit}`);
    return data.items || [];
  } catch (err) {
    console.warn('Failed to load user playlists from Spotify:', err);
    return [];
  }
}

/**
 * Resolve 30-second audio preview via iTunes Search API as fallback
 */
async function resolveAudioPreview(trackName, artistName) {
  try {
    const cleanTitle = trackName.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const query = encodeURIComponent(`${cleanTitle} ${artistName}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.previewUrl || null;
  } catch {
    return null;
  }
}

/**
 * Built-in Demo Playlists (Guaranteed to work without Spotify Developer setup)
 */
export const DEMO_PLAYLISTS = [
  {
    id: 'demo-global-hits',
    name: '🔥 Global Megahits',
    tracks: { total: 10 },
    images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }],
    songs: [
      { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours' },
      { name: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia' },
      { name: 'Shape of You', artist: 'Ed Sheeran', album: 'Divide' },
      { name: 'Bad Guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep' },
      { name: 'Stay', artist: 'The Kid LAROI & Justin Bieber', album: 'F*CK LOVE 3' },
      { name: 'As It Was', artist: 'Harry Styles', album: "Harry's House" },
      { name: 'Starboy', artist: 'The Weeknd', album: 'Starboy' },
      { name: 'Heat Waves', artist: 'Glass Animals', album: 'Dreamland' },
      { name: 'Believer', artist: 'Imagine Dragons', album: 'Evolve' },
      { name: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', album: 'Uptown Special' }
    ]
  },
  {
    id: 'demo-rock-legends',
    name: '⚡ Rock & Alternative Legends',
    tracks: { total: 8 },
    images: [{ url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&q=80' }],
    songs: [
      { name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind' },
      { name: 'In the End', artist: 'Linkin Park', album: 'Hybrid Theory' },
      { name: 'Sweet Child O Mine', artist: "Guns N' Roses", album: 'Appetite for Destruction' },
      { name: 'Seven Nation Army', artist: 'The White Stripes', album: 'Elephant' },
      { name: 'Livin On A Prayer', artist: 'Bon Jovi', album: 'Slippery When Wet' },
      { name: 'Back In Black', artist: 'AC/DC', album: 'Back In Black' },
      { name: 'Numb', artist: 'Linkin Park', album: 'Meteora' },
      { name: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions' }
    ]
  },
  {
    id: 'demo-synth-retro',
    name: '🌆 Synthwave & 80s Icons',
    tracks: { total: 8 },
    images: [{ url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80' }],
    songs: [
      { name: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller' },
      { name: 'Take On Me', artist: 'a-ha', album: 'Hunting High and Low' },
      { name: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories' },
      { name: 'Midnight City', artist: 'M83', album: 'Hurry Up, We\'re Dreaming' },
      { name: 'Blue Monday', artist: 'New Order', album: 'Power, Corruption & Lies' },
      { name: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours' },
      { name: 'Sweet Dreams', artist: 'Eurythmics', album: 'Sweet Dreams' },
      { name: 'One More Time', artist: 'Daft Punk', album: 'Discovery' }
    ]
  }
];

/**
 * Get tracks for a demo playlist
 */
export async function getDemoTracks(playlistId) {
  const playlist = DEMO_PLAYLISTS.find(p => p.id === playlistId) || DEMO_PLAYLISTS[0];
  const tracks = [];

  for (let i = 0; i < playlist.songs.length; i++) {
    const s = playlist.songs[i];
    const preview = await resolveAudioPreview(s.name, s.artist);
    if (preview) {
      tracks.push({
        id: `demo-${playlistId}-${i}`,
        name: s.name,
        artist: s.artist,
        album: s.album,
        albumArt: playlist.images[0].url,
        previewUrl: preview,
        uri: `spotify:track:demo${i}`
      });
    }
  }

  return tracks;
}

/**
 * Get tracks from a playlist (handles Spotify + Fallback resolution + Demo playlists)
 */
export async function getPlaylistTracks(playlistId, limit = 50) {
  if (playlistId.startsWith('demo-')) {
    return getDemoTracks(playlistId);
  }

  const tracks = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && tracks.length < limit) {
    const data = await apiRequest(
      `/playlists/${playlistId}/tracks?offset=${offset}&limit=50&fields=items(track(id,name,artists,album(name,images),preview_url,uri)),total`
    );

    const items = data.items || [];
    for (const item of items) {
      if (!item.track || !item.track.name) continue;

      let previewUrl = item.track.preview_url;
      // If Spotify didn't include preview_url, resolve audio preview automatically
      if (!previewUrl) {
        previewUrl = await resolveAudioPreview(item.track.name, item.track.artists?.[0]?.name || '');
      }

      if (previewUrl) {
        tracks.push({
          id: item.track.id,
          name: item.track.name,
          artist: item.track.artists.map(a => a.name).join(', '),
          album: item.track.album?.name || 'Unknown Album',
          albumArt: item.track.album?.images?.[0]?.url || '',
          previewUrl: previewUrl,
          uri: item.track.uri
        });
      }

      if (tracks.length >= limit) break;
    }

    offset += 50;
    hasMore = items.length === 50 && tracks.length < limit;
  }

  return tracks;
}

/**
 * Logout & clear state
 */
export function logout() {
  accessToken = null;
  refreshToken = null;
  tokenExpiry = null;
  currentUser = null;
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expiry');
}
