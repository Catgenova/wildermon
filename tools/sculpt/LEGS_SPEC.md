Male low-poly pelvis and legs. Reference: tools/sculpt/ref/legs-lowpoly-male.png ("Leg Reference (Male, Stylized
Low-Poly)"); the full-body reference tools/sculpt/ref/body-male.png ("the constructed body references once all parts are
done"). Built by tools/sculpt/lowlegs.mjs, drawn by tools/sculpt/lowlshot.mjs, fitted by tools/sculpt/lowlfit.mjs
(masks: tools/sculpt/lowlmask.py; cameras: tools/sculpt/lowlcam.mjs, lowlcams.json; landmarks: lowlmarks.json;
comparison sheets: tools/sculpt/lowlcomp.py).

What the sheet shows
- Style: stylized low-poly, flat-shaded, large planar facets, no smoothing. Matches the head, torso and arm style.
- Top row, both legs and the pelvis in five views: Front (0°), Three-Quarter (45°), Profile (90°, the toes to the right),
  Rear Three-Quarter (135°), Back (180°). Orthographic. The labels are names, not measurements: each view's angle is
  measured off the sheet (the three-quarter measured at about 33°, the rear three-quarter at about 230°).
- Leg (Single), multiple angles: one leg in the same five views.
- Major Forms (Side View): thigh, knee, calf, foot, marked on a profile.
- Cross-Sections (approx.): thigh 8 sides, calf 6 to 8 sides, ankle 4 to 6 sides (a hexagon long from side to side).
- Leg Planes (Front / Back): one leg in its regions: pelvis / hips (grey, the top), thigh (light tan), knee / transition
  (tan), calf (pink), foot.
- Deconstruction (major forms): pelvis / hips block, thighs, knees, calves, block feet.
- Topology (Example), five views (front, three-quarter, profile with the toes to the left, rear three-quarter, back): the
  plane layout. A row round the body under the waist: the hip line at the side, running down the groin to the pubic
  point at the front, across the buttocks at the back; the crotch under it; the thigh's top ring (at the back the
  buttock's lower fold), a mid-thigh ring, the knee's top, the kneecap one hexagonal plane, the knee's bottom, the calf's
  widest ring, a lower calf ring, the ankle, the block foot's top edge and its sole band. A line down the middle of the
  thigh's front and of the shin.
- Target geometry: about 300 to 600 triangles for both legs.
- Clothing on the sheet (a brown belt and a cream loincloth) is not body: see the decisions.

Rules
- A direct mirror of the reference in every view: nothing invented, nothing improved; simplified where unclear. The
  plane layout copied from the Topology and Leg Planes panels and the facet edges the views show; the cross-sections'
  side counts are the targets (thigh and calf 8, ankle 6).
- One mesh, half authored and mirrored, named vertices and named polygons, flat planes with the soft per-facet gradient,
  never smoothed across edges. Closed except at the waist, every edge shared by exactly two faces.
- The top is the torso's hip cut ring (bt0..bt8, tools/sculpt/lowtorso.mjs and its fitted lowtfit-male.json) exactly,
  read from the torso, so torso plus legs has no open edge at the seam, and follows the torso when it changes.
- Each view's orthographic camera fitted to its reference view; the angles measured, not assumed.
- Landmarks: hip widest, crotch, thigh widest, knee top and bottom and the kneecap, calf widest, ankle, heel, toe, the
  buttock's lowest and furthest back.
- The fit moves the rows as wholes (each ring's height, width and depth, as the topology panel draws the rows) and places
  vertices by hand; vertices are never all moved freely (that crumples the shapes); polygons are kept flat.
- Views that disagree: the front, profile and three-quarter views win; then the back and the rear three-quarter; the
  topology panel's small views last.
- Scoring, shape only: 10 indistinguishable at a glance; 9 only small local differences, landmarks within about 2% of
  the leg height; 7 the same shape, visibly different in places; 5 or below different legs. Visibly wrong proportions
  in the front, profile or three-quarter view cap the score at 6.

Decisions
- 2026-11-07, the user's decision: the same expectations and process as mirroring (the low-poly heads and torsos).
- 2026-11-07, the user's decision: shape is scored, not light; the whole body will be repainted. The renders use the
  heads' shared camera-fixed light (tools/sculpt/lowlight-male.json); light is not tuned.
- 2026-11-07, the user's decision: the belt and the loincloth are clothing, a separate layer later: the body is modelled
  bare, without them. Where they hide the body (the crotch, the pelvis' front, the buttocks' back in the profile) the
  body follows the topology panel (bare on his sheet) and the body around them, kept simple, no anatomical detail
  invented. The fit compares nothing above the belt's lower edge or inside the loincloth.
- 2026-11-07, the user's decision: the full-body reference (ref/body-male.png) decides how the legs sit on the body: leg
  length against the head and the torso, stance width, the pelvis' width at the torso, the feet's size and turn. The leg
  sheet decides the legs' own shape and plane layout. Where they disagree on proportions between parts, the full-body
  reference wins.
- Measured: the leg sheet draws the legs about 1.3 times as wide for their length as the full-body reference (hip to
  floor over hip width 2.1 on the sheet, 2.7 on the body). The legs take the full-body proportions (118.4 pixels a head
  unit off its pupils and chin; the belt's lower edge at y -3.95, the floor at -11.82); the sheet's views are compared
  through one extra number shared by all of them, sy, their vertical scale over their horizontal (fitted, about 0.75),
  reported with every round. The full-body front is a view of its own at true proportion. His sheet also stands the legs
  closer together than the full-body reference: the full-body stance is kept, so the sheet's front shows a wider gap.
- Conflict at the join: the torso's hip cut (half-width 0.55 at y -4.07) is far narrower than the leg sheet's and the
  full-body reference's pelvis there (about 1.1). The torso wins at the join; the user decided (2026-11-07) to widen both
  torsos' bottom ring to the full-body hip width; the legs read the ring from the torso and follow.
- 2026-11-07: the kneecap is two planes, as the top rows and the full-body front draw it: the upper face (its top edge
  ka7 ka0 ka1 flat across, down to the crease kb7 kb0 kb1; facing forward and up) and the lower face (the crease down to
  its point kc0; facing down); together the topology panel's hexagon. Its seven points are placed by hand (lowlfit-*.json
  V) on landmarks off the sheet's front, three-quarter and profile and the full-body front: its top, crease, bottom point
  and corners.
