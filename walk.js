/* ============================================================
   MOCHI'S WALK - top-down pixel mini game (Day 2)
   DogWalk.start(canvas, { onDone(result), sfx, tone }) -> result = { win, elapsed, score }
   DogWalk.stop()
   Controls: WASD / arrows move the couple, Space jumps the whole party.
   Tennis ball +1, fire hydrant +3 (2s pee pause), open sewer -1.
   ============================================================ */
const DogWalk = (() => {
  const W = 1280, H = 720, SC = 4;                    // canvas + pixel scale
  const ROAD_L = 340, ROAD_R = 940, WALK = 80;        // road x-range, sidewalk width
  const NEED = 25, LIMIT = 180;                       // points to clear, seconds on the clock
  const SCROLL = 200;                                 // px/s the world slides down
  const MOVE = 270;                                   // px/s player speed
  const JUMP_T = 0.55, JUMP_H = 30;

  const PAL = {
    k: '#141418', w: '#f5f5f7', r: '#e8232a', R: '#a3141b', s: '#f1c9a5', S: '#d9a67d',
    b: '#f0d264', B: '#c4a232', W: '#ececf0', d: '#2a2a33', p: '#3a3f57', n: '#8b5a2b',
    N: '#6b4320', y: '#d9ec3a', Y: '#a9bd1c', h: '#d4222a', H: '#8f1218', m: '#5b3b1e',
    c: '#e01e2c', t: '#ffe9a6', o: '#6b6b74',
  };

  /* ---- sprites (12 wide) : back view, walking "up" the screen ---- */
  const GIRL_A = [
    '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '..rrrrrrrr..', '..rRrrrrRr..', '..rrrrrrrr..',
    '.rrWWWWWWrr.', '.rrWWWWWWrr.', '..rWWWWWWr..', '..sWWWWWWs..', '..sWWWWWWs..',
    '...pppppp...', '...pppppp...', '...pp..pp...', '...pp..pp...', '...kk..kk...'];
  const GIRL_B = GIRL_A.slice(0, 13).concat(['...pp..kk...', '...kk.......', '............']);
  const GUY_A = [
    '....bbbb....', '...bbbbbb...', '..bbbbbbbb..', '.kbbbbbbbbk.', '..bBbbbbBb..', '...ssssss...',
    '.sdddddddds.', '.sdddddddds.', '..dddddddd..', '..sdddddds..', '..sdddddds..',
    '...pppppp...', '...pppppp...', '...pp..pp...', '...pp..pp...', '...kk..kk...'];
  const GUY_B = GUY_A.slice(0, 13).concat(['...kk..pp...', '.......kk...', '............']);
  /* Mochi - white body, brown jack russell head, black nose, white snout, red collar */
  const DOG_A = [
    '.....kk.....', '....wwww....', '...nwwwwn...', '..nnnnnnnn..', '..nnnnnnnn..', '...nnnnnn...',
    '...cccccc...', '..wwwwwwww..', '..wwwwwwww..', '..wwwwwwww..', '..ww....ww..', '..ww....ww..',
    '.....ww.....', '......w.....'];
  const DOG_B = DOG_A.slice(0, 10).concat(['..ww....ww..', '..w......ww.', '.....ww.....', '.....w......']);
  const DOG_PEE = DOG_A.slice(0, 10).concat(['..ww......ww', '..ww......w.', '.....ww.....', '......w.....']);
  /* front-facing HUD portraits, 8x8 */
  const ICON_GIRL = ['..rrrr..', '.rrrrrr.', 'rrssssrr', 'rrskksrr', 'rrssssrr', 'rrsssrrr', '.rrrrrr.', '..r..r..'];
  const ICON_GUY  = ['..bbbb..', '.bbbbbb.', '.ssssss.', 'kkkkkkkk', '.ssssss.', '.smmmms.', '.ssssss.', '..dddd..'];
  const ICON_DOG  = ['..nnnn..', '.nnnnnn.', 'nnwkkwnn', 'nnwwwwnn', '.nwwwwn.', '..wkkw..', '..wwww..', '...cc...'];
  const BALL = ['..yyyy..', '.yyYwYy.', 'yYywyyyy', 'yywyyyYy', 'yyyyywyy', 'yYyywyYy', '.yYwYyy.', '..yyyy..'];
  const HYD = ['...hh...', '..hhhh..', '..HhhH..', '.hhhhhh.', 'HHhhhhHH', '.hhhhhh.', '..hhhh..', '..hhhh..',
               '..hHHh..', '..hhhh..', '..hhhh..', '.hhhhhh.', '.HHHHHH.'];

  let cv, cx, opts, raf = 0, last = 0, active = false;
  let G;                                              // game state

  function fresh() {
    return {
      t: 0, left: LIMIT, score: 0, scroll: 0, done: false,
      px: 640, py: 520, jump: 0, hitCd: 0, walkT: 0, moving: false,
      dx: 640, dy: 445, pee: 0, peeAt: null,
      objs: [], floats: [], spawn: { ball: .6, hyd: 5, hole: 2.2 }, hydSide: 1,
      keys: {}, hint: 5,
      touch: null, touchDev: false, jumpFlash: 0,   // touch: drag target while a finger is down
    };
  }

  /* ---------- drawing ---------- */
  function px(map, x, y, sc = SC) {
    for (let j = 0; j < map.length; j++) {
      const row = map[j];
      for (let i = 0; i < row.length; i++) {
        const c = row[i]; if (c === '.') continue;
        cx.fillStyle = PAL[c] || '#f0f';
        cx.fillRect(Math.round(x + i * sc), Math.round(y + j * sc), sc, sc);
      }
    }
  }
  function shadow(x, y, w, h) {
    cx.fillStyle = 'rgba(0,0,0,.28)';
    cx.beginPath(); cx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); cx.fill();
  }
  function drawWorld() {
    // grass
    cx.fillStyle = '#4f8a3c'; cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#457a34';
    for (let i = 0; i < 40; i++) {                    // tufts, scrolled
      const gx = (i * 173) % W, gy = ((i * 251) + G.scroll) % (H + 60) - 30;
      if (gx > ROAD_L - WALK - 20 && gx < ROAD_R + WALK + 20) continue;
      cx.fillRect(gx, gy, 6, 3); cx.fillRect(gx + 3, gy - 3, 3, 3);
    }
    // sidewalks
    cx.fillStyle = '#b9b7b0';
    cx.fillRect(ROAD_L - WALK, 0, WALK, H); cx.fillRect(ROAD_R, 0, WALK, H);
    cx.fillStyle = '#9d9b94';
    for (let y = (G.scroll % 96) - 96; y < H; y += 96) {
      cx.fillRect(ROAD_L - WALK, y, WALK, 3); cx.fillRect(ROAD_R, y, WALK, 3);
    }
    // curbs
    cx.fillStyle = '#7d7b75'; cx.fillRect(ROAD_L - 6, 0, 6, H); cx.fillRect(ROAD_R, 0, 6, H);
    // road
    cx.fillStyle = '#4a4a50'; cx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
    cx.fillStyle = '#e9d36b';                          // dashed centre line
    for (let y = (G.scroll % 120) - 120; y < H; y += 120) cx.fillRect(637, y, 6, 60);
    cx.fillStyle = '#5a5a61';                          // faint lane texture
    for (let i = 0; i < 14; i++) {
      const rx = ROAD_L + ((i * 397) % (ROAD_R - ROAD_L - 30)), ry = ((i * 311) + G.scroll * 1) % (H + 40) - 20;
      cx.fillRect(rx, ry, 18, 2);
    }
  }
  function drawObj(o) {
    if (o.k === 'hole') {
      cx.fillStyle = '#2a2a2e'; cx.beginPath(); cx.ellipse(o.x, o.y + 3, 34, 16, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#0d0d10'; cx.beginPath(); cx.ellipse(o.x, o.y, 30, 13, 0, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = '#8a8a92'; cx.lineWidth = 3;
      cx.beginPath(); cx.ellipse(o.x, o.y, 32, 15, 0, 0, Math.PI * 2); cx.stroke();
    } else if (o.k === 'ball') {
      shadow(o.x, o.y + 12, 10, 4);
      px(BALL, o.x - 12, o.y - 12 - Math.abs(Math.sin(G.t * 9 + o.x)) * 6);
    } else if (o.k === 'hyd') {
      shadow(o.x, o.y + 18, 12, 5);
      px(HYD, o.x - 12, o.y - 20);
    } else if (o.k === 'puddle') {
      cx.fillStyle = 'rgba(232,214,80,.85)';
      cx.beginPath(); cx.ellipse(o.x, o.y, o.r, o.r * .45, 0, 0, Math.PI * 2); cx.fill();
    }
  }
  function drawParty() {
    const lift = G.jump > 0 ? Math.sin(Math.PI * (G.jump / JUMP_T)) * JUMP_H : 0;
    const frame = (!G.moving && G.pee <= 0 && G.scroll === 0) ? 0 : Math.floor(G.walkT * 8) % 2;
    // shadows on the ground
    shadow(G.px - 6 * SC - 4, G.py + 6 * SC + 2, 18, 7); shadow(G.px + 6 * SC + 4, G.py + 6 * SC + 2, 18, 7);
    shadow(G.dx, G.dy + 6 * SC, 18, 7);
    // leash - hands to collar, sags when slack
    const hx = G.px, hy = G.py - 6 - lift, cxp = G.dx, cyp = G.dy + 6 - lift;
    cx.strokeStyle = '#111'; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(hx, hy);
    cx.quadraticCurveTo((hx + cxp) / 2, (hy + cyp) / 2 + 14, cxp, cyp); cx.stroke();
    // dog (pee frame while paused)
    const dmap = G.pee > 0 ? DOG_PEE : (frame ? DOG_B : DOG_A);
    px(dmap, G.dx - 6 * SC, G.dy - 8 * SC - lift);
    // couple, girl left / guy right
    px(frame ? GIRL_B : GIRL_A, G.px - 12 * SC - 4, G.py - 10 * SC - lift);
    px(frame ? GUY_B : GUY_A, G.px + 4, G.py - 10 * SC - lift);
  }
  function drawHud() {
    cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(0, 0, W, 62);
    px(ICON_GIRL, 22, 15, 4); px(ICON_GUY, 60, 15, 4); px(ICON_DOG, 98, 15, 4);
    cx.fillStyle = '#ff8a90'; cx.font = "bold 13px 'Titan One', Impact, sans-serif";
    cx.textAlign = 'left'; cx.fillText("MOCHI'S WALK", 144, 27);
    cx.fillStyle = '#b9b9c4'; cx.font = '600 12px Inter, sans-serif';
    cx.fillText(G.touchDev ? 'DRAG to move  ·  tap JUMP' : 'WASD move  ·  SPACE jump', 144, 46);
    // score
    cx.textAlign = 'center';
    cx.fillStyle = G.score >= NEED ? '#5ce08a' : '#fff';
    cx.font = "bold 30px 'Titan One', Impact, sans-serif";
    cx.fillText(`${G.score} / ${NEED}`, W / 2, 42);
    // clock
    const m = Math.floor(G.left / 60), s = Math.floor(G.left % 60);
    cx.textAlign = 'right';
    cx.fillStyle = G.left <= 10 ? '#ff3b45' : G.left <= 30 ? '#ffd166' : '#fff';
    cx.font = "bold 30px 'Titan One', Impact, sans-serif";
    cx.fillText(`${m}:${String(s).padStart(2, '0')}`, W - 24, 42);
    // legend
    cx.textAlign = 'left'; cx.font = '600 12px Inter, sans-serif'; cx.fillStyle = '#d0d0d9';
    px(BALL, 24, H - 34, 2); cx.fillText('+1', 48, H - 20);
    px(HYD, 84, H - 44, 2); cx.fillText('+3  (Mochi stops for 2s)', 108, H - 20);
    cx.fillStyle = '#0d0d10'; cx.beginPath(); cx.ellipse(300, H - 26, 14, 6, 0, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = '#8a8a92'; cx.lineWidth = 2; cx.stroke();
    cx.fillStyle = '#d0d0d9'; cx.fillText('−1  (jump it)', 322, H - 20);
    // touch: jump button, bottom-right
    if (G.touchDev) {
      const b = JUMP_BTN, on = G.jumpFlash > 0;
      cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      cx.fillStyle = on ? 'rgba(229,9,20,.85)' : 'rgba(0,0,0,.45)'; cx.fill();
      cx.lineWidth = 4; cx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.75)'; cx.stroke();
      cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = "bold 22px 'Titan One', Impact, sans-serif";
      cx.fillText('JUMP', b.x, b.y + 8);
    }
    // first-seconds hint
    if (G.hint > 0) {
      cx.globalAlpha = Math.min(1, G.hint);
      cx.fillStyle = 'rgba(0,0,0,.7)'; cx.fillRect(W / 2 - 250, 90, 500, 40);
      cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = "bold 16px 'Titan One', Impact, sans-serif";
      cx.fillText(`GET ${NEED} POINTS BEFORE THE CLOCK RUNS OUT`, W / 2, 117);
      cx.globalAlpha = 1;
    }
    // floats
    cx.textAlign = 'center'; cx.font = "bold 22px 'Titan One', Impact, sans-serif";
    for (const f of G.floats) {
      cx.globalAlpha = Math.max(0, f.t);
      cx.fillStyle = f.c; cx.fillText(f.s, f.x, f.y);
    }
    cx.globalAlpha = 1;
  }
  function render() {
    drawWorld();
    G.objs.filter(o => o.k === 'hole' || o.k === 'puddle').forEach(drawObj);
    G.objs.filter(o => o.k === 'ball' || o.k === 'hyd').forEach(drawObj);
    drawParty();
    if (G.hitCd > .55) { cx.fillStyle = 'rgba(229,9,20,.18)'; cx.fillRect(0, 0, W, H); }
    drawHud();
  }

  /* ---------- simulation ---------- */
  function float(s, x, y, c) { G.floats.push({ s, x, y, c, t: 1.2 }); }
  function spawn(dt) {
    const s = G.spawn;
    s.ball -= dt; s.hyd -= dt; s.hole -= dt;
    if (s.ball <= 0) {
      G.objs.push({ k: 'ball', x: ROAD_L + 30 + Math.random() * (ROAD_R - ROAD_L - 60), y: -30 });
      s.ball = .55 + Math.random() * .7;
    }
    if (s.hole <= 0) {
      G.objs.push({ k: 'hole', x: ROAD_L + 50 + Math.random() * (ROAD_R - ROAD_L - 100), y: -30 });
      s.hole = 1.7 + Math.random() * 1.6;
    }
    if (s.hyd <= 0) {
      G.hydSide = -G.hydSide;
      const x = G.hydSide < 0 ? ROAD_L - WALK / 2 : ROAD_R + WALK / 2;
      G.objs.push({ k: 'hyd', x, y: -30 });
      s.hyd = 7 + Math.random() * 5;
    }
  }
  function step(dt) {
    if (G.done) return;
    G.t += dt; G.left -= dt; G.hint -= dt;
    if (G.hitCd > 0) G.hitCd -= dt;
    G.floats.forEach(f => { f.t -= dt; f.y -= 40 * dt; }); G.floats = G.floats.filter(f => f.t > 0);
    const k = G.keys;

    if (G.pee > 0) {                                   // everyone waits for Mochi
      G.pee -= dt;
      const p = G.objs.find(o => o.k === 'puddle' && o.live);
      if (p) p.r = Math.min(26, p.r + 14 * dt);
      if (G.pee <= 0 && p) p.live = false;
    } else {
      // scroll + spawn
      G.scroll += SCROLL * dt;
      spawn(dt);
      G.objs.forEach(o => { o.y += SCROLL * dt; });
      // player
      let mx = 0, my = 0;
      if (G.touch) {                                   // steer toward the finger (held a bit above it)
        const dx = G.touch.x - G.px, dy = (G.touch.y - 90) - G.py, d = Math.hypot(dx, dy);
        if (d > 10) { mx = dx / d; my = dy / d; }
      } else {
        if (k.a || k.ArrowLeft) mx -= 1; if (k.d || k.ArrowRight) mx += 1;
        if (k.w || k.ArrowUp) my -= 1; if (k.s || k.ArrowDown) my += 1;
        if (mx || my) { const n = Math.hypot(mx, my); mx /= n; my /= n; }
      }
      G.moving = mx !== 0 || my !== 0;
      G.px = Math.max(ROAD_L - WALK + 44, Math.min(ROAD_R + WALK - 44, G.px + mx * MOVE * dt));
      G.py = Math.max(150, Math.min(660, G.py + my * MOVE * dt));
      G.walkT += dt;
      // jump
      if (G.jump > 0) G.jump -= dt;
      else if (k[' '] && !G.jumpHeld) jumpNow();
      G.jumpHeld = !!k[' '];
      if (G.jumpFlash > 0) G.jumpFlash -= dt;
      // dog follows on the leash, a little lag so the line swings
      const tx = G.px + Math.sin(G.t * 2.2) * 8, ty = G.py - 74;
      G.dx += (tx - G.dx) * Math.min(1, 7 * dt);
      G.dy += (ty - G.dy) * Math.min(1, 7 * dt);
      // collisions
      const air = G.jump > 0;
      for (const o of G.objs) {
        if (o.dead) continue;
        if (o.k === 'ball' && !air) {
          if (Math.hypot(o.x - G.px, o.y - G.py) < 34 || Math.hypot(o.x - G.dx, o.y - G.dy) < 26) {
            o.dead = true; G.score++; float('+1', o.x, o.y - 10, '#d9ec3a');
            if (opts.sfx) opts.sfx.found();
          }
        } else if (o.k === 'hyd') {
          if (Math.hypot(o.x - G.dx, o.y - G.dy) < 34) {
            o.dead = true; G.pee = 2; G.score += 3;
            G.objs.push({ k: 'puddle', x: G.dx + 12, y: G.dy + 16, r: 4, live: true });
            float('+3', o.x, o.y - 20, '#5ce08a');
            if (opts.sfx) opts.sfx.good();
          }
        } else if (o.k === 'hole' && !air && G.hitCd <= 0) {
          const nx = (o.x - G.px) / 30, ny = (o.y - G.py) / 13;
          if (nx * nx + ny * ny < 1) {
            G.hitCd = .8; G.score = Math.max(0, G.score - 1);
            float('-1', G.px, G.py - 40, '#ff5a62');
            if (opts.sfx) opts.sfx.bad();
          }
        }
      }
      G.objs = G.objs.filter(o => !o.dead && o.y < H + 60 && !(o.k === 'puddle' && !o.live && o.y > H));
    }
    if (G.score >= NEED) finish(true);
    else if (G.left <= 0) { G.left = 0; finish(false); }
  }
  function finish(win) {
    G.done = true;
    setTimeout(() => { stop(); opts.onDone && opts.onDone({ win, elapsed: G.t, score: G.score }); }, win ? 900 : 1200);
  }
  function loop(ts) {
    if (!active) return;
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
    step(dt); render();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- input ---------- */
  const JUMP_BTN = { x: W - 118, y: H - 118, r: 66 };
  function jumpNow() {
    if (G.jump > 0 || G.pee > 0 || G.done) return;
    G.jump = JUMP_T; G.jumpFlash = .18;
    if (opts.tone) opts.tone(700, .06, 'square', .04);
  }
  function canvasPos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  const pDown = e => {
    if (!active) return;
    e.preventDefault();
    if (e.pointerType !== 'mouse') G.touchDev = true;   // show the button once a finger shows up
    const p = canvasPos(e);
    if (G.touchDev && Math.hypot(p.x - JUMP_BTN.x, p.y - JUMP_BTN.y) < JUMP_BTN.r + 14) { jumpNow(); return; }
    G.touch = { x: p.x, y: p.y, id: e.pointerId };
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const pMove = e => {
    if (!active || !G.touch || e.pointerId !== G.touch.id) return;
    e.preventDefault();
    const p = canvasPos(e); G.touch.x = p.x; G.touch.y = p.y;
  };
  const pUp = e => { if (G.touch && e.pointerId === G.touch.id) G.touch = null; };
  const keyDown = e => {
    if (!active) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    G.keys[key] = true;
  };
  const keyUp = e => {
    if (!active) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    G.keys[key] = false;
  };

  function start(canvas, o) {
    cv = canvas; cx = cv.getContext('2d'); opts = o || {};
    cv.width = W; cv.height = H; cx.imageSmoothingEnabled = false;
    G = fresh(); active = true; last = performance.now();
    addEventListener('keydown', keyDown); addEventListener('keyup', keyUp);
    cv.addEventListener('pointerdown', pDown); cv.addEventListener('pointermove', pMove);
    cv.addEventListener('pointerup', pUp); cv.addEventListener('pointercancel', pUp);
    try { G.touchDev = matchMedia('(pointer: coarse)').matches; } catch (e) {}
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    active = false; cancelAnimationFrame(raf);
    removeEventListener('keydown', keyDown); removeEventListener('keyup', keyUp);
    if (cv) { cv.removeEventListener('pointerdown', pDown); cv.removeEventListener('pointermove', pMove);
      cv.removeEventListener('pointerup', pUp); cv.removeEventListener('pointercancel', pUp); }
  }
  return { start, stop, NEED, LIMIT, get state() { return G; }, _step: dt => { step(dt); render(); } };
})();
