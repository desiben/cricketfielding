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
- **Either end of the ground** — `Flip ends` turns the ground end for end so the
  batter is at the top, the way you would see it from behind the striker. It is a
  half-turn of the view only: every player keeps their position and its name, the
  off and leg sides simply change hands. The orientation travels with the link
  and appears in the saved image.
- **Ready-made fields** — ODI powerplay, ODI middle overs, death overs, Test
  attacking with three slips, and a T20 spin field.
- **Live checks** — how many fielders are on the field, inside and outside the
  30-yard circle, and per side, with a warning when more than five are on the leg
  side (a no-ball in limited-overs cricket).
- **Save as image** — a PNG of the ground, with the title, names, positions and
  the counts. `Copy image` puts the same picture on the clipboard where the
  browser supports it.
- **Save on this device** — keep several named setups in the browser you use.

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

The ground is drawn in a 1000 × 1140 coordinate space: the boundary is treated as
65 yards from the middle, the 30-yard circle is two semicircles around the stumps,
and fielding positions are stored as an angle and a distance from the striker so
they mirror correctly for a left-hander. Fielder coordinates are rounded to whole
units and the squad is referenced by index before the setup is base64url-encoded
into the link, which keeps a full eleven-player setup at roughly 500 characters.
