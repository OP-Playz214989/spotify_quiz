// ============================================
// Particle Background & Visual Effects
// ============================================

/**
 * Initialize the particle canvas background
 */
export function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId = null;
  let mouseX = 0;
  let mouseY = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 1.5 + 0.3;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.3 + 0.1;
      this.isEmber = Math.random() < 0.1;
      if (this.isEmber) {
        this.opacity = Math.random() * 0.6 + 0.3;
        this.size = Math.random() * 2 + 0.5;
      }
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      // Subtle mouse attraction
      const dx = mouseX - this.x;
      const dy = mouseY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200) {
        this.x += dx * 0.0005;
        this.y += dy * 0.0005;
      }

      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;

      // Ember flicker
      if (this.isEmber) {
        this.opacity = 0.3 + Math.sin(Date.now() * 0.005 + this.x) * 0.3;
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);

      if (this.isEmber) {
        ctx.fillStyle = `rgba(255, 107, 43, ${this.opacity})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255, 107, 43, 0.4)';
      } else {
        ctx.fillStyle = `rgba(240, 236, 228, ${this.opacity})`;
        ctx.shadowBlur = 0;
      }

      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Create particles
  const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
  for (let i = 0; i < count; i++) {
    particles.push(new Particle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
          const opacity = (1 - dist / 120) * 0.06;
          ctx.strokeStyle = `rgba(255, 107, 43, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    drawConnections();
    animId = requestAnimationFrame(animate);
  }

  animate();

  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Screen transition helper
 */
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });

  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
  }
}

/**
 * Confetti burst effect for winners
 */
export function confettiBurst() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = '999';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ff6b2b', '#ffd700', '#ff8f4f', '#e05520', '#f39c12', '#2ecc71', '#c0c0c0'];
  const confetti = [];

  for (let i = 0; i < 150; i++) {
    confetti.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 15,
      vy: -Math.random() * 20 - 5,
      size: Math.random() * 8 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.3 + Math.random() * 0.2,
      opacity: 1
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confetti.forEach(c => {
      c.x += c.vx;
      c.y += c.vy;
      c.vy += c.gravity;
      c.rotation += c.rotationSpeed;
      c.vx *= 0.99;
      c.opacity -= 0.005;

      if (c.opacity <= 0) return;

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation * Math.PI / 180);
      ctx.globalAlpha = c.opacity;
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
      ctx.restore();
    });

    frame++;
    if (frame < 200) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  animate();
}

/**
 * Default avatar SVG data URI (properly URL-encoded)
 */
export function getDefaultAvatar(name = 'U') {
  const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#ff6b2b"/><text x="50" y="55" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Orbitron,sans-serif" font-size="44" font-weight="700">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
