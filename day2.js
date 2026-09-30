/* ============================================================
   DAY 2 - the day off.
   Wake up -> Mochi's walk (walk.js) -> the second hunt, where every
   item you find opens a "what's the plan" dialogue.
   Loaded after game.js; uses its helpers (say, renderDialog, startHunt...).
   ============================================================ */

const WALK_MAX = 32, WALK_FULL = 75;         // full marks if 25 points inside 75s

/* ---------- waking up ---------- */
const WAKE = {
  mood: 'sleepy',
  say: `Mmh. No stream today. No alarms. Nothing. <em>(Mochi is sitting on your chest.)</em><br>
        So what are we doing with a whole day off?`,
  opts: [
    { t: `Walk Mochi. He's been staring at the leash for an hour.`, p: 10, fx: ['GOOD BOY', 'great'], mood: 'happy',
      r: `He HAS. Okay. Shoes. Leash. Let's go before he explodes.` },
    { t: `Nothing. Absolutely nothing. Bed, all day.`, p: 4, fx: ['TEMPTING', 'meh'], mood: 'neutral',
      r: `Tempting. Mochi disagrees. Mochi is currently eating my sock about it. ...Fine. Walk first, bed later.` },
    { t: `I was gonna check chat, see if anyone's on.`, p: 0, h: 1, fx: ['DAY. OFF.', 'bad'], mood: 'annoyed',
      r: `It is a DAY OFF. Say "chat" one more time. Get the leash.` },
  ]
};
const AFTER_WALK = {
  fast: { mood: 'flirty', say: `Twenty-five. He's out cold on the rug already. So... whole day left, empty apartment,
          and I <em>may</em> have hidden a few things around the place this morning. Go find them.
          Bring me each one and tell me the plan.` },
  slow: { mood: 'happy', say: `That took a while &mdash; he's still wired, but he's home. Empty apartment, whole afternoon.
          I hid a few things this morning. Find them, and tell me what you're planning with each one.` },
};

/* ---------- the second hunt ---------- */
const ITEMS_D2 = {
  lotion: { name: 'Lotion',      img: 'assets/obj/lotion.png', w: 44 },
  oil:    { name: 'Baby oil',    img: 'assets/obj/oil.png',    w: 46 },
  crop:   { name: 'Riding crop', img: 'assets/obj/crop.png',   w: 110 },
  gag:    { name: 'Ball gag',    img: 'assets/obj/gag.png',    w: 66 },
};
const ROOMS_D2 = [
  { id: 'living', name: 'Living Room', bg: 'assets/bg/bg_room.jpg',
    place: [
      { k: 'crop',    x: 31.5, y: 52.0, s: 0.95 },
      { k: 'gag',     x: 74.0, y: 55.5, s: 0.85 },
      { d: 'mug',     x: 67.0, y: 60.0, s: 0.62 },
      { d: 'remote',  x: 55.0, y: 79.0, s: 0.62 },
    ] },
  { id: 'bed', name: 'Bedroom', bg: 'assets/bg/bg_bedroom.jpg',
    place: [
      { k: 'lotion',  x:  6.0, y: 72.0, s: 0.95 },
      { d: 'brush',   x: 88.0, y: 84.0, s: 0.85 },
      { d: 'headset', x: 60.5, y: 62.5, s: 0.80 },
    ] },
  { id: 'kitchen', name: 'Kitchen', bg: 'assets/bg/bg_kitchen.jpg',
    place: [
      { k: 'oil',     x: 43.0, y: 56.0, s: 0.95 },
      { d: 'mug',     x: 19.0, y: 56.0, s: 0.62 },
      { d: 'headset', x: 80.5, y: 51.0, s: 0.55 },
    ] },
];
const D2_LEFT = { 3: `Three left. Keep going.`, 2: `Two more. Faster.`,
                  1: `One more. I know exactly where it is and I'm not telling you.` };

/* what's the plan for each one - Day 1 rules: best / good / heart-loss, one trap */
const D2_DLG = {
  lotion: { mood: 'flirty',
    say: `Lotion. Okay. First one. What, exactly, is the plan with that?`,
    opts: [
      { t: `Full back rub. Slow. You don't lift a finger.`, p: 14, fx: ['SAY LESS', 'great'], mood: 'flirty',
        r: `...I'm going to need you to say that again. Slower. Later.` },
      { t: `Your feet. You've been standing at that desk all week.`, p: 9, fx: ['THOUGHTFUL', 'good'], mood: 'happy',
        r: `That's dangerously thoughtful. Keep going, you're doing great.` },
      { t: `It's for dry hands. It's just for dry hands.`, p: 3, fx: ['COWARD', 'meh'], mood: 'neutral',
        r: `"Just for dry hands." Okay. Sure. Coward.` },
      { t: `Mochi's paws get dry in the winter.`, p: 0, h: 1, fx: ['THE DOG?', 'bad'], mood: 'annoyed',
        r: `Why is the dog in this. Why is the dog in this conversation.` },
    ] },
  oil: { mood: 'flirty',
    say: `Baby oil. Now we're talking. Go on. Plan.`,
    opts: [
      { t: `You, the good sheets, and absolutely no plan after that.`, p: 14, fx: ['THE GOOD SHEETS', 'great'], mood: 'flirty',
        r: `...The GOOD sheets. He's a menace. I love it. Next.` },
      { t: `Massage, round two. Different oil, different vibe.`, p: 9, fx: ['SPA DAY', 'good'], mood: 'happy',
        r: `You're building a whole spa day over here. I'm not mad about it.` },
      { t: `Honestly? His coat. Makes it shiny.`, p: 0, h: 1, fx: ['STOP', 'bad'], mood: 'annoyed',
        r: `STOP bringing up the DOG.` },
      { t: `The bedroom door squeaks. Been meaning to fix that.`, end:
        `You looked at a bottle of baby oil, looked at her, and said "door hinge." She fixed the hinge.
         She went to bed at eight, alone, and closed the door. It didn't squeak.` },
    ] },
  crop: { mood: 'flirty',
    say: `Oh. <em>Oh.</em> You found the crop. Careful, now.`,
    opts: [
      { t: `I'm not saying anything. I'm just going to hand it to you.`, p: 15, fx: ['CORRECT', 'great'], mood: 'flirty',
        r: `...Smart. SMART man. That is the correct answer and you know it.` },
      { t: `I'll be gentle.`, p: 9, fx: ['WILL YOU', 'good'], mood: 'happy',
        r: `Who said <em>you're</em> the one holding it?` },
      { t: `Giddy up?`, p: 5, fx: ['...ALLOWED', 'meh'], mood: 'neutral',
        r: `...I'm going to allow that. Once.` },
      { t: `Is this for the dog?`, p: 0, h: 1, fx: ['NOT THE DOG', 'bad'], mood: 'annoyed',
        r: `IT IS NOT FOR THE DOG. Why do you keep BRINGING UP THE DOG.` },
    ] },
  gag: { mood: 'flirty',
    say: `...And the gag. Last one. So. Who's wearing it.`,
    opts: [
      { t: `You tell me. I'm good either way.`, p: 15, fx: ['EITHER WAY', 'great'], mood: 'flirty',
        r: `Either way. "Either way," he says. Okay. Okay. Tonight's going to be interesting.` },
      { t: `You. Chat's been begging for a quiet stream.`, p: 9, fx: ['RUDE. ACCURATE.', 'good'], mood: 'happy',
        r: `Rude. Accurate. Rude. ...Fine.` },
      { t: `Me. Obviously. Look at me.`, p: 9, fx: ['BOLD', 'good'], mood: 'flirty',
        r: `...You're right. It's you. Get the good sheets.` },
      { t: `Is that one of Mochi's toys?`, p: 0, h: 1, fx: ['LONG WALK', 'bad'], mood: 'annoyed',
        r: `That's it. I'm walking him again. Alone. It's going to be a long walk.` },
    ] },
};

const MAX2 = 10 + WALK_MAX + Object.values(D2_DLG).reduce((a, d) => a + Math.max(...d.opts.map(o => o.p || 0)), 0);

/* ---------- flow ---------- */
async function startDay2() {
  reset(); S.day = 2; MAX = MAX2; drawHearts(); drawBar();
  playMusic('wake');
  await fade(true);
  go('s-wake'); hud(true); $('#clock').textContent = '';
  await fade(false);
  runWake();
}

function runWake() {
  const jas = $('#jas-wake');
  buildJas(jas); setMood(jas, 'stream', WAKE.mood);
  renderDialog($('#wake-box'), 'Jasmine', WAKE.say, WAKE.opts, async (o) => {
    addScore(o.p); setMood(jas, 'stream', o.mood);
    (o.p >= 10 ? SFX.good : o.p >= 3 ? SFX.meh : SFX.bad)();
    flash(o.fx[0], o.fx[1]);
    const dumped = o.h ? loseHeart() : false;
    renderDialog($('#wake-box'), 'Jasmine', o.r, null);
    if (dumped) return;
    await waitClick('s-wake');
    startWalk();
  });
}

function walkFactor(t) {
  if (t <= WALK_FULL) return 1;
  return Math.max(.25, 1 - .75 * (t - WALK_FULL) / (DogWalk.LIMIT - WALK_FULL));
}

async function startWalk() {
  await fade(true);
  go('s-walk'); hud(false); playMusic('walk');
  await fade(false);
  DogWalk.start($('#walkcv'), {
    tone, sfx: SFX,
    onDone: async r => {
      if (!r.win) {
        return failDay2('Mochi Wins.', `Three minutes, <b style="color:#ffd166">${r.score}</b> of 25, and a Jack Russell
          who is somehow still not tired. He walked you home, looked at you, and went straight back to the door.`);
      }
      const pts = Math.round(WALK_MAX * walkFactor(r.elapsed));
      addScore(pts);
      afterWalk(pts, r);
    }
  });
}

async function afterWalk(pts, r) {
  await fade(true);
  go('s-wake'); hud(true); playMusic('wake');
  const fast = r.elapsed <= WALK_FULL, d = fast ? AFTER_WALK.fast : AFTER_WALK.slow;
  const jas = $('#jas-wake'); setMood(jas, 'stream', d.mood);
  renderDialog($('#wake-box'), 'Jasmine',
    `<b style="color:#ffd166">+${pts} RIZZ</b> &nbsp;${d.say}`, null);
  await fade(false);
  flash(fast ? 'SPEEDRUN' : 'GOOD BOY', 'great'); SFX.good();
  await waitClick('s-wake');
  startHunt(HUNT_D2);
}

/* the per-item dialogue overlay on top of the hunt; the clock is frozen while it's up */
function itemTalk(id) {
  const d = D2_DLG[id];
  pauseHunt();
  clearTimeout(sayTimer);
  $('.huntsay').classList.add('gone'); $('#huntface').classList.add('gone');
  const ov = $('#hunt-dlg'); ov.classList.add('on');
  const jas = $('#jas-hunt'); buildJas(jas); setMood(jas, 'stream', d.mood);
  return new Promise(res => {
    renderDialog($('#hunt-box'), 'Jasmine', d.say, d.opts, async (o) => {
      if (o.end) { SFX.bad(); ov.classList.remove('on'); return failDay2('Game Over', o.end); }
      addScore(o.p); setMood(jas, 'stream', o.mood); flash(o.fx[0], o.fx[1]);
      (o.p >= 9 ? SFX.good : o.p >= 3 ? SFX.meh : SFX.bad)();
      const dumped = o.h ? loseHeart() : false;
      renderDialog($('#hunt-box'), 'Jasmine', o.r, null);
      if (dumped) return;
      await waitClick('hunt-dlg');
      ov.classList.remove('on');
      resumeHunt();
      res();
    });
  });
}

const HUNT_D2 = {
  rooms: ROOMS_D2, items: ITEMS_D2, music: 'ready',
  speedPts: 0,                       // the walk is Day 2's speed test; the dialogues are the points
  intro: `Four things. Two minutes. And I want to hear the plan for each one.`, introMood: 'flirty',
  onFound: async (id, left) => {
    await itemTalk(id);
    if (!S.huntOver && left > 0) say(D2_LEFT[left] || `Keep going.`, 'flirty', 'good');
  },
  verdict: t => [t < 40 ? `That was quick. Okay. Lock the door.`
               : t < 85 ? `Good. That's everything. Lock the door.`
               : `Took you long enough. Lock the door.`, 'flirty'],
  onDone: () => finishDay2(),
  timeUpLine: `...Two minutes. That was the deal. Mochi and I are going back to bed.`,
  onTimeUp: (missing, n, N) => failDay2('Time.', `Two minutes, and <b style="color:#ff99a0">${N - n}</b> still hidden
    &mdash; no ${missing.join(', no ')}.<br><br>She found them herself, put every one of them back where it was,
    and took Mochi out for a very long second walk.`),
};

async function finishDay2() {
  if (pct() < GOAL) {
    return failDay2('Goodnight!', `A nice day. A genuinely nice day. She kissed you on the forehead, said
      "get some sleep," and closed the bedroom door. From the other side.`);
  }
  await winSequence(true);
}

function day2Dumped() {
  failDay2('She Left.', `Three strikes on a day off. She took the dog, the good sheets, and the car.
    You got the squeaky door.`);
}

/* every Day 2 failure: restart the day, or bail to the title */
async function failDay2(title, reason) {
  abortHunt(); clearCut(); DogWalk.stop();
  await fade(true); SFX.lose();
  await showEnd(`<div class="bigfail">${title}</div>
    <div class="endnote" style="font-size:18px;color:#c9c9d6;margin-top:24px">${reason}</div>
    <div class="scoreline">Day 2 Rizz</div><div class="scorenum">${pct()}%</div>
    <div class="endbtns">
      <button class="btn" id="retryBtn">Try Again</button>
      <button class="btn ghost" id="quitBtn" style="font-size:16px;padding:13px 22px">Give Up</button>
    </div>${OUTRO}`, false);
  $('#retryBtn').onclick = () => { SFX.click(); startDay2(); };
  $('#quitBtn').onclick = async () => {
    SFX.click(); await fade(true);
    go('s-title'); hud(false); reset(); drawHearts(); drawBar();
    playMusic('title'); await fade(false);
  };
}
