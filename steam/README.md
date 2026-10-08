# Dunreath, Steam edition

A second copy of the desktop app, made for Steam. The free app in `desktop/`
loads the website; this one carries the game inside it, so it plays offline
and keeps saves in Steam Cloud.

- `scripts/bundle-game.js` copies `../index.html` into `game/` with three.js
  and the fonts stored locally (run by `npm run dist`).
- `main.js` starts Steam (if it's running), serves the game and handles
  Steam Cloud and quitting. `preload.js` is the small bridge the game sees
  as `window.dunreathSteam`.
- `steam-config.js` holds the App ID. It is 480, Valve's test game, until
  Dunreath has its own.

The **Build Steam edition** workflow builds the Windows folder and attaches it
to the run as `Dunreath-Steam-Windows`.

## Before release (in Steamworks, once the fee is paid)

1. Put Dunreath's App ID in `steam-config.js`.
2. Steam Cloud: set a byte quota (1 MB is plenty) and a file count (5).
3. Upload the `Dunreath-Steam-Windows` folder as the Windows depot, with
   `Dunreath.exe` as the launch option.
4. Achievements: under Stats & Achievements, add these five with exactly
   these API names, then publish. Icons can come later.

   | API name | Name | Unlocked when |
   |---|---|---|
   | `SPIRIT_LAID_TO_REST` | Laid to Rest | The spirit is laid to rest |
   | `ART_RECOVERED` | The Madonna Comes Home | The Ashby paintings are recovered |
   | `ROBBERY_FOILED` | Nothing Taken | The big robbery is foiled |
   | `SEASON_SERVED` | Twenty Days | All twenty days served without being recalled |
   | `HIGH_STANDING` | Made Permanent | The season ends with the council's opinion High |

   Games started with `?day=N` never unlock anything. On easy terms, Twenty
   Days only counts if the council would not have recalled you anyway.
