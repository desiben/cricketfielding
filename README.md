# Cricket Fielding Board

A cricket fielding-position board that runs entirely in the browser. Set the
field, share a link, and let the people you send it to either just look at it or
move the fielders themselves. Any setup can be saved as a PNG.

**No server, no accounts, no database** — a whole setup (title, squad, every
fielder and their position) is encoded into the link itself, so the site is just
static files on any host.

## What you can do

- **Set the field** — drag any fielder anywhere, or tap a player and then tap the
  ground to drop them there. The ground stays clear: instead of a grid of empty
  markers, the app names the position for you. While you drag, a readout follows
  along ("H. Pandya → deep extra cover"); on release it is confirmed, written
  under the player, and shown next to their name in the squad list.
- **Every standard position, when you want them** — the tick box above the ground
  shows all 43 named positions as guides you can tap to drop a player exactly on
  one. It is off by default.
- **Right- or left-hand batter** — the whole set of named positions mirrors, and
  `Mirror field` flips the players you have already placed.
- **Switch ends** — the batter takes strike at the other end, as they do between
  overs. Nobody moves, but the off and leg sides swap round, so square leg is now
  point and fine leg is now long off. Every name and both side counts update.
- **Turn the ground** — `Rotate 90°` steps through quarter turns, so the pitch can
  run across the page or the batter's end can sit at the top. It turns the view
  only: every player keeps their spot and its name. The orientation travels with
  the link and appears in the saved image.
- **Ready-made fields** — ODI powerplay, ODI middle overs, death overs, Test
  attacking with three slips, and a T20 spin field.
- **Live checks** — how many fielders are on the field, inside and outside the
  30-yard circle, and per side, with a warning when more than five are on the leg
  side (a no-ball in limited-overs cricket). Anyone on the line down the middle of
  the pitch — the keeper and the bowler, normally — belongs to neither side and is
  left out of those counts.
- **Dark and light** — the whole page has both, the ground included: floodlit at
  night, daylight by day. It follows your device by default; the button in the top
  bar cycles Auto → Light → Dark and remembers what you chose. The saved image
  comes out in whichever theme you are looking at.
- **Save as image** — a PNG of the ground, with the title, names, positions and
  the counts. `Copy image` puts the same picture on the clipboard where the
  browser supports it.
- **Save on this device** — keep several named setups in the browser you use.

## What people see at the plain address

`https://<user>.github.io/cricketfielding/` — the address with no link fragment —
always opens on an empty ground. Nobody following it lands on somebody else's
team. A board you were working on is kept in your own browser and offered back to
you on a bar above the ground, but it is never restored on its own, and nothing
is written to storage until you change something. A shared link, which carries a
setup in its fragment, opens straight into that setup as you would expect.

## Sharing and permissions

`Share link` gives you three links to the same setup:

| Link | What the other person can do |
| --- | --- |
| **View only** | Look at the field and save it as an image. Nothing is editable. |
| **Can edit** | Move fielders, change the title, notes, batting hand, apply ready-made fields. The **squad list is read-only** for them. |
| **Admin** | Everything, including adding, renaming and removing players. |

Only the admin can build the player list — that is the point of the split. An
edit link lets a teammate rearrange the field you built with the players you
chose; it does not let them change who is in the team.

Someone on a view link can press **Make my own copy** to carry on with their own
board. That copy is theirs; it does not touch yours.

### One thing to be clear about

The permission lives in the link, and the link is the data. Anyone holding a link
can pass it to somebody else, and a technically-minded recipient could edit the
link to give themselves a different role. This is the right trade-off for a team
WhatsApp group and the wrong one for anything confidential — there is no server
here to enforce anything.

Editing a shared setup does **not** change what other people see. Links are
snapshots: after making changes, share a fresh link.

## Running it

It is plain HTML, CSS and JavaScript with no build step and no dependencies.

```bash
git clone https://github.com/desiben/cricketfielding.git
cd cricketfielding
python3 -m http.server 8000   # then open http://localhost:8000
```

Opening `index.html` directly from disk works too.

### Publishing on GitHub Pages

In the repository, go to **Settings → Pages**, set **Source** to *Deploy from a
branch*, pick the branch and the `/ (root)` folder, and save. The site appears at
`https://<user>.github.io/cricketfielding/` within a minute or two, and every
link the app produces points at that address.

## How it is put together

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `assets/styles.css` | Interface styling |
| `js/positions.js` | Ground geometry, the standard fielding positions, ready-made fields |
| `js/state.js` | The setup model, link encoding/decoding, local storage |
| `js/field.js` | Draws the ground as an SVG and handles dragging |
| `js/export.js` | Turns that SVG into a PNG |
| `js/app.js` | Squad, sharing, buttons — everything wired together |

Beyond the rope there is a strip of outfield, the advertising boards, two tiers
of seating with aisles between the blocks, four floodlights and a sightscreen at
each end that turns with the pitch. It is scenery drawn around a playing area
whose coordinates never change, so setups made before it existed still open
exactly as they were.

The ground is a plan view from above with the bowler running in from the top, so
for a right-hander the off side falls on the right of the drawing and the leg
side on the left — the mirror of the view from behind the bowler's arm. It is
drawn in a 1000 × 1140 coordinate space: the boundary is treated as
65 yards from the middle, the 30-yard circle is two semicircles around the stumps,
and fielding positions are stored as an angle and a distance from the striker so
they mirror correctly for a left-hander. Rotation is applied only when drawing —
stored coordinates always have the batter at the bottom, and a pointer position
is turned back before it is stored, so names never depend on the orientation.
Fielder coordinates are rounded to whole units and the squad is referenced by index before the setup is base64url-encoded
into the link, which keeps a full eleven-player setup at roughly 500 characters.
