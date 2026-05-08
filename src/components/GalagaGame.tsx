'use client';

import { useRef, useEffect, useCallback } from 'react';
import { t } from '../lib/translations';
import type { Language } from '../lib/store';

// ═══════════════════════════════════════════════════════════════
//  GALAGA — Pip-Boy 3000 Mini-Game
//  Full playable Galaga-style space shooter with CRT theme
// ═══════════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────────

type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER';

interface Vec2 {
  x: number;
  y: number;
}

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

interface Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
  alive: boolean;
  // Diving state
  diving: boolean;
  divePhase: number;
  diveStartX: number;
  diveStartY: number;
  diveTime: number;
}

interface Bullet {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  dy: number; // negative = upward (player), positive = downward (enemy)
  isPlayer: boolean;
}

interface Explosion {
  x: number;
  y: number;
  frame: number;
  maxFrames: number;
  size: number;
}

interface Star {
  x: number;
  y: number;
  speed: number;
  brightness: number;
}

interface GameData {
  state: GameState;
  player: Player;
  enemies: Enemy[];
  playerBullets: Bullet[];
  enemyBullets: Bullet[];
  explosions: Explosion[];
  stars: Star[];
  score: number;
  highScore: number;
  lives: number;
  level: number;
  // Enemy formation movement
  formDir: number; // 1 = right, -1 = left
  formSpeed: number;
  formDropAmount: number;
  // Diving
  diveChance: number; // per frame per alive enemy
  // Invincibility after death
  invincible: number; // frames remaining
  // Fire control
  canFire: boolean;
  // New high score flag
  newHighScore: boolean;
  // Touch input
  touchLeft: boolean;
  touchRight: boolean;
  touchFire: boolean;
  // Key input
  keyLeft: boolean;
  keyRight: boolean;
  keyFire: boolean;
  // Canvas dimensions (game coords)
  gw: number;
  gh: number;
}

// ── Constants ──────────────────────────────────────────────────

const GAME_W = 240;
const GAME_H = 320;
const ENEMY_ROWS = 5;
const ENEMY_COLS = 8;
const ENEMY_W = 18;
const ENEMY_H = 14;
const PLAYER_W = 22;
const PLAYER_H = 16;
const BULLET_W = 3;
const BULLET_H = 8;
const PLAYER_SPEED = 2.5;
const PLAYER_BULLET_SPEED = 4;
const ENEMY_BULLET_SPEED = 2.5;
const FORM_SPEED_BASE = 0.3;
const FORM_STEP_DOWN = 8;
const MAX_PLAYER_BULLETS = 2;
const INITIAL_LIVES = 3;
const STAR_COUNT = 60;

const ENEMY_COLORS = ['#33ff33', '#00ff00', '#00cc00', '#009900', '#006600'];
const ENEMY_POINTS = [30, 20, 10, 10, 10]; // top row worth most

// ── Audio helpers ──────────────────────────────────────────────

function createAudioCtx(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext)();
  } catch {
    return null;
  }
}

function playShoot(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch { /* ignore */ }
}

function playExplosion(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  } catch { /* ignore */ }
}

function playGameOverSound(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* ignore */ }
}

// ── Game initialization helpers ────────────────────────────────

function createStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * GAME_W,
      y: Math.random() * GAME_H,
      speed: 0.2 + Math.random() * 0.5,
      brightness: 0.2 + Math.random() * 0.5,
    });
  }
  return stars;
}

function createEnemies(level: number): Enemy[] {
  const enemies: Enemy[] = [];
  const startX = (GAME_W - ENEMY_COLS * (ENEMY_W + 6)) / 2 + 3;
  const startY = 36;
  for (let row = 0; row < ENEMY_ROWS; row++) {
    for (let col = 0; col < ENEMY_COLS; col++) {
      enemies.push({
        x: startX + col * (ENEMY_W + 6),
        y: startY + row * (ENEMY_H + 4),
        width: ENEMY_W,
        height: ENEMY_H,
        row,
        col,
        alive: true,
        diving: false,
        divePhase: 0,
        diveStartX: 0,
        diveStartY: 0,
        diveTime: 0,
      });
    }
  }
  return enemies;
}

function initGame(highScore: number): GameData {
  return {
    state: 'MENU',
    player: {
      x: GAME_W / 2,
      y: GAME_H - 30,
      width: PLAYER_W,
      height: PLAYER_H,
      speed: PLAYER_SPEED,
    },
    enemies: createEnemies(1),
    playerBullets: [],
    enemyBullets: [],
    explosions: [],
    stars: createStars(),
    score: 0,
    highScore,
    lives: INITIAL_LIVES,
    level: 1,
    formDir: 1,
    formSpeed: FORM_SPEED_BASE,
    formDropAmount: FORM_STEP_DOWN,
    diveChance: 0.00008,
    invincible: 0,
    canFire: true,
    newHighScore: false,
    touchLeft: false,
    touchRight: false,
    touchFire: false,
    keyLeft: false,
    keyRight: false,
    keyFire: false,
    gw: GAME_W,
    gh: GAME_H,
  };
}

function resetForNewGame(g: GameData): GameData {
  g.state = 'PLAYING';
  g.player.x = GAME_W / 2;
  g.player.y = GAME_H - 30;
  g.enemies = createEnemies(1);
  g.playerBullets = [];
  g.enemyBullets = [];
  g.explosions = [];
  g.score = 0;
  g.lives = INITIAL_LIVES;
  g.level = 1;
  g.formDir = 1;
  g.formSpeed = FORM_SPEED_BASE;
  g.formDropAmount = FORM_STEP_DOWN;
  g.diveChance = 0.00008;
  g.invincible = 0;
  g.canFire = true;
  g.newHighScore = false;
  return g;
}

function resetPlayerPosition(g: GameData): GameData {
  g.player.x = GAME_W / 2;
  g.player.y = GAME_H - 30;
  g.playerBullets = [];
  g.enemyBullets = [];
  g.invincible = 120; // 2 seconds at 60fps
  g.canFire = true;
  return g;
}

function startNextWave(g: GameData): GameData {
  g.level++;
  g.enemies = createEnemies(g.level);
  g.enemyBullets = [];
  g.playerBullets = [];
  g.formDir = 1;
  g.formSpeed = FORM_SPEED_BASE + (g.level - 1) * 0.05;
  g.formDropAmount = FORM_STEP_DOWN;
  g.diveChance = Math.min(0.0012, 0.00008 + (g.level - 1) * 0.0001);
  return g;
}

// ── Collision detection ────────────────────────────────────────

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── Update / tick ─────────────────────────────────────────────

function updateGame(g: GameData, ctx: AudioContext | null): GameData {
  if (g.state !== 'PLAYING') return g;

  const movingLeft = g.keyLeft || g.touchLeft;
  const movingRight = g.keyRight || g.touchRight;
  const firing = g.keyFire || g.touchFire;

  // Move player
  if (movingLeft) {
    g.player.x = Math.max(g.player.width / 2, g.player.x - g.player.speed);
  }
  if (movingRight) {
    g.player.x = Math.min(GAME_W - g.player.width / 2, g.player.x + g.player.speed);
  }

  // Player fire
  if (firing && g.canFire && g.playerBullets.length < MAX_PLAYER_BULLETS) {
    g.playerBullets.push({
      x: g.player.x - BULLET_W / 2,
      y: g.player.y - g.player.height / 2,
      width: BULLET_W,
      height: BULLET_H,
      speed: PLAYER_BULLET_SPEED,
      dy: -PLAYER_BULLET_SPEED,
      isPlayer: true,
    });
    g.canFire = false;
    playShoot(ctx);
  }
  if (!firing) {
    g.canFire = true;
  }

  // Update invincibility
  if (g.invincible > 0) g.invincible--;

  // Update stars
  for (const star of g.stars) {
    star.y += star.speed;
    if (star.y > GAME_H) {
      star.y = 0;
      star.x = Math.random() * GAME_W;
    }
  }

  // ── Move enemies in formation ──────────────────────────
  let needDrop = false;
  for (const enemy of g.enemies) {
    if (!enemy.alive || enemy.diving) continue;
    enemy.x += g.formSpeed * g.formDir;
    if (enemy.x <= 4 || enemy.x + enemy.width >= GAME_W - 4) {
      needDrop = true;
    }
  }
  if (needDrop) {
    g.formDir *= -1;
    for (const enemy of g.enemies) {
      if (!enemy.alive || enemy.diving) continue;
      enemy.y += g.formDropAmount;
    }
  }

  // ── Enemy diving logic ─────────────────────────────────
  for (const enemy of g.enemies) {
    if (!enemy.alive) continue;

    if (!enemy.diving) {
      // Check if this enemy should start diving
      if (Math.random() < g.diveChance) {
        enemy.diving = true;
        enemy.divePhase = 0;
        enemy.diveStartX = enemy.x;
        enemy.diveStartY = enemy.y;
        enemy.diveTime = 0;
      }
    }

    if (enemy.diving) {
      enemy.diveTime += 1;
      const t2 = enemy.diveTime / 120; // 2 seconds dive
      const sineOffset = Math.sin(t2 * Math.PI * 3) * 40;
      const diveY = enemy.diveStartY + t2 * (GAME_H + 40);
      const diveX = enemy.diveStartX + sineOffset;

      enemy.x = diveX;
      enemy.y = diveY;

      // Enemy fires during dive
      if (enemy.diveTime === 40 || enemy.diveTime === 80) {
        g.enemyBullets.push({
          x: enemy.x + enemy.width / 2 - BULLET_W / 2,
          y: enemy.y + enemy.height,
          width: BULLET_W,
          height: BULLET_H,
          speed: ENEMY_BULLET_SPEED,
          dy: ENEMY_BULLET_SPEED,
          isPlayer: false,
        });
      }

      // Diving enemy goes off screen — return to formation
      if (enemy.y > GAME_H + 30) {
        enemy.diving = false;
        // Return to formation position
        const startX = (GAME_W - ENEMY_COLS * (ENEMY_W + 6)) / 2 + 3;
        enemy.x = startX + enemy.col * (ENEMY_W + 6);
        enemy.y = 36 + enemy.row * (ENEMY_H + 4);
      }
    }

    // Non-diving enemies also fire randomly (reduced on low levels)
    if (!enemy.diving && Math.random() < 0.0001 * (1 + g.level * 0.4)) {
      g.enemyBullets.push({
        x: enemy.x + enemy.width / 2 - BULLET_W / 2,
        y: enemy.y + enemy.height,
        width: BULLET_W,
        height: BULLET_H,
        speed: ENEMY_BULLET_SPEED,
        dy: ENEMY_BULLET_SPEED,
        isPlayer: false,
      });
    }
  }

  // ── Move player bullets ───────────────────────────────
  g.playerBullets = g.playerBullets.filter((b) => {
    b.y += b.dy;
    return b.y + b.height > 0;
  });

  // ── Move enemy bullets ────────────────────────────────
  g.enemyBullets = g.enemyBullets.filter((b) => {
    b.y += b.dy;
    return b.y < GAME_H;
  });

  // ── Collision: player bullets vs enemies ──────────────
  for (const bullet of g.playerBullets) {
    for (const enemy of g.enemies) {
      if (!enemy.alive) continue;
      if (
        rectsOverlap(
          bullet.x, bullet.y, bullet.width, bullet.height,
          enemy.x, enemy.y, enemy.width, enemy.height
        )
      ) {
        enemy.alive = false;
        bullet.y = -100; // mark for removal
        g.score += ENEMY_POINTS[enemy.row] || 10;
        g.explosions.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          frame: 0,
          maxFrames: 12,
          size: enemy.width + 4,
        });
        playExplosion(ctx);
        break;
      }
    }
  }
  g.playerBullets = g.playerBullets.filter((b) => b.y > -50);

  // ── Collision: enemy bullets vs player ────────────────
  if (g.invincible <= 0) {
    for (const bullet of g.enemyBullets) {
      if (
        rectsOverlap(
          bullet.x, bullet.y, bullet.width, bullet.height,
          g.player.x - g.player.width / 2,
          g.player.y - g.player.height / 2,
          g.player.width,
          g.player.height
        )
      ) {
        bullet.y = GAME_H + 100; // mark for removal
        g.lives--;
        g.explosions.push({
          x: g.player.x,
          y: g.player.y,
          frame: 0,
          maxFrames: 20,
          size: g.player.width + 8,
        });
        playExplosion(ctx);

        if (g.lives <= 0) {
          g.state = 'GAME_OVER';
          if (g.score > g.highScore) {
            g.highScore = g.score;
            g.newHighScore = true;
            try {
              localStorage.setItem('pipboy-galaga-highscore', String(g.score));
            } catch { /* ignore */ }
          }
          playGameOverSound(ctx);
        } else {
          resetPlayerPosition(g);
        }
        break;
      }
    }
  }
  g.enemyBullets = g.enemyBullets.filter((b) => b.y < GAME_H);

  // ── Collision: diving enemies vs player ───────────────
  if (g.invincible <= 0) {
    for (const enemy of g.enemies) {
      if (!enemy.alive || !enemy.diving) continue;
      if (
        rectsOverlap(
          enemy.x, enemy.y, enemy.width, enemy.height,
          g.player.x - g.player.width / 2,
          g.player.y - g.player.height / 2,
          g.player.width,
          g.player.height
        )
      ) {
        enemy.alive = false;
        g.explosions.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          frame: 0,
          maxFrames: 12,
          size: enemy.width + 4,
        });
        g.lives--;
        g.explosions.push({
          x: g.player.x,
          y: g.player.y,
          frame: 0,
          maxFrames: 20,
          size: g.player.width + 8,
        });
        playExplosion(ctx);

        if (g.lives <= 0) {
          g.state = 'GAME_OVER';
          if (g.score > g.highScore) {
            g.highScore = g.score;
            g.newHighScore = true;
            try {
              localStorage.setItem('pipboy-galaga-highscore', String(g.score));
            } catch { /* ignore */ }
          }
          playGameOverSound(ctx);
        } else {
          resetPlayerPosition(g);
        }
        break;
      }
    }
  }

  // ── Update explosions ─────────────────────────────────
  g.explosions = g.explosions.filter((e) => {
    e.frame++;
    return e.frame < e.maxFrames;
  });

  // ── Check if all enemies dead → next wave ─────────────
  const aliveEnemies = g.enemies.filter((e) => e.alive);
  if (aliveEnemies.length === 0) {
    startNextWave(g);
  }

  return g;
}

// ── Drawing ────────────────────────────────────────────────────

function drawGame(ctx2d: CanvasRenderingContext2D, g: GameData, lang: Language) {
  const w = GAME_W;
  const h = GAME_H;

  // Clear
  ctx2d.fillStyle = '#0a0f0a';
  ctx2d.fillRect(0, 0, w, h);

  // Draw stars
  for (const star of g.stars) {
    const alpha = star.brightness;
    ctx2d.fillStyle = `rgba(0, 255, 0, ${alpha})`;
    ctx2d.fillRect(Math.round(star.x), Math.round(star.y), 1, 1);
  }

  if (g.state === 'MENU') {
    drawMenu(ctx2d, g, lang);
    return;
  }

  // ── Draw enemies ──────────────────────────────────────
  for (const enemy of g.enemies) {
    if (!enemy.alive) continue;
    const color = ENEMY_COLORS[enemy.row] || '#00cc00';
    drawEnemy(ctx2d, enemy.x, enemy.y, enemy.width, enemy.height, enemy.row, color);
  }

  // ── Draw player bullets ───────────────────────────────
  ctx2d.shadowColor = '#00ff00';
  ctx2d.shadowBlur = 6;
  for (const bullet of g.playerBullets) {
    ctx2d.fillStyle = '#00ff00';
    ctx2d.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
  ctx2d.shadowBlur = 0;

  // ── Draw enemy bullets ────────────────────────────────
  ctx2d.shadowColor = '#ffb000';
  ctx2d.shadowBlur = 4;
  for (const bullet of g.enemyBullets) {
    ctx2d.fillStyle = '#ffb000';
    ctx2d.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
  ctx2d.shadowBlur = 0;

  // ── Draw explosions ───────────────────────────────────
  for (const exp of g.explosions) {
    const progress = exp.frame / exp.maxFrames;
    const alpha = 1 - progress;
    const size = exp.size * (0.5 + progress * 0.5);
    if (progress < 0.3) {
      ctx2d.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    } else {
      ctx2d.fillStyle = `rgba(0, 255, 0, ${alpha * 0.8})`;
    }
    ctx2d.beginPath();
    ctx2d.arc(exp.x, exp.y, size / 2, 0, Math.PI * 2);
    ctx2d.fill();
  }

  // ── Draw player ───────────────────────────────────────
  if (g.state === 'PLAYING' || g.state === 'GAME_OVER') {
    // Blink when invincible
    if (g.invincible <= 0 || Math.floor(g.invincible / 4) % 2 === 0) {
      drawPlayer(ctx2d, g.player.x, g.player.y, g.player.width, g.player.height);
    }
  }

  // ── Draw HUD ──────────────────────────────────────────
  drawHUD(ctx2d, g, lang);

  // ── Draw GAME OVER overlay ────────────────────────────
  if (g.state === 'GAME_OVER') {
    drawGameOver(ctx2d, g, lang);
  }
}

function drawPlayer(
  ctx2d: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pw: number,
  ph: number
) {
  ctx2d.save();
  ctx2d.shadowColor = '#00ff00';
  ctx2d.shadowBlur = 8;
  ctx2d.fillStyle = '#00ff00';
  ctx2d.strokeStyle = '#00ff00';
  ctx2d.lineWidth = 1.5;

  // Main body — triangle pointing up
  ctx2d.beginPath();
  ctx2d.moveTo(cx, cy - ph / 2);         // top point
  ctx2d.lineTo(cx + pw / 2, cy + ph / 2); // bottom right
  ctx2d.lineTo(cx - pw / 2, cy + ph / 2); // bottom left
  ctx2d.closePath();
  ctx2d.fill();

  // Wing details
  ctx2d.beginPath();
  ctx2d.moveTo(cx, cy + ph / 4);
  ctx2d.lineTo(cx + pw / 2 + 3, cy + ph / 2 + 2);
  ctx2d.lineTo(cx + pw / 4, cy + ph / 4);
  ctx2d.closePath();
  ctx2d.fill();

  ctx2d.beginPath();
  ctx2d.moveTo(cx, cy + ph / 4);
  ctx2d.lineTo(cx - pw / 2 - 3, cy + ph / 2 + 2);
  ctx2d.lineTo(cx - pw / 4, cy + ph / 4);
  ctx2d.closePath();
  ctx2d.fill();

  ctx2d.shadowBlur = 0;
  ctx2d.restore();
}

function drawEnemy(
  ctx2d: CanvasRenderingContext2D,
  x: number,
  y: number,
  ew: number,
  eh: number,
  row: number,
  color: string
) {
  ctx2d.save();
  ctx2d.fillStyle = color;
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = 1;
  const cx = x + ew / 2;
  const cy = y + eh / 2;

  switch (row) {
    case 0:
      // Top row — diamond shape (boss type)
      ctx2d.shadowColor = color;
      ctx2d.shadowBlur = 6;
      ctx2d.beginPath();
      ctx2d.moveTo(cx, y);
      ctx2d.lineTo(x + ew, cy);
      ctx2d.lineTo(cx, y + eh);
      ctx2d.lineTo(x, cy);
      ctx2d.closePath();
      ctx2d.fill();
      // Inner detail
      ctx2d.fillStyle = '#0a0f0a';
      ctx2d.fillRect(cx - 2, cy - 2, 4, 4);
      break;
    case 1:
      // Circle
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, ew / 2, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.fillStyle = '#0a0f0a';
      ctx2d.fillRect(cx - 2, cy - 2, 4, 4);
      break;
    case 2:
      // Rounded square
      ctx2d.fillRect(x + 1, y + 1, ew - 2, eh - 2);
      ctx2d.fillStyle = '#0a0f0a';
      ctx2d.fillRect(cx - 2, cy - 2, 4, 4);
      break;
    case 3:
      // Inverted triangle
      ctx2d.beginPath();
      ctx2d.moveTo(x, y);
      ctx2d.lineTo(x + ew, y);
      ctx2d.lineTo(cx, y + eh);
      ctx2d.closePath();
      ctx2d.fill();
      break;
    case 4:
    default:
      // Small square
      ctx2d.fillRect(x + 2, y + 2, ew - 4, eh - 4);
      break;
  }
  ctx2d.shadowBlur = 0;
  ctx2d.restore();
}

function drawHUD(ctx2d: CanvasRenderingContext2D, g: GameData, lang: Language) {
  ctx2d.save();
  ctx2d.fillStyle = '#00ff00';
  ctx2d.font = '9px "Courier New", monospace';
  ctx2d.textBaseline = 'top';

  // Score
  ctx2d.textAlign = 'left';
  ctx2d.fillText(`${t('games.score', lang)} ${g.score}`, 4, 4);

  // High Score
  ctx2d.textAlign = 'right';
  ctx2d.fillText(`${t('games.highScore', lang)} ${g.highScore}`, GAME_W - 4, 4);

  // Level
  ctx2d.textAlign = 'left';
  ctx2d.fillText(`${t('games.level', lang)} ${g.level}`, 4, 16);

  // Lives — small triangles
  ctx2d.textAlign = 'right';
  ctx2d.fillText(`${t('games.lives', lang)}`, GAME_W - 4, 16);
  const livesTextWidth = ctx2d.measureText(`${t('games.lives', lang)} `).width;
  for (let i = 0; i < g.lives; i++) {
    const lx = GAME_W - 4 - livesTextWidth - i * 12;
    const ly = 22;
    ctx2d.beginPath();
    ctx2d.moveTo(lx, ly);
    ctx2d.lineTo(lx - 4, ly + 7);
    ctx2d.lineTo(lx + 4, ly + 7);
    ctx2d.closePath();
    ctx2d.fill();
  }

  // Wave indicator
  ctx2d.textAlign = 'center';
  ctx2d.fillStyle = 'rgba(0, 255, 0, 0.5)';
  ctx2d.font = '7px "Courier New", monospace';
  ctx2d.fillText(`${t('games.wave', lang)} ${g.level}`, GAME_W / 2, GAME_H - 6);

  ctx2d.restore();
}

function drawMenu(ctx2d: CanvasRenderingContext2D, g: GameData, lang: Language) {
  ctx2d.save();

  // Title
  ctx2d.fillStyle = '#00ff00';
  ctx2d.font = 'bold 20px "Courier New", monospace';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.shadowColor = '#00ff00';
  ctx2d.shadowBlur = 12;
  ctx2d.fillText(t('games.galaga', lang), GAME_W / 2, 60);
  ctx2d.shadowBlur = 0;

  // Decorative line
  ctx2d.strokeStyle = '#00ff00';
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  ctx2d.moveTo(40, 78);
  ctx2d.lineTo(GAME_W - 40, 78);
  ctx2d.stroke();

  // Description
  ctx2d.font = '10px "Courier New", monospace';
  ctx2d.fillStyle = '#00cc00';
  ctx2d.fillText(t('games.galaga.desc', lang), GAME_W / 2, 100);

  // Decorative enemies
  const demoEnemies = [
    { row: 0, x: GAME_W / 2 - 30, y: 140 },
    { row: 1, x: GAME_W / 2, y: 140 },
    { row: 2, x: GAME_W / 2 + 30, y: 140 },
    { row: 3, x: GAME_W / 2 - 15, y: 162 },
    { row: 4, x: GAME_W / 2 + 15, y: 162 },
  ];
  for (const de of demoEnemies) {
    const color = ENEMY_COLORS[de.row];
    drawEnemy(ctx2d, de.x - ENEMY_W / 2, de.y, ENEMY_W, ENEMY_H, de.row, color);
  }

  // Point values
  ctx2d.font = '8px "Courier New", monospace';
  ctx2d.fillStyle = '#009900';
  ctx2d.fillText('= 30', GAME_W / 2 - 30, 158);
  ctx2d.fillText('= 20', GAME_W / 2, 158);
  ctx2d.fillText('= 10', GAME_W / 2 + 30, 158);

  // Start button area
  ctx2d.fillStyle = '#00ff00';
  ctx2d.font = 'bold 14px "Courier New", monospace';
  ctx2d.shadowColor = '#00ff00';
  ctx2d.shadowBlur = 8;
  ctx2d.fillText(t('games.start', lang), GAME_W / 2, 210);
  ctx2d.shadowBlur = 0;

  // Controls
  ctx2d.font = '8px "Courier New", monospace';
  ctx2d.fillStyle = '#00aa00';
  ctx2d.fillText(t('games.controls', lang), GAME_W / 2, 240);

  // Keyboard controls
  ctx2d.fillStyle = '#008800';
  ctx2d.fillText('◄ ► SPACE', GAME_W / 2, 254);

  // Touch controls hint
  ctx2d.fillStyle = '#006600';
  ctx2d.font = '7px "Courier New", monospace';
  ctx2d.fillText(t('games.controlsMobile', lang), GAME_W / 2, 274);

  // High score
  if (g.highScore > 0) {
    ctx2d.fillStyle = '#ffb000';
    ctx2d.font = '10px "Courier New", monospace';
    ctx2d.fillText(`${t('games.highScore', lang)}: ${g.highScore}`, GAME_W / 2, 300);
  }

  ctx2d.restore();
}

function drawGameOver(ctx2d: CanvasRenderingContext2D, g: GameData, lang: Language) {
  ctx2d.save();

  // Semi-transparent overlay
  ctx2d.fillStyle = 'rgba(10, 15, 10, 0.75)';
  ctx2d.fillRect(0, 0, GAME_W, GAME_H);

  // Game Over text
  ctx2d.fillStyle = '#ff2020';
  ctx2d.font = 'bold 18px "Courier New", monospace';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.shadowColor = '#ff2020';
  ctx2d.shadowBlur = 10;
  ctx2d.fillText(t('games.gameOver', lang), GAME_W / 2, GAME_H / 2 - 30);
  ctx2d.shadowBlur = 0;

  // Score
  ctx2d.fillStyle = '#00ff00';
  ctx2d.font = '12px "Courier New", monospace';
  ctx2d.fillText(`${t('games.score', lang)}: ${g.score}`, GAME_W / 2, GAME_H / 2 + 5);

  // New high score
  if (g.newHighScore) {
    ctx2d.fillStyle = '#ffb000';
    ctx2d.font = 'bold 11px "Courier New", monospace';
    ctx2d.shadowColor = '#ffb000';
    ctx2d.shadowBlur = 8;
    ctx2d.fillText(t('games.newHighScore', lang), GAME_W / 2, GAME_H / 2 + 25);
    ctx2d.shadowBlur = 0;
  }

  // Press space
  ctx2d.fillStyle = '#00aa00';
  ctx2d.font = '10px "Courier New", monospace';
  ctx2d.fillText(t('games.pressSpace', lang), GAME_W / 2, GAME_H / 2 + 50);

  ctx2d.restore();
}

// ═══════════════════════════════════════════════════════════════
//  REACT COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function GalagaGame({ language }: { language: Language }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameData | null>(null);
  const animRef = useRef<number>(0);
  const audioRef = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const langRef = useRef(language);
  const displayWRef = useRef(240);
  const displayHRef = useRef(320);

  // Keep language ref updated
  useEffect(() => {
    langRef.current = language;
  }, [language]);

  // Initialize game
  const getOrCreateGame = useCallback((): GameData => {
    if (!gameRef.current) {
      let highScore = 0;
      try {
        highScore = parseInt(localStorage.getItem('pipboy-galaga-highscore') || '0', 10);
      } catch { /* ignore */ }
      gameRef.current = initGame(highScore);
    }
    return gameRef.current;
  }, []);

  // Resize canvas to fit container — adaptive to any screen size
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = containerRef.current?.parentElement;
    const containerW = parent?.clientWidth || window.innerWidth;
    const containerH = parent?.clientHeight || window.innerHeight;
    const aspect = GAME_W / GAME_H; // 3:4 portrait
    const isMobile = containerW < 768;

    // On mobile leave room for touch controls; on PC use almost all space
    const availH = containerH - (isMobile ? 80 : 16);

    let displayW: number;
    let displayH: number;

    if (availH > 0 && containerW > 0) {
      if (containerW / availH < aspect) {
        // Width-limited: fill width, calc height
        displayW = containerW - (isMobile ? 16 : 32);
        displayH = displayW / aspect;
      } else {
        // Height-limited: fill height, calc width
        displayH = availH;
        displayW = displayH * aspect;
      }
    } else {
      displayW = window.innerWidth - 24;
      displayH = displayW / aspect;
    }

    // Minimum size
    displayW = Math.max(180, Math.floor(displayW));
    displayH = Math.max(240, Math.floor(displayH));

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    canvas.width = Math.floor(displayW * dpr);
    canvas.height = Math.floor(displayH * dpr);

    // Store display dimensions for the game loop
    displayWRef.current = displayW;
    displayHRef.current = displayH;
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvas();

    // Initialize audio on first interaction
    const ensureAudio = () => {
      if (!audioRef.current) {
        audioRef.current = createAudioCtx();
      }
    };

    const game = getOrCreateGame();

    const loop = () => {
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;

      const dpr = window.devicePixelRatio || 1;
      const dw = displayWRef.current;
      const dh = displayHRef.current;

      // Clear entire canvas in raw pixels
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);

      // Scale game coords (240x320) to display size, with DPR
      const scaleX = dw / GAME_W;
      const scaleY = dh / GAME_H;
      ctx2d.setTransform(dpr * scaleX, 0, 0, dpr * scaleY, 0, 0);

      // Clip to game area so diving enemies don't leak
      ctx2d.save();
      ctx2d.beginPath();
      ctx2d.rect(0, 0, GAME_W, GAME_H);
      ctx2d.clip();

      updateGame(game, audioRef.current);
      drawGame(ctx2d, game, langRef.current);

      ctx2d.restore();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    // ── Keyboard handlers ────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (game.state !== 'PLAYING' && game.state !== 'MENU') {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          if (game.state === 'GAME_OVER') {
            resetForNewGame(game);
          }
        }
        return;
      }

      if (e.code === 'ArrowLeft' || e.key === 'a') {
        game.keyLeft = true;
        e.preventDefault();
      }
      if (e.code === 'ArrowRight' || e.key === 'd') {
        game.keyRight = true;
        e.preventDefault();
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        ensureAudio();
        if (game.state === 'MENU') {
          resetForNewGame(game);
        } else {
          game.keyFire = true;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.key === 'a') game.keyLeft = false;
      if (e.code === 'ArrowRight' || e.key === 'd') game.keyRight = false;
      if (e.code === 'Space' || e.key === ' ') game.keyFire = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Resize handler ───────────────────────────────────
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
    };
  }, [getOrCreateGame, resizeCanvas]);

  // Touch handlers
  const handleTouchStart = useCallback((action: 'left' | 'right' | 'fire') => {
    const game = getOrCreateGame();
    if (!audioRef.current) {
      audioRef.current = createAudioCtx();
    }
    if (game.state === 'MENU') {
      resetForNewGame(game);
      return;
    }
    if (game.state === 'GAME_OVER') {
      resetForNewGame(game);
      return;
    }
    if (action === 'left') game.touchLeft = true;
    if (action === 'right') game.touchRight = true;
    if (action === 'fire') game.touchFire = true;
  }, [getOrCreateGame]);

  const handleTouchEnd = useCallback((action: 'left' | 'right' | 'fire') => {
    const game = getOrCreateGame();
    if (action === 'left') game.touchLeft = false;
    if (action === 'right') game.touchRight = false;
    if (action === 'fire') game.touchFire = false;
  }, [getOrCreateGame]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <canvas
        ref={canvasRef}
        className="galaga-canvas"
      />
      <div className="galaga-touch-controls">
        <button
          className="galaga-touch-btn"
          onPointerDown={() => handleTouchStart('left')}
          onPointerUp={() => handleTouchEnd('left')}
          onPointerLeave={() => handleTouchEnd('left')}
          onContextMenu={(e) => e.preventDefault()}
          style={{ flex: 1, maxWidth: '100px' }}
        >
          ◄
        </button>
        <button
          className="galaga-touch-btn"
          onPointerDown={() => handleTouchStart('fire')}
          onPointerUp={() => handleTouchEnd('fire')}
          onPointerLeave={() => handleTouchEnd('fire')}
          onContextMenu={(e) => e.preventDefault()}
          style={{ flex: 1, maxWidth: '100px' }}
        >
          FIRE
        </button>
        <button
          className="galaga-touch-btn"
          onPointerDown={() => handleTouchStart('right')}
          onPointerUp={() => handleTouchEnd('right')}
          onPointerLeave={() => handleTouchEnd('right')}
          onContextMenu={(e) => e.preventDefault()}
          style={{ flex: 1, maxWidth: '100px' }}
        >
          ►
        </button>
      </div>
    </div>
  );
}
