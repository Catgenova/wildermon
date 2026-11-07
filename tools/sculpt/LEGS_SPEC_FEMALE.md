Female low-poly pelvis and legs. Reference: tools/sculpt/ref/legs-lowpoly-female.png ("Female Pelvis & Leg Reference
(Low-Poly, Stylized)", 1448x1086, used at its own size); the full-body reference tools/sculpt/ref/body-female.png. Built,
drawn and fitted as the male's (tools/sculpt/LEGS_SPEC.md): lowlegs.mjs, lowlshot.mjs, lowlfit.mjs, lowlmask.py,
lowlcam.mjs and lowlcams.json, lowlmarks.json, lowlcomp.py.

What the sheet shows
- Style: stylized low-poly, angular faceted planes, a defined feminine silhouette (wide hips, full buttocks, the thighs
  meeting under the pelvis), simple block feet; matches the torso and arm style.
- Top row, both legs and the pelvis in five views: Front (0°), Three-Quarter (45°), Profile (90°, the toes to the right),
  Rear Three-Quarter (135°), Back (180°); orthographic, the angles measured off the sheet.
- Leg (Single), multiple angles: one leg in the same five views.
- Major Forms (Side View): pelvis, thigh, knee, calf, ankle, foot.
- Cross-Sections (approx.): thigh 8 sides, calf 6 to 8, ankle 4 to 6.
- Leg Planes (Front / Back): one leg in its regions: pelvis / hips (grey), thighs, knees / transition, calves, feet; at the
  back the thigh's planes cross on the diagonal under the buttock.
- Deconstruction: pelvis / hips block (the buttocks two masses), thighs, knees, calves, simple feet.
- Topology (Example), five views: the same rows as the male's (a row under the waist round the hips, down the groin at the
  front, across the buttocks at the back; the crotch; the thigh's top ring; mid-thigh; the knee's top, the kneecap one
  plane, the knee's bottom; calf rings; the ankle; the foot's top edge and sole band); on her sheet the belt and the
  loincloth are drawn over this panel too.
- Target geometry: about 320 to 650 triangles for both legs plus the pelvis.

Rules
- As the male's (tools/sculpt/LEGS_SPEC.md): a direct mirror, nothing invented; one closed half-mesh mirrored, open only at
  the waist, the waist the torso's hip cut ring (bt0..bt8 of the female torso, read from tools/sculpt/lowtorso.mjs and
  lowtfit-female.json); cameras fitted per view; the rows fitted as wholes and vertices placed by hand; the front, profile
  and three-quarter views win; shape scored on the same scale, the same proportion cap.

Decisions
- 2026-11-07, the user's decision: the same expectations and process as mirroring.
- 2026-11-07, the user's decision: shape is scored, not light; the whole body will be repainted.
- 2026-11-07, the user's decision: the belt and the loincloth are clothing, left out; the body is modelled bare. Where
  they hide it (the crotch, the pelvis' front; on her sheet also the topology panel's front) the body follows the visible
  body round them, kept simple, no anatomical detail invented; the fit compares nothing above the belt's lower edge or
  inside the loincloth.
- 2026-11-07, the user's decision: the full-body reference (ref/body-female.png) decides leg length against the head and
  the torso, stance width, the pelvis' width at the torso, the feet's size and turn; the leg sheet decides the legs' own
  shape and plane layout; on proportions between parts the full-body reference wins.
- Measured: her head on the full-body reference is 107 pixels a unit (pupils to chin), but her torso sits about 0.6 units
  lower there against the chin than the female torso does; the legs are placed against the torso (the full-body hips'
  top, y 700, at the torso's hip row, y -3.35): the belt's lower edge at -3.93, the floor at -12.83. Her sheet draws the
  legs wider for their length (sy about 0.8, reported each round) and with the thighs touching; the full-body reference
  stands them apart, which is kept.
- Conflict at the join: her torso's hip cut (half-width 0.71 at y -3.79) is narrower than her full-body reference's pelvis
  there (about 1.1). The torso wins at the join; the user decided to widen it; the legs follow the torso's ring.
- 2026-11-07: the kneecap two planes as the male's (tools/sculpt/LEGS_SPEC.md), taller as her full-body front draws it
  (top to point 1.4 units, the crease a V, its outer corner higher than its inner); its upper face set flat on its
  least-squares plane. Her sheet's profile puts the kneecap 16-21 pixels lower against the knee's back than the full-body
  front's proportions allow; the full-body reference wins.
- 2026-11-07: her hip line at the side at y -5.0 (held) as the male's; the mid-thigh ring held half way between the thigh's
  top and the knee (y -6.45), so the thigh tapers straight into the knee as her full-body front draws it, no step; the
  crotch held under the loincloth between the thighs (y -5.3, z 0; the fit had pushed it in front of the body); her feet
  larger as her full-body front: the toe's half-width 0.36 (was 0.24), the ball's 0.50, landmarks on the toe face's corners.
- 2026-11-07, the user's decision: the legs are approved after this round (male and female); no further rounds.
- 2026-11-07, the user's request ("make the seam better from waist to knee; very boxed out and a bad transition"): the
  waist, hips and thighs one continuous outline as her full-body front draws it (the waist narrowing, the hips flaring,
  the thighs tapering to the knee), no ledge at the hip line. At the side the hip line stays at y -5.0 but in to the
  full-body front's outline there (gl half-width 1.46, was 1.62); the thigh's top ring lowered at the front and the side
  to -5.6 and in to the outline's widest (th outer 1.56, was 1.73 at -5.0, level with the hip line, so the faces between
  were a flat ledge); at the back the buttock's lower fold to -5.5. In profile, off her leg sheet's profile: the
  buttock's peak at the hip row's back (-1.15), the thigh's top ring's back -1.12, the mid-thigh ring's back in to -0.86
  (was -1.07) and its front out to 0.55 (was 0.41), so the buttock rounds into the thigh and the thigh's front runs
  straight onto the kneecap; the pubic point back to 0.58 (was 0.76, a spike in profile; under the loincloth).
- 2026-11-07, the user's request ("the front of her waist should come down as a V from her abdomen to between her legs;
  there is no butt shape or padding yet; it looks like she has a frontbutt"): the hip row's front is the groin's crease,
  from the hip cut's front corner (gl3 at 1.1, -4.2) down to the pubic point between the legs (gl0 at -5.8), the belly
  between them narrowing to it and the thigh's front planes beginning at the hip cut, as her full-body front draws them;
  the pelvis' front recedes in profile (the pubic point 0.33, the crease 0.36, the thigh's top front 0.47; no bulge above
  the mid-thigh); the crotch between the legs at -6.15, where her full-body front's thighs part. The thigh's front from
  the crease in triangles (the groin's two faces, P.split gr0, gr1/). At the back the hip row crosses the buttocks at their
  lowest bulge (-1.25 at -5.1, the cleft inset to -1.06), the thigh's top ring at the back the gluteal fold under them
  (-0.94 at -5.7, rising to the side), so the faces between face down: the fold her leg sheet's back view draws.
- 2026-11-07, the user's request ("the peak of the butt a little lower and a little more pronounced, not much"): the hip
  row across the buttocks lowered about 0.2 and back 0.07 at the peak (gl7 -1.32 at -5.3, the cleft -1.12 at -5.18), the
  gluteal fold under it moved down with it (th4 -0.98 at -5.88, th5 -5.96, th3 -5.62) so its faces still turn down; the
  thighs part where they did.
