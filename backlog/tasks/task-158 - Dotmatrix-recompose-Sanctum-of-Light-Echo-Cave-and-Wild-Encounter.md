---
id: TASK-158
title: 'Dotmatrix: recompose Sanctum of Light, Echo Cave and Wild Encounter'
status: Done
assignee:
  - Chime
created_date: '2026-10-09 10:24'
updated_date: '2026-10-09 10:38'
labels:
  - samples
  - audio
milestone: m-6
dependencies: []
priority: medium
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09 after listening: these three don't sound good melodically as compositions. Recompose them (keep titles and moods) with clear motifs, phrase structure and functional harmony.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The three songs are rewritten: 4/8-bar phrases (antecedent/consequent or AABA), a memorable motif repeated and varied, chord progression with cadences, melody on chord tones on strong beats and steps/passing tones between, singable range, bass on roots/fifths with movement, harmony line in thirds/sixths or a counter-melody, drums supporting the groove
- [x] #2 A composition-check unit test (heuristics: strong-beat chord-tone ratio, step vs leap ratio, max leap, range, minor-2nd clashes between channels on strong beats, phrase/cadence on the tonic) runs over every demo song, and these three pass it; other songs that fail are reported to Lux
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chime (2026-10-09): done.
Recomposed harmony-first, 4-bar question/answer phrases, one motif stated/repeated/varied, chord tones on beats 1 and 3, steps with passing tones, a clear high point per phrase, last note on the tonic:
- Sanctum of Light (D major, 80 BPM, 2-bar harp intro + 16-bar loop): I-IV-vi-V | I-IV-V-I | vi-IV-II(E major, the Lydian G#)-V | IV-I-V-I; motif dotted quarter + eighth + half; Pulse 2 a third below; organ bass root-fifth-root; sparse shaker, crash at phrase starts.
- Echo Cave (A harmonic minor, 92 BPM, 1-bar intro + 16-bar loop): i-VI-III-VII | i-VI-V-V (half cadence) | iv-i-bII(Bb, Phrygian)-V | i-VI-V-i; low 25% motif (quarter, two eighths, half); Pulse 2 off-beat high chord-tone drips; bass root/octave/fifth; spacious shaker + low tom.
- Wild Encounter (E minor, 168 BPM, 1-bar intro + 16-bar loop): i-bVI-bVII-i | i-bVI-bVII-V | iv-i-bVI-bVII | i-bVI-V-i; driving motif (two eighths climbing to a chord tone), inverted in phrase 3; Pulse 2 a third below (bass-aware); root/octave eighth bass; rock beat with fills.
notation.thirdsBelow gained a bass line: a harmony note that would grate (m2/tritone/M7) on the bass takes the other third, a fourth or a sixth.
Composition check (model/composition.ts + composition.test.ts): strong-beat chord tones >= 75%, steps >= 50% of lead intervals, max leap <= 12, range <= 19, <= 2 minor-second clashes on beats (lead vs Pulse 2/bass), last lead note on the tonic. The three new songs and First Steps pass; songs written before the check are listed as known (skipped, with their failures in the test name) and a test keeps that list honest.
Results (all songs):
Maple {"strongChordTones":0.94,"steps":0.55,"maxLeap":8,"range":14,"clashes":1,"endsOnTonic":false} the lead does not end on the tonic
Over Ridge {"strongChordTones":0.75,"steps":0.57,"maxLeap":8,"range":17,"clashes":2,"endsOnTonic":false} the lead does not end on the tonic
Rival {"strongChordTones":0.83,"steps":0.49,"maxLeap":14,"range":20,"clashes":11,"endsOnTonic":false} steps 49% of intervals (want ≥ 50%); a leap of 14 semitones (want ≤ 12); a range of 20 semitones (want ≤ 19); 11 minor-second clashes on beats (want ≤ 2); the lead does not end on the tonic
Wild {"strongChordTones":1,"steps":0.7,"maxLeap":7,"range":17,"clashes":0,"endsOnTonic":true}
Last {"strongChordTones":0.97,"steps":0.5,"maxLeap":8,"range":20,"clashes":3,"endsOnTonic":false} a range of 20 semitones (want ≤ 19); 3 minor-second clashes on beats (want ≤ 2); the lead does not end on the tonic
Lantern {"strongChordTones":0.69,"steps":0.52,"maxLeap":4,"range":15,"clashes":3,"endsOnTonic":false} strong-beat chord tones 69% (want ≥ 75%); 3 minor-second clashes on beats (want ≤ 2); the lead does not end on the tonic
Sanctum Light {"strongChordTones":1,"steps":0.82,"maxLeap":5,"range":17,"clashes":0,"endsOnTonic":true}
Echo {"strongChordTones":1,"steps":0.63,"maxLeap":7,"range":12,"clashes":0,"endsOnTonic":true}
Bumbling {"strongChordTones":0.91,"steps":0.64,"maxLeap":14,"range":21,"clashes":1,"endsOnTonic":true} a leap of 14 semitones (want ≤ 12); a range of 21 semitones (want ≤ 19)
Faded {"strongChordTones":0.75,"steps":0.59,"maxLeap":7,"range":10,"clashes":1,"endsOnTonic":false} the lead does not end on the tonic
Roll Credits {"strongChordTones":1,"steps":0.45,"maxLeap":5,"range":15,"clashes":0,"endsOnTonic":true} steps 45% of intervals (want ≥ 50%)
First {"strongChordTones":0.75,"steps":0.55,"maxLeap":4,"range":9,"clashes":0,"endsOnTonic":true}
Validation: lumen check, fmt, lint clean; Vitest 146 passed + 8 known skipped; Playwright 50/50 (dev + preview). No UI change, so no screenshots.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sanctum of Light, Echo Cave and Wild Encounter recomposed with phrases, motifs, functional harmony and cadences; a composition-check test over every demo, which the three pass; eight older songs fail it and are reported. Vitest 146 (+8 known skipped), Playwright 50.
<!-- SECTION:FINAL_SUMMARY:END -->
