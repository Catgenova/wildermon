Male low-poly arm and hand. Reference: tools/sculpt/ref/arm-lowpoly-male.png ("Arm Reference (Full Arm)"); how the
arm sits on the body: tools/sculpt/ref/body-male.png (the constructed full body, front view).
Built by tools/sculpt/lowarm.mjs, drawn by tools/sculpt/lowarmshot.mjs, fitted by tools/sculpt/lowafit.mjs.

What the sheet shows
- Style: stylized low-poly, flat-shaded, large planar facets, no smoothing. Matches the head and body style.
- Top row, one right arm (shoulder cap to fingertips) in five views: Front (0°), Three-Quarter (45°), Profile (90°),
  Rear Three-Quarter (135°), Back (180°). Orthographic. The labels are names, not measurements: each view's angle is
  measured off the sheet. The front view sees the back of the hand with the thumb on the viewer's right (the body's
  middle), the back view the palm.
- A bracket beside the front view splits the arm into Upper Arm (from the shoulder cap's top), Forearm and Hand.
- Modeling Guide: stylized low-poly arm; angular, faceted planes; simple hand (no finger detail); clear silhouette;
  matches the head and body style; game-ready topology.
- Target geometry: arm about 200–350 triangles, hand about 80–150 (about 280–500 in all).
- Regions (colour-coded arm on the right): shoulder / deltoid (grey, the cap), upper arm (bicep; light tan), forearm
  (tan), hand (pink).
- Hand Reference: the hand with a short wrist stub cut flat, in five views: Back (0°), Three-Quarter (45°),
  Profile (90°), Three-Quarter (135°), Palm (180°).
- Hand Topology (Example), back and palm wireframes: a six-sided wrist; the back of the hand one wide plane between two
  lines from the wrist to the knuckles, a side plane on either side; the knuckle line across; the four-finger mass in
  four strips in two rows (the second row curled under); the thumb in two segments off the index side. The palm: the
  thumb's mound one plane from the wrist to the thumb's base, the palm's planes to the knuckle line, the fingers'
  undersides in strips.
- Hand Details: simple block hand; four-finger mass and a thumb, no separate fingers; angular silhouette; consistent
  proportions; about 4–6 sides round the wrist.

The full body (body-male.png)
- The arm hangs from the shoulder out from the body, a slight bend at the elbow; the hand reaches below the crotch to the
  top of the thigh, the back of the hand turned forward and out, the thumb toward the thigh, the fingers curled in.
- Measured at 128 pixels a head unit (the shoulders' widest matched to the male torso's sd4), the chin at y 322: the
  shoulder's top about y -0.45, the elbow y -2.95, the wrist y -4.3, the fingertips y -5.7; the elbow's middle 2.1 out
  from the body's centre line, the wrist's 2.25, the fingertips' 1.95.

Rules
- A direct mirror of the reference in every view: nothing invented, nothing improved; simplified where unclear. The
  plane layout copied from the topology panels and the facet edges the views show.
- One closed mesh per arm, upper arm through hand (every edge shared by exactly two faces), the right arm authored by
  name and mirrored for the left; flat planes with the soft per-facet gradient, never smoothed across edges.
- The shoulder end is the male torso's arm cut (its ring da3 da4 da5 db5 dc5 dc4 dc3 db3, tools/sculpt/lowtorso.mjs),
  taken from the torso itself so it follows any change there: torso plus arms is one closed body. The cap above that
  ring (the deltoid's top, part 'cap') is drawn only when the arm is shown alone, as the sheet shows it; joined, the
  torso's own shoulder replaces it, as the torso's neck gives way to the head's.
- Proportions: the sheet's key proportions (upper arm 0.35–0.45 H, forearm 0.35–0.40 H, hand 0.20–0.25 H, total
  0.90–1.10 H, H the head's height) as shares of the arm; where the full-body reference disagrees on the proportions
  between the parts, or on the arm's length against the head and the torso, the full-body reference wins.
- Each view's orthographic camera fitted to its reference view (yaw, pitch and roll measured, not assumed); the hand's
  five views have cameras of their own.
- Landmarks: shoulder cap top, deltoid insertion, elbow inner and outer, forearm widest, wrist, knuckle line, thumb
  tip, finger tip.
- The fit moves a coarse lattice along the arm and places the hand as a block; vertices then one by one with polygons
  kept flat.
- Views that disagree: the front, profile and three-quarter views win over the rear three-quarter and the back.
- Scoring, shape only, the arm and the hand separately: 10 indistinguishable at a glance; 9 only small local
  differences, landmarks within about 2% of the arm's length; 7 the same shape, visibly different in places; 5 or
  below a different arm. Wrong proportions in the front, profile or three-quarter view cap the score at 6.

Decisions
- 2026-11-07, the user's decision: the rules carry over from the low-poly heads and torsos, "same expectations and
  process as mirroring".
- 2026-11-07, the user's decision: shape is scored, not light: the whole body will be repainted. The renders use the
  heads' shared camera-fixed light; lighting is not tuned.
- 2026-11-07, the user's decision: the constructed full-body references (tools/sculpt/ref/body-male.png,
  body-female.png) decide how the arm sits on the body: its length against the head and the torso (the hand to about
  mid-thigh), the shoulder joint, how far it hangs out, the elbow's bend, the hand's turn and the arm's thickness.
  The arm sheet decides the arm's own shape and plane layout; where the two disagree on proportions between the parts,
  the full-body reference wins.
