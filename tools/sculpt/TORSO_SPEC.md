Male low-poly torso. Reference: tools/sculpt/ref/torso-lowpoly-male.png ("Torso Reference (Male, Stylized Low-Poly)").
Built by tools/sculpt/lowtorso.mjs, drawn by tools/sculpt/lowshot.mjs --torso, fitted by tools/sculpt/lowtfit.mjs.

What the sheet shows
- Style: stylized low-poly, flat-shaded, large planar facets, no smoothing. Matches the low-poly head and arm style.
- Top row, the same mesh in five views: Front (0°), Three-Quarter (45°), Profile (90°), Rear Three-Quarter (135°),
  Back (180°). Orthographic. The labels are names, not measurements: each view's angle is measured off the sheet.
- Additional angles: Top (looking down onto the neck's cut and the shoulders), Bottom (looking up at the flat hip cut),
  Under Three-Quarter (from below, turned, the arm cut showing).
- Torso Planes (Front) and (Back): the planes colour-coded in four regions: shoulder / upper back (grey: neck, trapezius,
  deltoids, the upper back down to the shoulder blades' lower ends), chest (pectorals; light tan), abdomen / obliques
  (tan: the abs and, at the back, the middle of the back down to the waist), lower torso / pelvis (pink: the hips below
  the inguinal lines at the front, below the waist line at the back).
- Deconstruction (major forms): chest block (pectorals), ribcage (side mass), abdomen block (abs), pelvis block (lower torso).
- Topology (Example), front and back wireframes: the plane layout. Front: a neck strip down the centre; the clavicle
  line from the neck to the shoulder; each pectoral one large plane from the centre line to the deltoid, its lower edge
  through the nipples; the deltoid a top, a front and a side plane; under the pectorals the abs in rows either side of
  the centre line, the obliques beside them, the side planes; the inguinal lines running down to the centre at the
  bottom. Back: a neck strip, the trapezius from the neck to the shoulders, a line across under the trapezius, the
  shoulder blades, the lats running in to the waist, the lower back to the hip cut, a centre line.
- Openings: the neck cut flat at the top; each arm cut flat at the shoulder (an oval face on the deltoid, facing out
  and down); the hips cut flat at the bottom.
- Target geometry: about 400–800 triangles.
- Small nipples on the pectorals.

Rules
- A direct mirror of the reference in every view: nothing invented, nothing improved; simplified where unclear. The
  plane layout copied from the Topology and Torso Planes panels and the facet edges the views show.
- One closed mesh (every edge shared by exactly two faces, no T-junctions), half authored and mirrored, named vertices
  and named polygons, flat planes with the soft per-facet gradient, never smoothed across edges.
- The neck's foot is the male low-poly head's neck foot (its ring nm0..nm5, tools/sculpt/lowhead.mjs) exactly: head
  plus torso is one continuous body, and the torso replaces the head's shoulder stub when they are joined. The neck
  above that ring and its flat cut are drawn only when the torso is shown alone, as the sheet shows it.
- Each view's orthographic camera fitted to its reference view; the angles measured, not assumed.
- Landmarks per view: neck base, collarbones, shoulder points, the pectorals' lower edges, the waist's narrowest point,
  the navel, the hips' widest point, the bottom cut's corners, the back's centre line, the shoulder blades.
- The fit moves a coarse mirrored lattice and places vertices by hand; polygons are kept flat.
- Views that disagree: the front, profile and three-quarter views win; then the back and the rear three-quarter; the
  top, bottom and under three-quarter last.
- Scoring, shape only: 10 indistinguishable at a glance; 9 only small local differences, landmarks within about 2% of
  the torso's height; 7 the same shape, visibly different in places; 5 or below a different torso. Visibly wrong
  proportions in the front, profile or three-quarter view cap the score at 6.

Decisions
- 2026-11-07, the user's decision: keep the same expectations and process as mirroring (the low-poly heads).
- 2026-11-07, the user's decision: "Less worried about light, we are going to repaint the whole body when done." The
  torso is scored on shape only: outlines, where the facet edges and planes fall, and the landmarks. Lighting is not
  scored and not tuned; the renders use the heads' shared camera-fixed light.
- 2026-11-07: male torso approved as done by the user. Frozen as in commit 65194921: no further changes to his vertices,
  faces or cameras; any change to the shared grid or face list for the female is checked against his render pixel for pixel.
- 2026-11-07, the user's decision: the hip cut's ring (bt0..bt8) widened to the hip width of the full-body reference
  (measured in head units by the pupil-to-chin span), so the legs continue it without a pinch:
  half-width 1.14 at y -4.07 (was 0.55), the ring scaled across only, its depth and height kept. The one exception to the
  freeze: only the ring and the row above it (hw0..hw8, refitted so the planes between stay flat) changed; everything
  above is unchanged. The fitter holds the ring fixed; the torso sheet's bottom-cut-corner landmarks are dropped.
