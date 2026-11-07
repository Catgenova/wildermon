Female low-poly arm and hand. Reference: tools/sculpt/ref/arm-lowpoly-female.png ("Female Arm Reference (Stylized
Low-Poly)"); how the arm sits on the body: tools/sculpt/ref/body-female.png (the constructed full body, front view).
Built by tools/sculpt/lowarm.mjs, drawn by tools/sculpt/lowarmshot.mjs, fitted by tools/sculpt/lowafit.mjs.

What the sheet shows
- Style: stylized low-poly, flat-shaded, large planar facets, no smoothing. Matches the torso and leg style.
- Top row, one right arm (shoulder cap to fingertips) in five views: Front (0°), Three-Quarter (45°), Profile (90°),
  Rear Three-Quarter (135°), Back (180°). Orthographic; each view's angle measured off the sheet. The front view sees
  the back of the hand with the thumb on the viewer's right, the back view the palm.
- A bracket beside the front view: Upper Arm, Forearm, Hand.
- Modeling Guide: stylized low-poly arm (female); angular, faceted planes; tapered, feminine silhouette; simple hand (no
  finger detail); matches torso and leg style; game-ready topology.
- Target geometry: arm about 180–320 triangles, hand about 80–150 (about 260–470 in all).
- Regions (colour-coded arm on the right): shoulder / deltoid (grey, the cap), upper arm (bicep / tricep; light tan),
  forearm (tan), hand (pink).
- Hand Reference (Female): the hand with a short wrist stub cut flat, in five views: Back (0°), Three-Quarter (45°),
  Profile (90°), Three-Quarter (135°), Palm (180°).
- Hand Topology (Example), back and palm: a six-sided wrist; the back of the hand a wide middle plane and side planes,
  a band across above the knuckle line; the four-finger mass in four strips in two rows (the second curled under);
  the thumb in two segments. The palm: lines from the wrist across to the thumb's base, the palm's planes, the
  fingers' undersides in strips.
- Hand Details: simple, stylized hand; four-finger mass and a thumb; angular silhouette; consistent proportions; about
  4–6 sides round the wrist; slightly narrower and softer than the male hand.
- Arm Deconstruction (major forms): shoulder cap (deltoid) + upper arm (bicep / tricep) + forearm (radius / ulna mass) +
  hand (simplified).
- Arm Topology (Example), two sides of the arm laid flat: the cap a ball of facets; the upper arm in rings to the
  elbow's pinch; the forearm widest near its top, a long taper to the wrist's pinch; the hand; lines along the arm
  between the rings.
- Key Proportions (relative to head height H): upper arm 0.35–0.45 H, forearm 0.35–0.40 H, hand 0.20–0.25 H, total arm
  0.90–1.10 H.

The full body (body-female.png)
- The arm hangs from the shoulder out from the body, a slight bend at the elbow, the hand at the top of the thigh, the
  back of the hand forward and out, the thumb toward the thigh, the fingers curled in.
- Measured at 124 pixels a head unit (the shoulders' widest matched to the female torso's sd4), the chin at y 328: the
  shoulder's top about y -0.71, the elbow y -2.75, the wrist y -4.27, the fingertips y -5.36; the elbow's middle 1.65
  out from the centre line, the wrist's 1.93, the fingertips' 1.78.

Rules
- As tools/sculpt/ARM_SPEC.md: a direct mirror of the reference in every view; one closed mesh per arm, the right
  authored and mirrored; the shoulder end the female torso's arm cut taken from the torso itself (so it follows the
  torso, which is still being fitted), the cap above it drawn only alone; each view's camera fitted; landmarks shoulder
  cap top, deltoid insertion, elbow inner and outer, forearm widest, wrist, knuckle line, thumb tip, finger tip; a
  coarse lattice and the hand placed as a block; front, profile and three-quarter views win.
- Scoring, shape only, the arm and the hand separately: 10 indistinguishable at a glance; 9 only small local
  differences, landmarks within about 2% of the arm's length; 7 the same shape, visibly different in places; 5 or
  below a different arm. Wrong proportions in the front, profile or three-quarter view cap the score at 6.

Decisions
- 2026-11-07, the user's decision: the rules carry over from the low-poly heads and torsos, "same expectations and
  process as mirroring".
- 2026-11-07, the user's decision: shape is scored, not light: the whole body will be repainted. The renders use the
  heads' shared camera-fixed light; lighting is not tuned.
- 2026-11-07, the user's decision: the constructed full-body references (tools/sculpt/ref/body-female.png,
  body-male.png) decide how the arm sits on the body: its length against the head and the torso (the hand to about
  mid-thigh), the shoulder joint, how far it hangs out, the elbow's bend, the hand's turn and the arm's thickness. The
  arm sheet decides the arm's own shape and plane layout; where the two disagree on proportions between the parts, the
  full-body reference wins.
