Female low-poly torso. Reference: tools/sculpt/ref/torso-lowpoly-female.png ("Female Torso Reference (Low-Poly,
Stylized)"). Built by tools/sculpt/lowtorso.mjs, drawn by tools/sculpt/lowshot.mjs --torso, fitted by tools/sculpt/lowtfit.mjs.

What the sheet shows
- Style: stylized low-poly, flat-shaded, large planar facets, no smoothing. Matches the low-poly head, arm and leg style.
- Top row, the same mesh in five views: Front (0°), Three-Quarter (45°), Profile (90°), Rear Three-Quarter (135°),
  Back (180°). Orthographic. The labels are names, not measurements: each view's angle is measured off the sheet.
- Additional angles: Top (looking down onto the neck's cut, the shoulders and the breasts), Bottom (looking up at the
  flat hip cut), Under Three-Quarter (from below, turned, the arm cut showing).
- Torso Planes (Front) and (Back): four regions: shoulder / upper back (grey: neck, trapezius, deltoids, the upper back
  down to a zigzag under the shoulder blades), chest (breasts; light tan at the front, the middle of the back down to
  the hips at the back), abdomen / obliques (tan), lower torso / hips (pink, from a V at the front and the back).
- Side Silhouette & Proportions: the profile split into three equal bands, chest, waist and hips.
- Deconstruction (major forms): chest block (breasts), ribcage (upper torso), abdomen block (abs / core), pelvis block (hips).
- Topology (Example), front and back wireframes: the plane layout. Front: a neck strip, the clavicles, each breast a
  fan of facets round its point with a crease under it, the centre line from the sternum down past the navel, the
  ribcage and waist in rows, the hips' widest row, the lower belly's V to the centre at the bottom. Back: a neck strip,
  the trapezius, the shoulder blades, a deep centre line (the spine), the waist, the buttocks' upper curve, a cleft at
  the bottom.
- Silhouette: shoulders narrower than the male's, a narrow waist, hips wider than the shoulders' cut, the hips cut flat
  just below their widest row. A navel (a small notch) and a line down the centre of the belly.
- Openings: the neck cut flat at the top; each arm cut flat at the shoulder (a round face on the deltoid facing out);
  the hips cut flat at the bottom.
- Target geometry: about 400–800 triangles.

Rules
- A direct mirror of the reference in every view: nothing invented, nothing improved; simplified where unclear. The
  plane layout copied from the Topology and Torso Planes panels and the facet edges the views show.
- One closed mesh (every edge shared by exactly two faces, no T-junctions), half authored and mirrored, named vertices
  and named polygons, flat planes with the soft per-facet gradient, never smoothed across edges.
- The neck's foot is the female low-poly head's neck foot (its ring nm0..nm5, tools/sculpt/lowhead.mjs) exactly: head
  plus torso is one continuous body, and the torso replaces the head's shoulder stub when they are joined. The neck
  above that ring and its flat cut are drawn only when the torso is shown alone, as the sheet shows it.
- Each view's orthographic camera fitted to its reference view; the angles measured, not assumed.
- Landmarks per view: neck base, collarbones, shoulder points, the breasts' lower edges, the waist's narrowest point,
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
- 2026-11-07, the user's decision: the hip cut's ring (bt0..bt8) widened to the hip width of the full-body reference
  (measured in head units by the pupil-to-chin span), so the legs continue it without a pinch: half-width 1.10 at
  y -3.79 (was 0.71), the ring scaled across only, its depth and height kept; the row above it (hw0..hw8) refitted so
  the planes between stay flat. Here the full-body reference wins over the torso sheet's narrower cut. The fitter holds
  the ring fixed; the torso sheet's bottom-cut-corner landmarks are dropped.
- 2026-11-07, the user's decision: her breasts grow out of the chest as her reference's do ("the muscles in breasts come
  down from the chest as in the reference"), not two domes set on a flat chest. The upper half has no ring of its own:
  its facets run straight from the foot to the point, and the foot's upper points lie on the pectoral planes' slope from
  the collarbone (the collarbone's point, the foot's top and the point in one line, as the topology panel's line from
  the collarbone through the breast), so the profile's upper slope is the chest continuing; the sides and the underside
  keep the middle ring that rounds them. The point at her reference's front (213, 184), where its facets meet.
