# 🎮 PleyZ Games

[![Live Site](https://img.shields.io/badge/Play-Live%20Arcade-brightgreen?style=for-the-badge)](https://nikunjprogames.github.io/)

Welcome to **PleyZ**, A premium gaming Hub For those who just dont want a stack of games. These are **Curated, OG games** which are specially picked by hand for you!

Designed with a futuristic neon-cyberpunk aesthetic, it features an amazing bootstrapped interface, interactive game-launch overlays, and a curated library of the web's most popular games.

---

## 🚀 Key Features

* **Curatd Games** Special games that are handpicked with effort so that you dont have to 
* **No nonsense UI** No irritating ads, or banners justWith partner ship with Playgama and Game Monetize.com, PleyZ now has a borad Amount of Games
* **Neon background** With the neon moving background, we make pleyz step into the future
* **Not Just Simple Games** PleyZ is not just a hub of simple games that somebody just casually plays, it is a substituion to get actual amazing games for FREE without any downloads or much storage space  

* **PleyZ Originals:** Games Made specially for pleyz that you wont find anywhere else. this feature is evolving and will be slowly in large scale
---

### 🏃‍♂️ Endless Runners & Action
* **Subway Surfers:** Dash, dodge, and escape the inspector in this classic unblocked endless running game.
* **Temple Run:** Navigate hazardous cliffs, ziplines, and ancient ruins while running from demonic monkeys.
* **Running Fred:** A thrilling, fast-paced 3D runner packed with action, traps, and extreme acrobatics.
* **Pac-Man:** The ultimate retro arcade classic—eat dots, avoid ghosts, and clear the maze.

### 🚗 Racing & High-Speed Stunts
* **Moto Road Rash:** Weave through heavy highway traffic at insane speeds on your motorcycle in this arcade racer.
* **Stock Car Hero:** Compete across international race tracks in high-octane stock car tournament championships.
* **City Stunts:** Take control of powerful cars and perform mind-bending gravity stunts across a massive city playground.

### 🌐 Multi-Player & .IO Battle Arenas
* **Paper.io:** Conquer as much territory as possible by drawing lines and cutting off your opponents in this strategic arena.
* **Worms Zone:** Grow the biggest giant worm, consume treats, and trap other players online.
* **Battledudes:** A fast-paced 2D multiplayer shooter with fully destructible maps and massive weapon loadouts.

### 🎯 Skill, Strategy & Casual Puzzles
* **Squid Challenge:** Test your patience and timing in survival challenges inspired by the hit series.
* **Archery World:** Aim true, adjust for wind resistance, and hit the bullseye in realistic target archery trials.
* **Box Tower:** Test your precision reflexes by stacking boxes as high as humanly possible to build the ultimate tower.
* **Color Line:** Guide a traveling cube along intricate neon paths without striking unpredictable obstacles.
* **Go to the End:** A physics-based puzzle obstacle course challenging you to navigate carefully to the finish line.

## Adding games and SEO

Add a game to `feed.json` with its title, description, embed URL, thumbnail, category, and tags. During a full build, `build-games.js` keeps the supplied category and adds matching categories inferred from the tags; games with no recognized category are placed in **Other**. Add an optional `seoDescription` when the source description does not provide a concise, complete search snippet.

Run `node build-games.js` to regenerate game pages, category pages, and legacy game metadata. Run `node build-games.js --categories-only` when only category pages need rebuilding. Page-specific overrides for older root-level game pages live in `legacy-game-seo.json`.

## Firebase functions

PleyZ Score is stored server-side. The public leaderboard function combines the email-free leaderboard projections with score fields in player profiles, so older profiles still appear if their public projection is missing.

Game submissions and contact messages are delivered by the `submitGame` Cloud Function. Before deploying it, configure these Firebase Functions secrets through the CLI prompts (do not put their values in source control):

```sh
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASSWORD
firebase functions:secrets:set SMTP_FROM
firebase functions:secrets:set GAME_SUBMISSION_TO
firebase functions:secrets:set SUBMISSION_RATE_LIMIT_KEY
firebase deploy --only functions
```

Use an SMTP account with permission to send from `SMTP_FROM`; set `GAME_SUBMISSION_TO` to the private inbox that should receive messages, and set `SUBMISSION_RATE_LIMIT_KEY` to a unique random value. The endpoint permits five attempts per IP address per hour and stores only an HMAC of the address in Firestore. Enable a Firestore TTL policy on the `expiresAt` field in the `submissionRateLimits` collection to expire those records after one day.

The home page can be installed as a PWA on supported browsers. Its service worker caches the app shell and an offline notice; games still require an internet connection.