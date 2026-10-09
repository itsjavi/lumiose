# Composing for Dotmatrix

How to write music, sound effects and creature voices ("cries") for the Game Boy sound chip, in
the Dotmatrix app and in the sound-driver format its code view shows. Every example here was
written for this guide or for Dotmatrix; none comes from a game.

- [The four channels](#the-four-channels)
- [Time: frames, steps and tempo](#time-frames-steps-and-tempo)
- [The driver format](#the-driver-format)
- [Music](#music)
- [Sound effects](#sound-effects)
- [Creature voices](#creature-voices)
- [Editing, pasting and importing code](#editing-pasting-and-importing-code)
- [Songs as code](#songs-as-code)
- [Checklist](#checklist)

## The four channels

| Channel | Sound                    | Controls                                                   | Good for                        |
| ------- | ------------------------ | ---------------------------------------------------------- | ------------------------------- |
| Pulse 1 | Square wave              | Duty cycle, envelope, frequency, **hardware pitch sweep**  | Leads, jumps, lasers, cries     |
| Pulse 2 | Square wave              | Duty cycle, envelope, frequency                            | Harmony, echoes, the cry's twin |
| Wave    | A 32-sample, 4-bit table | Table, output level (100/50/25 %), frequency               | Bass, pads, flutes              |
| Noise   | Pseudo-random hiss       | Envelope, clock (bright to dark), 15/7-bit mode (metallic) | Drums, hits, doors, breath      |

Every channel plays one note at a time. Chords come from spreading notes over channels, from fast
arpeggios, or from not needing them.

## Time: frames, steps and tempo

- The hardware runs at 4,194,304 cycles per second. The sound driver wakes once per video frame:
  70,224 cycles, about **59.7 times a second**. Everything that moves inside a note (vibrato,
  slides, duty patterns, arpeggios) changes on frames.
- **Songs** in the studio use 16th-note **steps** at a **BPM**: one step is 15 / BPM seconds, so
  120 BPM gives 125 ms steps (about 7.5 frames). A bar is 16 steps.
- **Sound sheets** (an SFX or voice opened in the studio) use **frames per step** instead: 1 to 4
  frames, and they play once.
- In the driver format, lengths are in frames. The original drivers also had a tempo that scales
  note lengths (256 = as written, 512 = twice as long); Dotmatrix's creature **length** slider is
  that tempo (100 % = $0100).

## The driver format

Press **Show code** in the SFX or Creatures maker to see a sound in this format. One block per
channel, ending with `sound_ret`:

```asm
; pulse 1
  duty_cycle 1                        ; 25%
  square_note 4, 12, 2, $7C1          ; frames, volume, fade, frequency
  duty_cycle_pattern 3, 3, 1, 1       ; four duties, one per frame, repeating
  square_note 6, 14, 1, $7A0          ; slides -9/frame (Dotmatrix)
  square_note 2, 0, 0, 0              ; rest
  sound_ret
; noise
  noise_note 3, 11, 1, $32            ; frames, volume, fade, noise setting
  sound_ret
```

| Command                         | Meaning                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `square_note f, v, fade, freq`  | Play `f` frames at volume `v` (0–15) with an envelope, at an 11-bit frequency register.                    |
| `noise_note f, v, fade, poly`   | Same for noise; `poly` is the noise setting below.                                                         |
| `duty_cycle d`                  | 0 = 12.5 % (thin, nasal), 1 = 25 % (reedy), 2 = 50 % (round, hollow), 3 = 75 % (sounds like 25 %, darker). |
| `duty_cycle_pattern a, b, c, d` | Rotate through four duties, one per frame: a raspy, "voiced" timbre.                                       |
| `pitch_sweep pace, ±shift`      | Pulse 1 hardware sweep: every `pace`/128 s the frequency moves by itself/2^shift; `-` falls.               |
| `; slides ±n/frame (Dotmatrix)` | A Dotmatrix extension: the driver moves the frequency register `n` units every frame without retriggering. |

**Fade.** 0 holds the volume. 1–7 fades out, 1 fastest (one step every 1/64 s) to 7 slowest. 9–15
fades in, 9 fastest. Volume 0 with fade 0 is a rest: the channel goes silent.

**Frequency registers.** A pulse plays 131072 / (2048 − x) Hz; the wave channel plays half that.
The register is linear in _period_, not in pitch: near the top (x close to 2047) one unit is a big
jump, near the bottom a tiny one. Some reference values (pulse, computed from the formula):

| Note | Hz    | x (hex) |     | Note | Hz     | x (hex) |
| ---- | ----- | ------- | --- | ---- | ------ | ------- |
| C3   | 130.8 | $416    |     | C5   | 523.3  | $706    |
| C4   | 261.6 | $60B    |     | A5   | 880.0  | $76B    |
| A4   | 440.0 | $6D6    |     | C6   | 1046.5 | $783    |

**Noise setting** (`poly`): high nibble = clock shift (0 bright … 13 dark), bit 3 = 7-bit mode
(metallic, almost tonal), low 3 bits = divisor (0–7, small is brighter). `$01` is a bright hiss,
`$45` a mid crunch, `$67` a dark rumble, `$19` a metallic ring.

**Wave tables** are 16 bytes, two 4-bit samples each (high nibble first). Dotmatrix computes its
own: sine, triangle, saw, square, organ (a few harmonics) and hollow (odd harmonics).

## Music

In the **studio**: pick a channel, pick a preset, click the grid. The key and scale choose the
rows, so every note fits; Chromatic shows every semitone.

**Roles that work on this chip**

- Pulse 1: the melody. 50 % for bold, 25 % for mellow, 12.5 % to cut through a busy mix.
- Pulse 2: harmony a third or sixth below, broken chords, short off-beat stabs, or an **echo**: the
  melody delayed by an eighth note at half volume ("Rival Clash" does this).
- Wave: bass. A soft sine bass at full level for calm songs, a saw bass in eighths or sixteenths
  for drive, a half-level pad with slow vibrato for night themes.
- Noise: a drum kit. Kick on beats 1 and 3, snare on 2 and 4, hats on eighths; fills before the
  loop point.

**Instrument tricks** (the studio's Fine-tune drawer)

- **Envelope**: fades make plucks and bells, swells make brass. A held lead (fade 0) sounds like
  an organ; a slight fade (1–2) sounds more alive.
- **Vibrato** after a delay of 10–20 frames, depth 2–3: short notes stay clean, long notes sing.
- **Glide**: touching notes slide into each other over a few frames.
- **Arpeggio**: one note plays a chord, cycling every frame (major, minor, fifth, octave).
- **Shimmer**: a duty pattern on a melody gives a chorus-like edge.
- **Note length**: Legato for leads, Normal for most parts, Short for stabs and staccato bass.

**Form.** Game music loops. Put a one- or two-bar **intro** before the loop bar ("Loop from here")
and make the end of the loop lead back into its start: the last bar of "Over the Ridge" climbs to
the note the loop begins on. Eight to sixteen bars at 100–170 BPM give the 20–60 second loops most
games used.

**An original example**, in the notation the demo songs use (`src/model/notation.ts`; lengths in
16th steps, `.` rests, `_` ties):

```ts
// A four-bar fanfare in G major
const lead = melody("G4:2 B4 D5 G5:6 .:4 | F#5:4 E5 D5:8 | E5:2 F#5 G5 A5:6 B5:4 | G5:12 .:4 |");
const bass = melody(chords("G D C G", "1:4 5, 1 5,", 2));
const kit = drums("K:4 H S H | K:4 H S H | K:4 H S H | K:2 S S S C:8 |");
```

## Sound effects

A sound effect is a handful of `square_note`/`noise_note` steps, usually 5–40 frames in all. Start
from a pad in **SFX**, bend it with Pitch, Length, Sweep, Duty and Noise tone, then **Open in
studio** to edit it note by note.

**Recipes** (all original)

| Sound     | Recipe                                                                              |
| --------- | ----------------------------------------------------------------------------------- |
| Menu blip | Two square notes, 2–4 frames, the second higher and fading: confirmation.           |
| Cancel    | The blip turned around: lower second note, softer.                                  |
| Jump      | One 50 % note, 12–20 frames, with a rising `pitch_sweep` (pace 2, shift 3–4).       |
| Laser     | 12.5 % duty, high start, a fast falling sweep, fade 2–3.                            |
| Hit       | A 75 % note sweeping down plus 1–2 bright noise notes ($1x–$2x) that fade fast.     |
| Explosion | Noise only: a loud bright frame, then a long dark noise ($5x–$7x) with a slow fade. |
| Door      | Noise notes stepping from bright to dark, the last one fading.                      |
| Pickup    | Three quick rising notes and a ringing tail (fade 4–5).                             |
| Heal      | A fast rising arpeggio on pulse 1 and the same, delayed and quieter, on pulse 2.    |
| Error     | A low 75 % buzz, a short rest, the buzz again.                                      |

```asm
; An original "laser"
; pulse 1
  duty_cycle 0                        ; 12.5%
  pitch_sweep 1, -3
  square_note 14, 13, 3, $7D0
  sound_ret
```

Keep effects short; a menu sound longer than about 150 ms feels slow. Export WAV from the maker.

## Creature voices

A cry is one gesture, not a tune. The original games stored a few dozen **base cries** and gave
each creature a base cry plus two numbers:

- **pitch**: added to _every_ square note's frequency register. Because registers are linear in
  period, the same offset raises low notes a little and high notes a lot, which bends the whole
  contour, not just transposes it.
- **length**: a tempo for the square notes ($0100 = as written, $0080 = half, $0200 = double).
  Noise keeps its own timing.

**What makes a cry sound like a creature (and not a ringtone)**

1. **Glide in small register steps.** Successive notes move by a few to a few dozen register
   units, often by 0 (the same frequency retriggered), rarely by a musical interval. Dotmatrix
   also lets a note slide every frame (`slide`).
2. **Rotate the duty every frame** with a duty cycle pattern (`3,3,0,0`, `0,0,2,2`, `2,1,2,1` …)
   for a rasp or a voice. A fixed duty sounds like a beeper.
3. **Short notes, uneven lengths**: 1–9 frames, the last one longer.
4. **Envelopes that fade inside each note**, loud attacks (volume 12–15), and swells for breaths
   and moans. Alternating loud and soft 1-frame notes makes a growl or a flutter.
5. **A detuned twin on pulse 2**: the same contour a frame or two late, a few to a few dozen
   register units off, quieter, maybe with another duty pattern. The two beat against each other.
6. **A layer of noise**: a bright tick on the attack, a breath under a moan, a long dark rumble
   under a roar.
7. **Total length** about 0.3–1 second.

**Archetypes** (the Dotmatrix creatures)

| Creature    | Base voice | Gesture                                                                            |
| ----------- | ---------- | ---------------------------------------------------------------------------------- |
| Pipsqueak   | Squeak     | Two tiny upward squeaks, high and thin (duty 25 %/12.5 % pattern).                 |
| Chirrup     | Warble     | 1-frame notes alternating ±40 units: a trill, then a settling note.                |
| Zapling     | Crackle    | Buzzing 75/12.5 % pattern jumping up and down over bright on/off noise.            |
| Wispet      | Moan       | Swells in from silence, sags slowly; the twin is 5 units off for a slow beat.      |
| Bubbloon    | Blub       | Short notes that each slide up fast, with gaps: bubbles.                           |
| Gearbot     | Servo      | Deliberately stepped jumps of 128 units, grinding pattern, ticking noise.          |
| Mossling    | Yawn       | A slow rise, a held sigh and a breath of noise.                                    |
| Emberkit    | Yip        | Two barks: loud/soft 1-frame alternation, then a fast drop.                        |
| Boulderback | Rumble     | Very low registers, long notes, dark noise underneath.                             |
| Glaciore    | Glint      | A glassy 12.5 % shiver, a rising glide, a metallic ring in the noise.              |
| Lumoth      | Flutter    | Loud/soft every two frames (wing beats) drifting upward.                           |
| Stormaw     | Roar       | A rough 75/12.5 % bellow over a long crash.                                        |
| Snoozle     | Snore      | Noise swells in (inhale), a low grumble, noise fades out (exhale).                 |
| Hoppit      | Boing      | Three springy hops: each note slides up fast, then down, a little lower each time. |
| Hissket     | Hiss       | A long bright hiss over a faint tone, then a rattle of 1-frame noise ticks.        |
| Honkle      | Honk       | Two nasal honks (12.5/25 % pattern) that dip and rise, the twin 60 units off.      |
| Purrl       | Purr       | A low loud/soft tremolo every frame with a pulsing dark rumble.                    |
| Shrillwing  | Screech    | A piercing high attack that wavers ±16 units and falls away.                       |
| Glorpo      | Gloop      | Low slides that swing up and down (a wobble), then a dark pop.                     |
| Diggle      | Dig        | Scratchy noise bursts with short, low, falling grunts in between.                  |

**An original cry, in the format**: the start of Emberkit's bark (its own base voice, pitch $0018,
length $00E6):

```asm
; base voice "Yip", pitch $0018, length $00E6
; pulse 1
  duty_cycle 3                        ; 75%
  square_note 1, 15, 0, $76E          ; loud
  square_note 1, 8, 0, $766           ; soft: the rasp
  square_note 1, 15, 0, $75A
  square_note 1, 8, 0, $750
  duty_cycle_pattern 3, 2, 3, 2
  square_note 2, 14, 1, $742          ; slides -22/frame (Dotmatrix)
  square_note 3, 10, 2, $70E          ; slides -20/frame (Dotmatrix)
  ...
```

**In the app**: pick a creature in **Creatures**, try another base voice, move Pitch and Length, or
press **Surprise me**. **Open in studio** puts the voice on a frame grid: notes keep their own
volume, fade, duty, duty pattern, slide and tuning (shown by a notch), and "Save to My voices"
brings it back. Adding studio-only features (vibrato, glide, arpeggio, shimmer, short notes, the
wave channel) keeps it a sheet: it still plays and exports, and the maker tells you why its sliders
are off.

**Making creatures distinct**: give each a different gesture first (squeak, trill, moan, bark,
rumble…), then a different register range, then a different duty pattern and noise layer. Pitch
and length variants of one base voice sound like a family: use them for creatures that are related.

## Editing, pasting and importing code

In **SFX** or **Creatures**, **Show code** shows a sound as driver code. **Copy code** puts it on
the clipboard and **Export code** downloads it as an `.asm` file named after the sound, for any
sound, built-in or saved. Built-in sounds are read-only, a learning view: press **Copy to My
sounds** (or **My voices**) to get your own copy. On a saved sound:

- **Edit code** opens its code in an editor. Change numbers, add or remove lines, then **Play
  code**: it plays at once and its waveform appears.
- **Paste code** starts from an empty editor: paste code from this guide, a text file or a friend.
- **Import file…** reads a `.txt` or `.asm` file, names the sound after the file and plays it.
- **Save** writes the code over the saved sound, under the name you give it. The sliders, Open in
  studio and Export WAV all work on it.

The editor reads everything the code view writes:

| Line                                       | Read as                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `; pulse 1`, `; pulse 2`, `; noise`        | Starts a channel section (each at most once). Required before any note. |
| `duty_cycle 0–3`                           | The duty for the following square notes.                                |
| `duty_cycle_pattern a, b, c, d`            | A duty pattern for the following square notes (replaces `duty_cycle`).  |
| `pitch_sweep pace, ±shift`                 | Pulse 1 only; the sweeps Dotmatrix can play are listed if one is not.   |
| `square_note frames, volume, fade, freq`   | Frames 1–255, volume 0–15 (0 is a rest), fade 0–15, register 0–2047.    |
| `noise_note frames, volume, fade, setting` | The same for noise, with a noise setting 0–255.                         |
| `; slides -12/frame` after a square note   | That note's per-frame slide (Dotmatrix's extension).                    |
| `sound_ret`                                | Ends the section; anything after it needs a new section line.           |
| `; base voice "…", pitch …, length …`      | A creature's header: a comment, kept for reading.                       |

Numbers are decimal (`12`) or hex (`$0C`); everything else after `;` is a comment. Mistakes are
listed by line, such as `Line 3: Unknown command “sqare_note”` or `Line 4: The volume must be 0–15,
found 16`; click one to select that line. A sound can be up to 600 frames (10 s) long.

An original example to paste:

```asm
; pulse 1
  duty_cycle_pattern 0, 0, 3, 3
  square_note 3, 15, 1, $7C6  ; slides -12/frame
  square_note 12, 12, 3, $7A0
  sound_ret
; noise
  noise_note 4, 9, 2, $11
  sound_ret
```

Every built-in sound effect and creature voice exports to code and imports back identically:
`src/model/code.test.ts` checks that the register writes match.

## Songs as code

In the **Studio**, the screen has a **Grid | Code** switch. **Code** shows what is open as driver
code: a sound sheet in the format above, a song as music macros. Edit it, paste over it or
**Import file…**, then **Apply** (or Ctrl/⌘ Enter): the song is replaced as one step that Undo
reverts. **Copy code** and **Export code** take what the editor shows; an exported `.asm` file
imports back as the identical song or sound (`src/model/codefile.test.ts` checks every demo song,
sound effect and voice). Errors are listed by line, as in the makers. While the code has no edits of its own it
follows the grid; **Revert** drops your edits.

A song starts with a header, then one section per channel:

```asm
; Dotmatrix song: music macros, one section per channel
song_title "Little March"
song_author "you"
tempo 112  ; quarter notes per minute
bars 2
key G, major
; pulse 1
  instrument hero                 ; the preset it starts from
  note_type 1, 11, 7              ; step unit, volume, fade
  duty_cycle 2
  vibrato 14, 3, 3                ; delay (frames), depth, rate
  pitch_glide 0
  arpeggio off
  shimmer off
  note_length normal              ; legato, normal or short
  stereo_panning center
.mainloop:                        ; the loop starts here (a bar line)
  octave 4
  note G_, 4                      ; note name and length in steps
  note B_, 4
  octave 5
  note D_, 8
  note C_, 4
  octave 4
  note B_, 4
  note A_, 8
  sound_loop 0, .mainloop
; noise
  instrument kit
  note_type 1, 10, 0
  drum_tone 0
  stereo_panning center
.mainloop:
  drum_note 7, 1  ; Kick
  rest 3
  drum_note 6, 1  ; Snare
  rest 27
  sound_loop 0, .mainloop
```

| Line                                                                                                                                      | Meaning                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `song_title`, `song_author`                                                                                                               | Text in quotes.                                                                                                          |
| `tempo n`                                                                                                                                 | Quarter notes per minute, 50–240 (a step is a 16th note).                                                                |
| `bars n`, `key K, scale`                                                                                                                  | Length (1–32 bars); key (C … B) and scale (major, minor, harmonicMinor, dorian, pentatonic, minorPentatonic, chromatic). |
| `; pulse 1` … `; noise`                                                                                                                   | A channel section. Missing channels are silent.                                                                          |
| `instrument id`                                                                                                                           | Start from a preset (`hero`, `reed`, `round`, `kit`…), then change it below.                                             |
| `note_type unit, volume, fade`                                                                                                            | Steps per length unit (1 = a 16th), the start volume and the fade.                                                       |
| `duty_cycle`, `vibrato`, `pitch_glide`, `arpeggio`, `shimmer`, `note_length`, `wave_shape`, `drum_tone`, `stereo_panning`, `mute`, `solo` | The instrument and mixer settings of the Fine-tune drawer and channel cards.                                             |
| `octave n`, `note C_ … B_, length`                                                                                                        | Notes (`C#`, `D_` … `B_`), length in units.                                                                              |
| `rest length`                                                                                                                             | Silence.                                                                                                                 |
| `drum_note n, length`                                                                                                                     | Noise channel: drum 0–7 (crash, open hat, hi-hat, shaker, high tom, low tom, snare, kick).                               |
| `.mainloop:` … `sound_loop 0, .mainloop`                                                                                                  | The loop: the label sits on the bar the song loops back to.                                                              |

Every demo song exports to code and reads back as the identical song with identical register
writes (`src/model/songcode.test.ts`).

## Checklist

- Music: one idea per channel, an intro and a loop point, nothing louder than the lead.
- SFX: short, with a clear attack; check it next to the music.
- Cries: a gesture, not a melody; small register steps and slides; a duty pattern; a detuned twin;
  noise underneath; under a second.
- Listen at low volume and on a phone speaker: the chip's charm is in the mids.
