# 🎧 SOUNDFORGE — Spotify Quiz Arena

An industrial-cyberpunk styled real-time music quiz application powered by the Spotify Web API. Challenge your musical instincts solo or battle against friends in real-time lobbies!

---

## ⚡ Features

- **Spotify Integration (PKCE OAuth)**: Securely authenticate with Spotify without exposing secret keys.
- **Dynamic Track Previews**: Automatically extracts 30-second audio previews from your playlists with an automatic high-fidelity fallback preview resolver.
- **Fast-Paced Quiz Mechanics**:
  - 10-second countdown timer with dynamic SVG progress rings.
  - Speed-based scoring bonus: The quicker you answer correctly, the more points you forge (up to 1,000 points per round).
  - Spinning vinyl visualizer tied to audio playback.
- **Game Modes**:
  - **Solo Forge**: Pick any playlist and choose 5, 10, 15, or 20 rounds to test your knowledge.
  - **Multiplayer Arena**: Host a room with a unique 6-digit room code or share a direct invite link with friends.
- **Interactive Lobby & Podium**:
  - Live player list with profile avatars.
  - Final 3-tier podium showcase with victory confetti.
  - Win streak tracking for every player across sessions.
- **⚡ Instant Quick Demo Mode**: Built-in curated playlists (*Global Megahits*, *Rock Legends*, *Synthwave 80s*) so you can jump straight into the action without waiting on Spotify API developer credentials.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/OP-Playz214989/spotify_quiz.git

# Enter the project directory
cd spotify_quiz

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The application will be live at:
👉 **http://127.0.0.1:5173/**

---

## 🔑 Spotify Developer Setup (Optional for Personal Playlists)

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Click **Create App**.
3. Under **Redirect URIs**, add:
   ```
   http://127.0.0.1:5173/
   ```
4. Under **Which API/SDKs are you planning to use?**, check **Web API**.
5. Save your app and copy your **Client ID**.
6. Under the **User Management** tab in the dashboard, add your Spotify account's email address (required while the app is in Development Mode).
7. On SOUNDFORGE, click **⚙️ Spotify Setup** to paste your Client ID, then click **CONNECT SPOTIFY**!

---

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, Canvas 2D particle engine
- **Styling**: Vanilla CSS (Industrial Cyberpunk / Glassmorphism theme, Google Fonts: *Orbitron*, *Rajdhani*, *Share Tech Mono*)
- **Build Tool**: Vite
- **APIs**: Spotify Web API (PKCE OAuth Flow), iTunes Search API preview fallback

---

## 📜 License
MIT
