# The leather chest traced on its spec sheet

`tools/sculpt/ref/leather-chest.png` traced view by view, every plate its own polygon in the sheet's pixels, for
approval before the model is built from it. One JSON per body and view (`male-front.json`, ...):
`box` the view's crop, `pieces` polygons ([[x, y], ...]) or ellipses ({ ellipse: [cx, cy, rx, ry] }), `lines` open
polylines (trim lines, lacing), `dots` rivets ([x, y, r]).

  python3 grid.py x0,y0,x1,y1 out.png [K]        the sheet's region at K x with a labelled grid
  python3 regcheck.py view.json x0,y0,x1,y1 out.png [K]   the trace over the sheet's region, with the grid
  python3 overlay.py view.json out.png [K]      the view's pieces filled and named over the sheet
  python3 wire.py view.json out.png [K]         the sheet beside the trace as a wireframe
