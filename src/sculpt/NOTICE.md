# Third-party assets in the sculpt

## MakeHuman base mesh, targets and rig (CC0 1.0)

`assets/human.json` is built by `tools/sculpt/base.mjs` from the MakeHuman
project's assets, fetched from https://github.com/makehumancommunity/makehuman
(master, November 2026):

- `makehuman/data/3dobjs/base.obj` — the base mesh (the `body` group and the
  two eyeball helpers are kept; the clothes, hair, teeth, tongue, eyelash and
  genital helpers and the joint cubes are dropped);
- `makehuman/data/targets/macrodetails/*` — the macro targets for a young
  adult man and woman (ethnic shapes evened, muscle, weight, proportions);
- `makehuman/data/targets/{head,eyes,nose}/*` — the stylising targets;
- `makehuman/data/rigs/default.mhskel` and `default_weights.mhw` — the
  skeleton's joints, measured for the proportions, and its vertex weights,
  mapped onto the sculpt's bones.

Licence: the repository's `LICENSE.md` states that the bundled assets — "the
base mesh and proxies, targets and modifiers, textures, clothes, poses and
expressions" — are released under CC0 1.0 Universal, with the full text in
`LICENSE.ASSETS.md`; `base.obj` and every target file carry the header "This
asset was explicitly released as CC0 in september 2020". Only assets are used
here, none of the program's source (which is AGPL). The MakeHuman project's
own statement is that output combining its assets with a user's input is free
of any claim. Credit: MakeHuman Team, www.makehumancommunity.org.
