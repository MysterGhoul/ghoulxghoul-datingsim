/* ============================================================
   MISSION: GHOULxGHOUL GETS LAID
   Single-page dating sim. No build step, no dependencies.

   Sprites:  assets/jasmine/stream_{neutral,happy,annoyed,flirty}.png  (white shirt)
             assets/jasmine/date_{neutral,happy,annoyed,flirty}.png    (black dress)
   Cutscene: assets/clip/stream.mp4  (optional 16:9 stream clip -> plays full screen;
             falls back to the webcam + chat mock-up if the file is absent)
   ============================================================ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const stage = $('#stage');
function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.transform = `translate(-50%,-50%) scale(${s})`;
}
addEventListener('resize', fit); fit();

/* ---------- tiny synth ---------- */
let AC = null, audioDead = false;
function audio() {
  if (AC || audioDead) return AC;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { audioDead = true; return null; }
    AC = new Ctx();
    if (AC.state === 'suspended') AC.resume().catch(() => {});
  } catch (e) { audioDead = true; AC = null; }
  return AC;
}
function tone(freq, dur = .09, type = 'square', vol = .06, delay = 0) {
  try {
    const ac = audio(); if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) {}
}
const SFX = {
  click: () => tone(320, .05, 'square', .04),
  good:  () => { tone(660, .09); tone(880, .11, 'square', .06, .07); tone(1170, .16, 'triangle', .06, .15); },
  meh:   () => tone(400, .1, 'sine', .05),
  bad:   () => { tone(200, .16, 'sawtooth', .05); tone(140, .24, 'sawtooth', .05, .1); },
  found: () => { tone(880, .07); tone(1320, .12, 'triangle', .06, .06); },
  nope:  () => tone(120, .1, 'sawtooth', .035),
  decoy: () => { tone(300, .08, 'sine', .045); tone(230, .12, 'sine', .04, .07); },
  room:  () => tone(520, .06, 'sine', .035),
  win:   () => [0, .12, .24, .40].forEach((d, i) => tone([523, 659, 784, 1047][i], .3, 'triangle', .07, d)),
  lose:  () => [0, .18, .40].forEach((d, i) => tone([392, 330, 233][i], .45, 'sawtooth', .05, d)),
};

/* ============================================================
   MUSIC - one track per scene, crossfaded, looping
   ============================================================ */
const MUSIC = {
  title: 'assets/music/title.mp3',   // menu
  ready: 'assets/music/getready.mp3',// intro + hidden object
  sushi: 'assets/music/sushi.mp3',   // the date
};
const MUS_VOL = 0.16;                     // background level - deliberately low
let musA = null, musB = null, musCur = null, musKey = null, musMuted = false;
let fadeIv = null;                        // only ever ONE fade in flight

function initMusic() {
  if (musA) return;
  musA = new Audio(); musB = new Audio();
  [musA, musB].forEach(a => { a.loop = true; a.preload = 'auto'; a.volume = 0; });
  musCur = musA;
}
function playMusic(key) {
  initMusic();
  if (musKey === key) return;
  const src = MUSIC[key];
  if (!src) return;
  musKey = key;
  const next = (musCur === musA) ? musB : musA;
  const prev = (musCur && musCur !== next) ? musCur : null;
  if (!next.src.endsWith(src)) next.src = src;
  try { next.currentTime = 0; } catch (e) {}
  next.volume = 0;
  const p = next.play();
  if (p) p.catch(() => {});              // blocked until a gesture; harmless
  musCur = next;
  crossfade(prev, next, musMuted ? 0 : MUS_VOL, 800);
}
function stopMusic(ms = 700) {
  if (!musCur) return;
  musKey = null;
  crossfade(musCur, null, 0, ms);
}
function crossfade(out, inn, target, ms) {
  if (fadeIv) { clearInterval(fadeIv); fadeIv = null; }   // cancel any in-flight fade
  const steps = 24, dt = ms / steps;
  const v0out = out ? out.volume : 0;
  let i = 0;
  fadeIv = setInterval(() => {
    i++;
    const k = i / steps;
    if (out) out.volume = Math.max(0, v0out * (1 - k));
    if (inn) inn.volume = Math.max(0, Math.min(1, target * k));
    if (i >= steps) {
      clearInterval(fadeIv); fadeIv = null;
      if (out && out !== inn) { try { out.pause(); out.currentTime = 0; } catch (e) {} }
    }
  }, dt);
}
/* one-shot sound effects (real files, not the synth) */
const SFXFILE = {
  win1: 'assets/sfx/win1_hub.mp3',
  win2: 'assets/sfx/win2_yamete.mp3',
};
function playSfx(key, vol = 0.8) {
  return new Promise(res => {
    const src = SFXFILE[key];
    if (!src) return res();
    try {
      const a = new Audio(src);
      a.volume = musMuted ? 0 : vol;
      a.addEventListener('ended', () => res(), { once: true });
      a.addEventListener('error', () => res(), { once: true });
      const p = a.play();
      if (p) p.catch(() => res());
    } catch (e) { res(); }
  });
}
function toggleMute() {
  musMuted = !musMuted;
  if (musCur) musCur.volume = musMuted ? 0 : MUS_VOL;
  const b = $('#muteBtn');
  if (b) { b.textContent = musMuted ? '♪ OFF' : '♪ ON'; b.classList.toggle('off', musMuted); }
}

/* ---------- state ---------- */
const GOAL = 70;                  // % of the rizz meter needed to win
let S = {};
function reset() {
  S = { score: 0, hearts: 3, huntStart: 0, found: {}, roll: null, node: 0, room: 0 };
}
let MAX = 0;

let current = 's-title';
function go(id) {
  $('#' + current)?.classList.remove('on');
  $('#' + id).classList.add('on');
  current = id;
}
function fade(on) {
  return new Promise(res => { $('#fader').classList.toggle('on', on); setTimeout(res, 950); });
}

/* ---------- HUD ---------- */
function hud(on) { $('#hud').classList.toggle('on', !!on); }
function drawHearts(popIndex = -1) {
  $('#hearts').innerHTML = [0, 1, 2].map(i =>
    `<span class="heart ${i >= S.hearts ? 'dead' : ''} ${i === popIndex ? 'pop' : ''}">&#10084;&#65039;</span>`
  ).join('');
}
function pct() { return Math.round(S.score / MAX * 100); }
function drawBar() { $('#barfill').style.width = Math.min(100, pct()) + '%'; }
function addScore(n) { S.score = Math.max(0, S.score + n); drawBar(); }
function loseHeart() {
  S.hearts--; drawHearts(S.hearts); drawBar();
  if (S.hearts <= 0) { setTimeout(() => endDumped(), 900); return true; }
  return false;
}

/* ---------- Jasmine sprite ---------- */
const MOODS = ['neutral', 'happy', 'annoyed', 'flirty'];
function buildJas(el) {
  el.innerHTML = `<img alt=""><span class="ph"></span>`;
  const img = el.querySelector('img');
  img.onerror = () => {
    if (img.dataset.ext === 'webp') {          // fall back to a .png of the same name
      img.dataset.ext = 'png';
      img.src = `assets/jasmine/${img.dataset.f}.png`;
      return;
    }
    el.classList.add('miss');
    el.querySelector('.ph').innerHTML =
      `JASMINE<br><br>missing<br><b style="color:#ff6b72">${img.dataset.f}</b>`;
  };
  img.onload = () => el.classList.remove('miss');
}
function setMood(el, set, mood) {
  const base = `${set}_${MOODS.includes(mood) ? mood : 'neutral'}`;
  const img = el.querySelector('img'); if (!img) return;
  if (img.dataset.f === base) return;
  img.dataset.f = base;
  img.dataset.ext = 'webp';
  img.src = `assets/jasmine/${base}.webp`;
  if (mood === 'annoyed') { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 450); }
}

const FXCOLOR = { good: '#5ce08a', great: '#ffd166', meh: '#9aa0b5', bad: '#ff5a62' };
function flash(word, kind = 'good') {
  const f = $('#flash');
  f.textContent = word;
  f.style.color = FXCOLOR[kind] || '#fff';
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}

/* ============================================================
   1. INTRO
   ============================================================ */
const INTRO = {
  mood: 'annoyed',
  say: `Babe. <em>Babe.</em> We go live in twenty minutes, it's <em>GOTH DAY</em> — I promised chat
        goth day — and I cannot find a single thing I need. Phone, battery, cable, selfie stick,
        and my black wig. Help me get ready for the stream?`,
  opts: [
    { t: `Sure thing! Twenty minutes is plenty.`, p: 10, fx: ['LOCKED IN', 'great'],
      r: `Okay. Okay okay okay. This is why I keep you. Check the whole apartment —
          and do NOT come back without that wig.`, mood: 'happy' },
    { t: `I mean, it IS my job after all.`, p: 4, fx: ['...OKAY', 'meh'],
      r: `Wow. Very romantic. Very "co-worker of the year." Just find my stuff. Wig first.`, mood: 'neutral' },
    { t: `Find them yourself.`, end: `You said "find them yourself" to a woman who is nineteen minutes from going live.
           She found them. She also found a new boyfriend in the same twenty minutes. Efficient.` },
  ]
};

/* ============================================================
   2. HIDDEN OBJECT - three rooms
   ============================================================ */
/* two of the four still use hand-drawn art (no usable public-domain
   product photo exists); swap in a photo by adding img: '...' */
const SVGS = {
  stick: `<svg width="104" height="104" viewBox="0 0 104 104">
    <g transform="rotate(-38 52 52)">
      <rect x="47" y="14" width="10" height="26" rx="3" fill="#2b2b33" stroke="#0e0e12" stroke-width="2"/>
      <rect x="43" y="10" width="18" height="9" rx="3" fill="#43434f" stroke="#0e0e12" stroke-width="2"/>
      <rect x="49" y="38" width="6" height="30" fill="#8e8e9c" stroke="#0e0e12" stroke-width="1.6"/>
      <rect x="50" y="66" width="4" height="22" fill="#a9a9b8" stroke="#0e0e12" stroke-width="1.4"/>
      <rect x="45" y="84" width="14" height="14" rx="4" fill="#1a1a20" stroke="#0e0e12" stroke-width="2"/>
      <circle cx="52" cy="91" r="2.4" fill="#E50914"/>
    </g></svg>`,
  phone: `<svg width="76" height="76" viewBox="0 0 76 76">
    <g transform="rotate(-18 38 38)">
      <rect x="25" y="13" width="26" height="50" rx="5" fill="#15151b" stroke="#000" stroke-width="2.4"/>
      <rect x="27.5" y="17" width="21" height="41" rx="2.5" fill="#2e3a4d"/>
      <circle cx="38" cy="22.5" r="3.6" fill="#E50914"/>
      <rect x="31" y="50" width="14" height="2.4" rx="1.2" fill="#5a6070"/>
      <rect x="31" y="54" width="9" height="2.4" rx="1.2" fill="#5a6070"/>
    </g></svg>`,
};

const ITEMS = {
  wig:     { name: 'Black wig',        img: 'assets/obj/wig.png',     w: 74 },
  stick:   { name: 'Selfie stick',     svg: SVGS.stick },
  cable:   { name: 'Charging cable',   img: 'assets/obj/cable.png',   w: 96 },
  phone:   { name: 'Stream phone',     svg: SVGS.phone },
  battery: { name: 'Portable battery', img: 'assets/obj/battery.png', w: 86 },
};

const DECOYS = {
  mug:     { img: 'assets/obj/mug.png',     w: 62,
             line: `That's a mug, babe. Put it down.` },
  remote:  { img: 'assets/obj/remote.png',  w: 78,
             line: `The TV remote? We're not WATCHING television, we're MAKING it.` },
  brush:   { img: 'assets/obj/brush.png',   w: 82,
             line: `That's the hairbrush. I need the WIG. Goth day, babe, keep up.` },
  headset: { img: 'assets/obj/headset.png', w: 88,
             line: `Wrong headset! That one's been broken since March.` },
};

const ROOMS = [
  { id: 'living', name: 'Living Room', bg: 'assets/bg/bg_room.jpg',
    place: [
      { k: 'stick',   x: 32.6, y: 49.0, s: 1.00 },
      { k: 'cable',   x: 54.5, y: 78.0, s: 0.95 },
      { d: 'mug',     x: 67.0, y: 60.0, s: 0.62 },
      { d: 'remote',  x: 76.5, y: 53.0, s: 0.62 },
    ] },
  { id: 'bed', name: 'Bedroom', bg: 'assets/bg/bg_bedroom.jpg',
    place: [
      { k: 'phone',   x: 31.0, y: 79.5, s: 0.95 },
      { k: 'wig',     x:  6.0, y: 70.0, s: 0.80 },
      { d: 'brush',   x: 88.0, y: 84.0, s: 0.85 },
      { d: 'headset', x: 60.5, y: 62.5, s: 0.80 },
    ] },
  { id: 'kitchen', name: 'Kitchen', bg: 'assets/bg/bg_kitchen.jpg',
    place: [
      { k: 'battery', x: 43.0, y: 57.5, s: 0.85 },
      { d: 'mug',     x: 19.0, y: 56.0, s: 0.62 },
      { d: 'headset', x: 80.5, y: 51.0, s: 0.55 },
    ] },
];

const HUNT_MAX = 32;
const HUNT_LIMIT = 120;   // seconds on the clock
const HUNT_FULL  = 40;    // finish inside this for full marks
const HUNT_FLOOR = 0.25;  // worst-case multiplier at 0:00
const HUNT_LINES = [
  `Four to go. Try another room!`,
  `Three left. Keep moving, babe.`,
  `Two left! Chat is already in the waiting room.`,
  `ONE MORE. One. Find it find it find it.`,
];

/* ============================================================
   3. CUTSCENE
   ============================================================ */
const CHAT = [
  ['xXGoblinKingXx', '#ff6b72', 'CHAT SHE IS DOING THE VOICE AGAIN'],
  ['pixel_gremlin', '#7bdcff', 'mommy energy detected'],
  ['SethWasHere', '#ffd166', 'bro is just sitting off cam like a lamp'],
  ['not_a_lurker_99', '#a0ff9c', 'FOUR HOURS??? sub goal is cooked'],
  ['LilyPlaysBad', '#ff9ef0', 'jasmine your aim is a war crime'],
  ['ghoul_enjoyer', '#ff6b72', 'W stream W wife'],
  ['moderator_dave', '#7bdcff', 'timing him out for existing'],
  ['toastcrumb', '#ffd166', 'the way she said "babe" I felt that'],
  ['BigHatNoCattle', '#a0ff9c', 'we love a woman who yells'],
  ['anon_47', '#ff9ef0', 'is he still looking for the cable'],
  ['crimsonfrog', '#7bdcff', 'PogChampion energy tonight'],
  ['ur_mom_2008', '#ffd166', 'chat we are so back'],
  ['SethWasHere', '#ffd166', 'he found it btw. took him ages'],
  ['quietviewer', '#a0ff9c', 'first time catching live and its PEAK'],
];
const NARR = [
  [2600, `The light comes on. She flips the voice on like a switch.`],
  [3000, `Four hours. She does not sit down once.`],
  [3000, `Chat falls in love. Chat falls in love <em>every single night.</em>`],
  [2900, `You sit just off camera, holding a cable, like an idiot in love.`],
  [3000, `At hour three she looks over at you and mouths <em>"sushi after?"</em>`],
  [2400, `You have never nodded faster in your life.`],
];

/* ============================================================
   4. THE DATE
   ============================================================ */
const ROLLS = [
  { n: 'Sweetheart Roll', d: 'Two pieces, one plate, shaped like a heart. Completely shameless.', p: 14,
    fx: ['SHAMELESS', 'great'], mood: 'flirty',
    r: `You did NOT. In public? ...Okay. Okay, that was smooth. I hate that that was smooth.` },
  { n: 'Spicy Tuna', d: 'Reliable. Sharp. Has never once let anybody down.', p: 10,
    fx: ['SOLID', 'good'], mood: 'happy',
    r: `Classic. Boring. But correct. I respect a man who knows what he likes.` },
  { n: 'Spicy Salmon', d: 'Basically the tuna, but you flinched.', p: 6,
    fx: ['SAFE', 'meh'], mood: 'neutral',
    r: `Salmon. Okay. That is the "I panicked at the menu" order and we both know it.` },
  { n: 'Dragon Roll', d: 'Enormous. Sauced beyond recognition. You will wear most of it.', p: 2,
    fx: ['OH NO', 'bad'], mood: 'annoyed',
    r: `Babe. It is the size of my forearm. You are going to get eel sauce on your shirt
        and then I have to look at that all night.` },
];

const DATE = [
  { mood: 'neutral',
    say: `Four hours of me screaming at a gacha banner and you still showed up in public with me.
          Either you are in love or you are deeply, clinically stupid.`,
    opts: [
      { t: `Can't it be both?`, p: 4, fx: ['SMOOTH', 'good'], mood: 'happy',
        r: `...It can be both. Sit down before I say something embarrassing.` },
      { t: `Chat voted. I had no choice.`, p: 2, fx: ['CUTE', 'meh'], mood: 'neutral',
        r: `Chat does not control you. Chat controls me. Big difference, get it right.` },
      { t: `Honestly I muted you around hour three.`, p: 0, h: 1, fx: ['OOF', 'bad'], mood: 'annoyed',
        r: `Wow. Straight for the throat. Menu. Now. Do not speak.` },
    ] },
  { order: true },
  { mood: 'happy',
    say: `So somebody dropped fifty bucks tonight purely to tell me I have, quote, "mommy energy."
          Fifty dollars. For that. <em>Do I?</em>`,
    opts: [
      { t: `They're right, and they're still not getting it.`, p: 4, fx: ['DANGEROUS', 'great'], mood: 'flirty',
        r: `Oh, we are being like that tonight. Noted. Extremely noted.` },
      { t: `I plead the fifth.`, p: 2, fx: ['COWARD', 'meh'], mood: 'neutral',
        r: `That is a yes with extra steps and you know it.` },
      { t: `No. Not even a little.`, p: 0, h: 1, fx: ['WRONG ANSWER', 'bad'], mood: 'annoyed',
        r: `Excuse me? I have carried you through four raid nights and a tax return. Try again.` },
      { t: `Yeah, you actually remind me a lot of my mom.`, end:
        `You compared her to your mother. Out loud. At a sushi bar. She put her chopsticks down very,
         very gently, which is somehow worse than throwing them.` },
    ] },
  { mood: 'neutral',
    say: `Sorry, one sec, Lily's texting. She wants to know if the collab's still on Sunday.
          What do I tell her?`,
    opts: [
      { t: `Tell her yes. And tell her she's not allowed to bully me on camera again.`,
        p: 4, fx: ['NICE', 'good'], mood: 'happy',
        r: `She is absolutely going to bully you on camera again. I have already told her she can.` },
      { t: `Tell her you're busy Sunday. And Saturday. And tonight.`,
        p: 3, fx: ['BOLD', 'good'], mood: 'flirty',
        r: `Mmm. Confident. I have not agreed to anything. But keep going.` },
      { t: `Can you not be on your phone for ten minutes?`, p: 0, h: 1, fx: ['YIKES', 'bad'], mood: 'annoyed',
        r: `I run a business off this phone, babe. Careful.` },
    ] },
  { mood: 'flirty',
    say: `<em>(She reaches over and takes a piece straight off your plate.)</em><br>
          What. You gonna do something about it?`,
    opts: [
      { t: `(Take one of hers without breaking eye contact.)`, p: 4, fx: ['ELITE', 'great'], mood: 'flirty',
        r: `Oh my GOD. Okay. Okay, that was hot, I am admitting that out loud, one time only.` },
      { t: `Nope. That's the whole bit. You steal, I watch.`, p: 3, fx: ['CHARMING', 'good'], mood: 'happy',
        r: `See, this is why the internet likes you more than me. Traitors, all of them.` },
      { t: `That was mine, actually.`, p: 0, h: 1, fx: ['SERIOUSLY?', 'bad'], mood: 'annoyed',
        r: `"Actually." You said "actually" to me. At dinner. Bold.` },
    ] },
  { mood: 'neutral',
    say: `Okay, real one. If the channel actually blew up tomorrow. Like, properly blew up.
          Would you still want this? Us? Or does it get weird.`,
    opts: [
      { t: `The stream is the job. You're the reason I log off.`, p: 4, fx: ['DEVASTATING', 'great'], mood: 'flirty',
        r: `<em>(long pause)</em> ...That is so unfair. You cannot just SAY that between bites of rice.` },
      { t: `It'd get weird. We'd handle it. We always do.`, p: 3, fx: ['HONEST', 'good'], mood: 'happy',
        r: `Yeah. Yeah, okay. That is the real answer, isn't it. I like the real answer.` },
      { t: `I'd want a cut.`, p: 1, fx: ['BUSINESS', 'meh'], mood: 'neutral',
        r: `You get twelve percent and a hug. Final offer.` },
      { t: `Honestly I'd start my own channel and outgrow you.`, p: 0, h: 1, fx: ['WOW', 'bad'], mood: 'annoyed',
        r: `Wow. Okay. Good luck with the thumbnails, buddy.` },
    ] },
  { mood: 'flirty',
    say: `You have been staring at my mouth for like a full minute.`,
    opts: [
      { t: `I've been staring at your mouth for four years.`, p: 4, fx: ['DOWN BAD', 'great'], mood: 'flirty',
        r: `<em>(she goes red and hides behind the menu)</em> Nope. Nope, put that away. We are in a RESTAURANT.` },
      { t: `You've got rice on your face. (She does not.)`, p: 2, fx: ['MENACE', 'meh'], mood: 'happy',
        r: `<em>(wipes her face)</em> ...I do not, do I. You are a menace and I am eating your ginger.` },
      { t: `Sorry. That was weird.`, p: 0, h: 1, fx: ["DON'T APOLOGIZE", 'bad'], mood: 'annoyed',
        r: `Do not apologize for looking at me. That is the single worst thing you could have said.` },
    ] },
  { mood: 'happy',
    say: `Tell me something you've never said on stream. Something chat has never gotten.`,
    opts: [
      { t: `First time I saw you on cam I forgot how to type.`, p: 4, fx: ['MELTED HER', 'great'], mood: 'flirty',
        r: `Shut UP. You lurked? You were a LURKER? Four years and I am finding this out at a sushi bar?` },
      { t: `I've read every single comment anyone's left about you. All of them.`,
        p: 3, fx: ['UNHINGED (GOOD)', 'good'], mood: 'happy',
        r: `That is genuinely unsettling and I have never felt safer. What a night.` },
      { t: `I don't really have anything.`, p: 1, fx: ['NOTHING?', 'meh'], mood: 'neutral',
        r: `Four years of material and you have got nothing. Incredible. Drink your tea.` },
    ] },
  { mood: 'flirty',
    say: `<em>(slides a cup of sake across the table)</em> One. And then you're driving.`,
    opts: [
      { t: `One. And then I'm carrying you.`, p: 4, fx: ['CONFIRMED HIT', 'great'], mood: 'flirty',
        r: `<em>(drinks the whole cup in one go)</em> ...Say that again in about forty minutes.` },
      { t: `You know I don't really drink.`, p: 1, fx: ['FAIR', 'meh'], mood: 'neutral',
        r: `That is fine. More for me. You are still carrying me either way.` },
      { t: `Let's do four and see what happens.`, p: 0, h: 1, fx: ['SLOW DOWN', 'bad'], mood: 'annoyed',
        r: `Babe, last time you did that you fell asleep during my OWN stream. On camera. Clip's still up.` },
    ] },
  { mood: 'neutral',
    say: `God, my back is <em>destroyed.</em> That chair is going to kill me before chat does.`,
    opts: [
      { t: `I've got hands and I've got all night. Say the word.`, p: 4, fx: ['SAY LESS', 'great'], mood: 'flirty',
        r: `<em>(very long sip of tea)</em> ...The word. That is me saying the word. Are you getting this?` },
      { t: `We should finally buy you a real chair.`, p: 1, fx: ['PRACTICAL', 'meh'], mood: 'neutral',
        r: `Practical. Romantic. Truly the whole package. Thanks, dad.` },
      { t: `Sounds like a you problem.`, p: 0, h: 1, fx: ['BRUTAL', 'bad'], mood: 'annoyed',
        r: `Wow. Hope the couch is comfortable tonight, because you are going to find out.` },
    ] },
  { mood: 'flirty', last: true,
    say: `<em>(the check comes. She does not look at it. She looks at you.)</em><br>
          So. Do you wanna get dessert here... or.`,
    opts: [
      { t: `Or.`, p: 8, fx: ['MISSION SUCCESS', 'great'], mood: 'flirty',
        r: `<em>(already standing up)</em> Get the coat. Get the coat get the coat get the coat.` },
      { t: `I already paid twenty minutes ago. Get your coat.`, p: 6, fx: ['OPERATOR', 'great'], mood: 'flirty',
        r: `When did you even — okay, that is unbelievably attractive, we are leaving, RIGHT now.` },
      { t: `Dessert sounds great! What do they have?`, p: 0, h: 1, fx: ['SHE SAID OR', 'bad'], mood: 'annoyed',
        r: `...Mochi. They have mochi. <em>(she puts her head in her hands)</em>` },
      { t: `Actually, let's see if that ramen place is still open.`, end:
        `She said "or." She looked right at you and said "or." You said <em>ramen.</em>
         She got a rideshare home alone and told chat about it the next night for ninety minutes.` },
    ] },
];

MAX = 10 + HUNT_MAX + Math.max(...ROLLS.map(r => r.p))
    + DATE.filter(n => !n.order).reduce((a, n) => a + Math.max(...n.opts.map(o => o.p || 0)), 0);

/* ============================================================
   RENDERING
   ============================================================ */
function renderDialog(boxEl, name, html, opts, onPick, isYou) {
  boxEl.innerHTML = `
    <div class="nameplate ${isYou ? 'you' : ''}">${name}</div>
    <div class="dpanel">
      <div class="dtext">${html}</div>
      ${opts ? `<div class="choices"></div>` : `<div class="hint">CLICK ANYWHERE TO CONTINUE</div>`}
    </div>`;
  if (opts) {
    const wrap = boxEl.querySelector('.choices');
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'ch';
      b.innerHTML = `<span class="k">${i + 1}</span><span>${o.t}</span>`;
      b.onclick = () => { SFX.click(); onPick(o, i); };
      wrap.appendChild(b);
    });
  }
}
function waitClick(screenId) {
  return new Promise(res => {
    const el = $('#' + screenId);
    const h = () => { el.removeEventListener('click', h); SFX.click(); res(); };
    setTimeout(() => el.addEventListener('click', h), 260);
  });
}

/* ============================================================
   FLOW
   ============================================================ */
$('#startBtn').onclick = async () => {
  audio(); SFX.click();
  reset(); drawHearts(); drawBar();
  playMusic('ready');
  await fade(true);
  go('s-intro'); hud(true);
  await fade(false);
  runIntro();
};

function runIntro() {
  const jas = $('#jas-intro');
  buildJas(jas); setMood(jas, 'stream', INTRO.mood);
  renderDialog($('#intro-box'), 'Jasmine', INTRO.say, INTRO.opts, async (o) => {
    if (o.end) { SFX.bad(); return gameOver(o.end); }
    addScore(o.p); setMood(jas, 'stream', o.mood);
    (o.p >= 10 ? SFX.good : SFX.meh)();
    flash(o.fx[0], o.fx[1]);
    renderDialog($('#intro-box'), 'Jasmine', o.r, null);
    await waitClick('s-intro');
    startHunt();
  });
}

/* ---------- hunt ---------- */
let huntTimer = null;
const totalTargets = () => ROOMS.reduce((a, r) => a + r.place.filter(p => p.k).length, 0);

async function startHunt() {
  await fade(true);
  go('s-hunt');
  S.found = {}; S.room = 0;
  $('#checklist').innerHTML = Object.entries(ITEMS).map(([k, it]) =>
    `<li data-i="${k}"><span class="box"></span>${it.name}</li>`).join('');
  $('#roomnav').innerHTML = ROOMS.map((r, i) =>
    `<button class="roomb ${i === 0 ? 'on' : ''}" data-r="${i}">${r.name}</button>`).join('');
  $$('#roomnav .roomb').forEach(b => {
    b.onclick = () => { SFX.room(); showRoom(+b.dataset.r); };
  });
  say(`Twenty minutes, babe. Check every room!`);
  showRoom(0);

  S.huntStart = performance.now();
  S.huntOver = false;
  clearInterval(huntTimer);
  huntTimer = setInterval(() => {
    const t = (performance.now() - S.huntStart) / 1000;
    const left = Math.max(0, HUNT_LIMIT - t);
    const c = $('#clock');
    c.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    c.classList.toggle('warn', left <= 30);
    c.classList.toggle('crit', left <= 10);
    if (left <= 10 && left > 0 && Math.floor(left * 2) !== S.lastTick) {
      S.lastTick = Math.floor(left * 2);
      tone(left <= 5 ? 1100 : 820, .05, 'square', .04);
    }
    const n = Object.keys(S.found).length;
    const live = Math.round(HUNT_MAX * huntFactor(t) * (n / totalTargets()));
    $('#barfill').style.width = Math.min(100, Math.round((S.score + live) / MAX * 100)) + '%';
    if (left <= 0 && !S.huntOver) timeUp();
  }, 100);
  await fade(false);
}
function say(html) { $('#huntsay-t').innerHTML = html; }

function showRoom(i) {
  S.room = i;
  const room = ROOMS[i];
  $('#huntbg').style.backgroundImage = `url('${room.bg}')`;
  $$('#roomnav .roomb').forEach((b, j) => b.classList.toggle('on', j === i));

  const field = $('#huntfield');
  field.innerHTML = '';
  room.place.forEach(p => {
    if (p.k && S.found[p.k]) return;                 // already collected
    const def = p.k ? ITEMS[p.k] : DECOYS[p.d];
    const b = document.createElement('button');
    b.className = 'obj';
    b.style.left = p.x + '%'; b.style.top = p.y + '%';
    b.style.setProperty('--s', p.s);
    b.innerHTML = def.img
      ? `<img src="${def.img}" style="width:${(def.w || 80)}px" alt="">`
      : def.svg;
    b.onclick = e => {
      e.stopPropagation();
      if (p.k) grab(p.k, b); else wrongItem(p.d, b);
    };
    field.appendChild(b);
  });
  field.onclick = e => {
    SFX.nope();
    const r = stage.getBoundingClientRect(), sc = r.width / 1280;
    const m = document.createElement('div');
    m.className = 'miss-x'; m.textContent = '✗';
    m.style.left = (e.clientX - r.left) / sc + 'px';
    m.style.top  = (e.clientY - r.top) / sc + 'px';
    field.appendChild(m); setTimeout(() => m.remove(), 600);
  };
}

function wrongItem(id, btn) {
  SFX.decoy();
  btn.classList.add('wrong');
  setTimeout(() => btn.classList.remove('wrong'), 600);
  flash('NOT IT', 'meh');
  say(DECOYS[id].line);
}

function grab(id, btn) {
  SFX.found();
  btn.classList.add('got');
  const li = $(`#checklist li[data-i="${id}"]`);
  li.classList.add('done');
  li.querySelector('.box').innerHTML = '&#10003;';
  S.found[id] = true;
  const left = totalTargets() - Object.keys(S.found).length;
  if (id === 'wig') say(`THE WIG! Okay, goth day is SAVED. ${left} to go.`);
  else if (left > 0) say(HUNT_LINES[HUNT_LINES.length - left] || `Keep going!`);
  if (left === 0) finishHunt();
}

function huntFactor(t) {
  if (t <= HUNT_FULL) return 1;
  const k = (t - HUNT_FULL) / (HUNT_LIMIT - HUNT_FULL);
  return Math.max(HUNT_FLOOR, 1 - (1 - HUNT_FLOOR) * k);
}

async function finishHunt() {
  if (S.huntOver) return;
  S.huntOver = true;
  clearInterval(huntTimer);
  const t = (performance.now() - S.huntStart) / 1000;
  const pts = Math.round(HUNT_MAX * huntFactor(t));
  addScore(pts);
  $('#clock').classList.remove('warn', 'crit');
  const verdict = t < 40 ? `That was FAST. Okay. I am impressed and a little turned on.`
    : t < 85 ? `Good enough. Barely. Plug it all in, we are live in four.`
    : `Took you long enough. I have already apologised to chat twice.`;
  say(`<b style="display:inline;color:#ffd166">+${pts} RIZZ</b> &nbsp;${verdict}`);
  (t < 40 ? SFX.good : SFX.meh)();
  flash(t < 40 ? 'SPEEDRUN' : t < 85 ? 'GOT IT' : 'FINALLY', t < 85 ? 'great' : 'meh');
  await new Promise(r => setTimeout(r, 2600));
  startCut();
}

/* clock hit 0:00 without everything -> run over */
async function timeUp() {
  if (S.huntOver) return;
  S.huntOver = true;
  clearInterval(huntTimer);
  $('#clock').textContent = '0:00';
  $('#clock').classList.remove('warn', 'crit');
  const n = Object.keys(S.found).length, N = totalTargets();
  const missing = Object.keys(ITEMS).filter(k => !S.found[k]).map(k => ITEMS[k].name.toLowerCase());
  SFX.bad();
  flash("TIME'S UP", 'bad');
  say(`<b style="display:inline;color:#ff5a62">TIME</b> &nbsp;...That's twenty minutes. I have to go live.`);
  await new Promise(r => setTimeout(r, 2200));
  gameOver(`The clock hit zero with <b style="color:#ff99a0">${N - n}</b> thing${N - n === 1 ? '' : 's'}
    still missing — no ${missing.join(', no ')}.<br><br>
    She went live anyway, in her own hair, on goth day, holding a phone at eleven percent.
    Chat noticed. Chat <em>always</em> notices. There was no sushi.`);
}

/* ---------- cutscene ---------- */
let cutTimers = [], cutIvs = [];
function clearCut() {
  cutTimers.forEach(clearTimeout); cutTimers = [];
  cutIvs.forEach(clearInterval); cutIvs = [];
}

async function startCut() {
  await fade(true);
  go('s-cut'); hud(false);
  stopMusic(600);
  clearCut();
  $('#narr').innerHTML = '';
  $('#cutcard').classList.remove('on');

  const vid = $('#clipvid');
  const useVideo = await new Promise(res => {
    if (!vid) return res(false);
    let done = false;
    const ok = () => { if (!done) { done = true; res(true); } };
    const no = () => { if (!done) { done = true; res(false); } };
    if (vid.readyState >= 2) return ok();
    vid.addEventListener('loadeddata', ok, { once: true });
    vid.addEventListener('error', no, { once: true });
    setTimeout(no, 2500);
    vid.load();
  });

  $('#s-cut').classList.toggle('hasvid', useVideo);
  await fade(false);

  if (useVideo) {
    vid.currentTime = 0;
    vid.muted = false;
    vid.volume = 0.85;
    vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
  } else {
    // fallback: mock webcam + scrolling chat
    const cam = $('#cam'), img = cam.querySelector('img');
    img.onerror = () => cam.classList.add('miss');
    img.onload = () => cam.classList.remove('miss');
    img.src = 'assets/jasmine/stream_happy.png';
    $('#chatlog').innerHTML = '';
    let ci = 0;
    cutIvs.push(setInterval(() => {
      const [u, c, m] = CHAT[ci++ % CHAT.length];
      const d = document.createElement('div');
      d.className = 'msg';
      d.innerHTML = `<u style="color:${c}">${u}</u>: ${m}`;
      const log = $('#chatlog');
      log.appendChild(d);
      while (log.children.length > 13) log.firstChild.remove();
    }, 820));
    let v = 412;
    cutIvs.push(setInterval(() => {
      v += Math.floor(Math.random() * 40) - 8;
      $('#viewers').innerHTML = '&#128065; ' + Math.max(180, v);
    }, 900));
  }

  // narration beats run over either version
  let t = 400;
  NARR.forEach(([dur, line]) => {
    cutTimers.push(setTimeout(() => { $('#narr').style.opacity = 0; }, t - 260));
    cutTimers.push(setTimeout(() => {
      $('#narr').innerHTML = line; $('#narr').style.opacity = 1; tone(520, .05, 'sine', .025);
    }, t));
    t += dur;
  });

  const endCut = async () => {
    clearCut();
    $('#skip').onclick = null;
    if (vid) { try { vid.pause(); } catch (e) {} }
    $('#cutcard-t').textContent = '4 HOURS LATER';
    $('#cutcard').classList.add('on');
    await new Promise(r => setTimeout(r, 2100));
    startDate();
  };
  // if a clip is playing, run until it ends (or the narration finishes, whichever is longer)
  const dur = useVideo && isFinite(vid.duration) && vid.duration > 1
    ? Math.max(t + 500, vid.duration * 1000 + 400) : t + 500;
  cutTimers.push(setTimeout(endCut, dur));
  $('#skip').onclick = () => { SFX.click(); endCut(); };
}

/* ---------- date ---------- */
async function startDate() {
  await fade(true);
  go('s-date'); hud(true); $('#clock').textContent = '';
  playMusic('sushi');
  const jas = $('#jas-date');
  buildJas(jas); setMood(jas, 'date', 'neutral');
  S.node = 0;
  await fade(false);
  step();
}
function step() {
  const jas = $('#jas-date');
  const n = DATE[S.node];
  if (!n) return endWinOrLose();
  if (n.order) return showMenu();

  $('#menu').style.display = 'none';
  setMood(jas, 'date', n.mood);
  renderDialog($('#date-box'), 'Jasmine', n.say, n.opts, async (o) => {
    if (o.end) { SFX.bad(); return gameOver(o.end); }
    addScore(o.p);
    setMood(jas, 'date', o.mood);
    flash(o.fx[0], o.fx[1]);
    (o.p >= 3 ? SFX.good : o.p >= 1 ? SFX.meh : SFX.bad)();
    const dumped = o.h ? loseHeart() : false;
    renderDialog($('#date-box'), 'Jasmine', o.r, null);
    if (dumped) return;
    await waitClick('s-date');
    S.node++; step();
  });
}
function showMenu() {
  const jas = $('#jas-date');
  setMood(jas, 'date', 'neutral');
  renderDialog($('#date-box'), 'Jasmine',
    `Order first. I already know what I'm getting.
     <em>(She is watching you. She is absolutely watching you.)</em>`, null);
  $('#date-box').querySelector('.hint').textContent = 'PICK FROM THE MENU ABOVE';
  const m = $('#menu'); m.style.display = 'block';
  $('#rolls').innerHTML = '';
  ROLLS.forEach(r => {
    const b = document.createElement('button');
    b.className = 'roll';
    b.innerHTML = `<div class="n">${r.n}</div><div class="d">${r.d}</div>`;
    b.onclick = async () => {
      SFX.click(); addScore(r.p); S.roll = r.n;
      m.style.display = 'none';
      setMood(jas, 'date', r.mood);
      flash(r.fx[0], r.fx[1]);
      (r.p >= 10 ? SFX.good : r.p >= 6 ? SFX.meh : SFX.bad)();
      renderDialog($('#date-box'), 'Jasmine', r.r, null);
      await waitClick('s-date');
      S.node++; step();
    };
    $('#rolls').appendChild(b);
  });
}

/* ============================================================
   ENDINGS
   ============================================================ */
function confetti() {
  const c = $('#confetti'); c.innerHTML = '';
  const cols = ['#E50914', '#ff3b45', '#ffd166', '#ffffff', '#8d060d'];
  for (let i = 0; i < 90; i++) {
    const d = document.createElement('div');
    d.className = 'cf';
    d.style.left = Math.random() * 100 + '%';
    d.style.background = cols[i % cols.length];
    d.style.animationDuration = (2.4 + Math.random() * 2.6) + 's';
    d.style.animationDelay = (Math.random() * 2.2) + 's';
    d.style.opacity = .55 + Math.random() * .45;
    c.appendChild(d);
  }
}
const replayBtns = `<div class="endbtns"><button class="btn" id="againBtn">Play Again</button></div>`;

async function showEnd(html, withConfetti) {
  hud(false);
  stopMusic(900);
  $('#endin').innerHTML = html;
  $('#confetti').innerHTML = '';
  go('s-end');
  await fade(false);
  if (withConfetti) confetti();
  const again = $('#againBtn');
  if (again) again.onclick = async () => {
    SFX.click(); await fade(true);
    $('#confetti').innerHTML = '';
    go('s-title'); hud(false); reset(); drawHearts(); drawBar();
    playMusic('title');
    await fade(false);
  };
}
async function gameOver(reason) {
  clearInterval(huntTimer); clearCut();
  await fade(true); SFX.lose();
  showEnd(`<div class="bigfail">Game Over</div>
    <div class="endnote" style="font-size:18px;color:#c9c9d6;margin-top:24px">${reason}</div>
    <div class="scoreline">Final Rizz</div><div class="scorenum">${pct()}%</div>${replayBtns}`, false);
}
async function endDumped() {
  clearInterval(huntTimer);
  await fade(true); SFX.lose();
  showEnd(`<div class="bigfail">She Left.</div>
    <div class="endnote" style="font-size:18px;color:#c9c9d6;margin-top:24px">
      Three strikes. She finished her tea, said "this was fun," paid for her own half,
      and was in a rideshare before you got your coat on.
      She streamed about it for two hours the next night. Great numbers, honestly.
    </div>
    <div class="scoreline">Final Rizz</div><div class="scorenum">${pct()}%</div>${replayBtns}`, false);
}
async function endWinOrLose() {
  const p = pct();
  if (p < GOAL) {
    await fade(true); SFX.lose();
    return showEnd(`<div class="bigfail">Goodnight!</div>
      <div class="endnote" style="font-size:18px;color:#c9c9d6;margin-top:24px">
        She hugged you in the parking lot. A good hug. A <em style="color:#ff99a0">long</em> hug.
        Then she said "text me when you get home," got in her car, and drove away.
      </div>
      <div class="scoreline">Final Rizz</div><div class="scorenum">${p}%</div>${replayBtns}`, false);
  }

  /* ---- WIN SEQUENCE ---- */
  stopMusic(800);
  await fade(true);                       // fade to black
  hud(false);
  $('#endin').innerHTML = `<div class="endl" id="winline"></div>`;
  $('#confetti').innerHTML = '';
  go('s-end');
  await new Promise(r => setTimeout(r, 400));
  playSfx('win1', 0.85);                  // 1. hub intro sting
  await new Promise(r => setTimeout(r, 900));
  $('#fader').classList.remove('on');

  const line = `"You win, big boy."`;
  const q = document.createElement('span');
  q.className = 'q';
  $('#winline').appendChild(q);
  for (let i = 0; i < line.length; i++) {
    q.textContent = line.slice(0, i + 1);
    if (line[i] !== ' ') tone(300 + Math.random() * 120, .028, 'sine', .022);
    await new Promise(r => setTimeout(r, 62));
  }
  await new Promise(r => setTimeout(r, 1400));

  await fade(true);
  playSfx('win2', 0.85);                  // 2. yamete kudasai, over the YOU WIN card
  await showEnd(`<div class="bigwin glowred">You<br>Win</div>
    <div class="scoreline">Final Rizz</div><div class="scorenum">${p}%</div>
    <div class="endnote">${
      p >= 95 ? 'A flawless run. Genuinely upsetting to witness.'
      : p >= 85 ? 'Comfortable. She never stood a chance.'
      : 'You scraped it. She is choosing not to mention the Dragon Roll.'}</div>
    ${replayBtns}`, true);
}

/* ---------- keyboard ---------- */
addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '4') $$('.screen.on .ch')[+e.key - 1]?.click();
  if (e.key === 'Enter' || e.key === ' ') $('.screen.on .btn')?.click();
  if (current === 's-hunt' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const d = e.key === 'ArrowRight' ? 1 : -1;
    SFX.room(); showRoom((S.room + d + ROOMS.length) % ROOMS.length);
  }
});

/* ---------- boot ---------- */
reset(); drawHearts(); drawBar();
$('#muteBtn').onclick = e => { e.stopPropagation(); toggleMute(); };
/* first gesture unlocks audio; skip it when they go straight into the game */
const kickTitle = e => {
  if (e.target && e.target.closest && e.target.closest('#startBtn')) return;
  if (!musKey && current === 's-title') playMusic('title');
  removeEventListener('pointerdown', kickTitle);
};
addEventListener('pointerdown', kickTitle);
buildJas($('#jas-intro')); buildJas($('#jas-date'));
setMood($('#jas-intro'), 'stream', 'annoyed');
setMood($('#jas-date'), 'date', 'neutral');
