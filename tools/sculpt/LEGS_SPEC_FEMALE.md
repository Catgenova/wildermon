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
