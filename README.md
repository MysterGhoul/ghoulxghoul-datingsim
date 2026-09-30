# Mission: GhoulxGhoul Gets Laid

A browser dating sim. One HTML file, three JS files (`game.js` engine + Day 1, `day2.js`, `walk.js` mini game), an assets folder. No build step, no server code —
upload the folder to any static host and it works.

**Run it locally** (you can't just double-click `index.html`; browsers block local file loading):

```bash
cd "C:\Users\MysterGhoul\Documents\GhoulxGhoulGame" && python -m http.server 8777
```

Then open <http://127.0.0.1:8777>.

---

## The game

**1 · Intro** — Goth day, twenty minutes to live, nothing can be found. Three answers;
"Find them yourself" is an instant loss.

**2 · The hunt** — **2:00 on the clock, counting down.** Five things to find across **three rooms**
(living room / bedroom / kitchen) — black wig, selfie stick, charging cable, stream phone, portable
battery. Switch rooms with the buttons bottom-right or the ← → arrow keys.

- **Decoys** are scattered around — mug, TV remote, hairbrush, headset. Clicking one gets you a
  "that's not what we need" line and the item stays put. **No penalty**, it's just a joke.
- **Speed is scored.** Everything found inside 40s = the full 32 points, decaying to 25% at 0:00.
- **If the clock hits 0:00 with anything still missing, you lose.** Game over, back to the title.

**3 · Cutscene** — the real stream clip (the "you looked at my girlfriend wrong" duel) plays
full-screen 16:9 with narration over the top. Skippable.

**4 · Sushi date** — order from the menu, then ten dialog beats.

**5 · Day 1 payoff** — fade to black → hub-intro sting → `"You win, big boy."` → fade →
**DAY 2 UNLOCKED** + Continue. (Also drops a "Skip to Day 2" button on the title from then on.)

## Day 2 — the day off

Its own 100-point rizz bar, 70% to win, three hearts.

**6 · Waking up** — Mochi's on your chest. What are we doing today? (10 pts)

**7 · Mochi's Walk** — top-down pixel mini game. WASD moves the two of you, **Space** jumps the
whole party. Tennis balls +1, fire hydrants +3 (everyone waits 2s while Mochi pees), open
sewers −1 unless you jump. **1:00 on the clock, 30 points to clear.** Faster = more bar (32 max).

**8 · The second hunt** — same three rooms, four new things: lotion, baby oil, a riding crop
and a ball gag. **Finding one freezes the clock and opens a "so what's the plan" dialogue** —
Day 1 rules: a best answer, a good one, one that costs a heart, and one obvious trap (the door hinge).
58 points across the four.

**9 · The finale** — sting → `"You win, big boy."` → Yamete Kudasai → **YOU WIN** + confetti.

Any Day 2 failure (walk timed out, hunt timed out, out of hearts, under 70%) offers
**Try Again** (restarts Day 2) or **Give Up** (title).

### Scoring — the RIZZ METER

100 points, **70 needed to win**. The bar shows your fill but not the target, so you don't know
whether you've cleared it until the end.

| Source | Max |
|---|---|
| Intro answer | 10 |
| The hunt (speed-scaled) | 32 |
| Sushi order | 14 |
| 10 dialog beats | 44 |

Sushi ranking: **Sweetheart Roll 14 → Spicy Tuna 10 → Spicy Salmon 6 → Dragon Roll 2.**

### Losing

- **3 hearts.** About half the date questions have one answer that costs a heart. Zero = "She Left."
- **3 instant-loss traps**, all obvious: telling her to find the gear herself, comparing her to your
  mother, and suggesting ramen after she says "or."
- **Running the hunt clock out.**
- **Under 70% at the end** = the "Goodnight!" ending.

---

## Assets

```
assets/
  bg/      bg_title, bg_room, bg_bedroom, bg_kitchen, bg_stream, bg_sushi   (.jpg)
  jasmine/ stream_{neutral,happy,annoyed,flirty,sleepy}.webp   <- white shirt, intro, day 2
           date_{neutral,happy,annoyed,flirty}.png     <- black dress, the date
  obj/     wig, battery, cable, mug, brush, headset, remote,
           lotion, oil, crop, gag                          (.png, cut out)
  clip/    stream.mp4      <- the 16:9 stream clip, 21.5s
  music/   title, getready, sushi, wake, walk (.mp3)   <- seamless loops
  sfx/     win1_hub.mp3, win2_yamete.mp3
```

Jasmine's sprites were cut out of the white-backdrop shoot with `rembg`. To swap one, drop a
replacement PNG with the same filename — transparent background, portrait, ~800×1100.

**Two item sprites are still hand-drawn vector**, not photos: the **selfie stick** and the
**stream phone**. There is no usable public-domain product photo of either — everything findable was
either a scene photo or share-alike licensed. Easiest fix: shoot the real ones against the same white
sheet from the photo session and I'll cut them out to match the others exactly.

---

## Music

Three CC0 loops, one per scene, crossfaded between scenes and mixed low (`MUS_VOL = 0.16`).
Each was rebuilt as a **seamless loop** (the tail is crossfaded into the head) so it doesn't click
on repeat. The ♪ button bottom-right mutes.

**`_music_options/index.html`** is an audition page with alternates for every scene — all CC0,
all pre-looped and pre-levelled so what you hear is what you get. Pick one per scene and I'll swap
them in. That folder is just for choosing; delete it before you upload the game.

---

## Editing the writing

Everything is plain data at the top of `game.js`:

- `INTRO` — the opening question
- `ITEMS` / `DECOYS` / `ROOMS` — what to find, the joke items, and where everything sits
  (`x`/`y` are percentages of the screen)
- `NARR` — cutscene narration, `[milliseconds, "line"]`
- `ROLLS` — the sushi menu
- `DATE` — every question on the date

A dialog option:

```js
{ t: `What you say`, p: 4, fx: ['SMOOTH', 'good'], mood: 'happy',
  r: `What she says back` }
```

`p` = points · `h: 1` costs a heart · `end: '...'` is an instant Game Over · `mood` picks the photo ·
`fx` is the flash word (`great` gold, `good` green, `meh` grey, `bad` red). `MAX` recalculates
itself, so add or remove questions freely.

Tuning knobs: `GOAL` (70), `HUNT_LIMIT` (120s), `HUNT_FULL` (40s for full marks), `HUNT_MAX` (32).

---

## Licensing

Everything ships clean for a commercial site.

**Backgrounds** — all public domain / CC0:

| File | Source |
|---|---|
| `bg_title` | "Pedestrians Walking on Neon Lit Urban City", Flickr · CC0 |
| `bg_room` | "Modern living room apartment", Flickr · Public Domain Mark |
| `bg_bedroom` | "Beautiful Bedroom in Luxury Home", Flickr · Public Domain Mark |
| `bg_kitchen` | Modern kitchen interior, rawpixel · CC0 |
| `bg_stream` | "Second Life Live Video Stream Setup", Flickr · CC0 |
| `bg_sushi` | Sushi Rama, Denver — Carol M. Highsmith, Library of Congress · public domain |

**Objects** — CC0 or CC BY (attribution only, no share-alike): power bank, cable, wig, mug,
hairbrush, headphones and remote are all cut from CC0/CC BY photos. Credit line for the CC BY ones
if you want one: *item photos via Openverse contributors, CC BY 2.0*.

**Music and SFX** — the three loops are CC0. `win1_hub` / `win2_yamete` are your own files.

**The stream clip** is your own footage.

⚠️ The clip is **unbleeped** — there's a fair amount of swearing in the duel rant. That matches the
game's tone and it's your own site, but say the word and I'll bleep it.
