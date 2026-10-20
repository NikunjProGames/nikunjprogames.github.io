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

Add a game to `feed.json` with its title, description, embed URL, thumbnail, category, and tags. The shared `game-category-taxonomy.js` normalizes categories to the site's supported genres and adds every matching genre inferred from the title, supplied category, and tags. Related labels such as **gun**, **shooter**, and **FPS** map to broader categories like **Action**, **Shooting**, and **FPS Shooting** instead of creating one-off category pages. Games with no recognized category are placed in **Other**.

For researched, game-specific copy, add a `seoContent` object to the feed entry. It supports `about` paragraphs, verified `controls`, up to four concise `features`, optional `modes` and `story`, and `questions` grouped under `core`, `mechanics`, `economy`, and `retention`. Each question is an object with `question` and `answer` strings. For example:

```json
"seoContent": {
  "about": ["A natural, game-specific introduction describing the objective."],
  "controls": ["Desktop: Verified keyboard controls."],
  "features": ["Action phrase: A concise, verified gameplay detail."],
  "modes": [],
  "questions": {
    "core": [{"question": "What is the objective?", "answer": "Describe the verified goal."}],
    "mechanics": [],
    "economy": [],
    "retention": []
  }
}
```

The builder turns these fields into the shared semantic game-page structure. Write the copy from reliable game information, use natural search phrases, and omit details that cannot be verified; the build does not perform internet research or invent game facts.

Add an optional `seoDescription` as a concise search snippet (aim for 160 characters or fewer). The normalizer prefers a supplied snippet, then the supplied short description, then the first sentence of the description. It does not append extra sentences to pad the text, and trims overlong snippets at a sentence or word boundary.

Run `node build-games.js` to regenerate game pages, category pages, and legacy game metadata. Run `node build-games.js --categories-only` when only category pages need rebuilding. Page-specific overrides for older root-level game pages live in `legacy-game-seo.json`.

The game-page builder also reads matching `game*.json` Playgama exports by game ID. It adds verified device support, orientation, genres, languages, in-game purchase information, preview screenshots, and longer source instructions to the page structure without rewriting the original game description. When an export contains a gameplay video ID, the builder generates the Playgama MP4 URL and adds a styled gameplay video section. To format a video ID for a game added later, run `node playgama-video-url.js <video-id>`.

Homepage game-preview URLs are kept separately in `game-preview-videos.js`, keyed by homepage game ID. Running `node build-games.js` also checks the Playgama `game*.json` exports, matches their slugs to homepage game-page URLs, and adds any missing preview URLs using the Playgama video-ID formula. Existing URLs are preserved. On desktop, a preview starts immediately when hovering a game card and stops when the pointer leaves. Touch-screen previews are currently disabled.

The `new-game-notifications.yml` GitHub Action uses the `FIREBASE_SERVICE_ACCOUNT_PLEYZ_DD9F8` repository secret to create announcement documents in Firestore. The service account in that secret needs the **Cloud Datastore User** role (`roles/datastore.user`) on the Firebase project `pleyz-dd9f8`; otherwise the workflow fails with `PERMISSION_DENIED`. To fix it, open Google Cloud Console → project `pleyz-dd9f8` → **IAM & Admin → IAM → Grant access**, enter the service account email from the original downloaded credential JSON (the `client_email` value), and grant **Cloud Datastore User**. GitHub does not let you view an existing secret's value; if you no longer have the JSON file, find the account under **IAM & Admin → Service Accounts** or recreate the secret from the correct credential file. Then open the failed run in GitHub → **Actions** → **Notify players about new games** and select **Re-run jobs**.

## Firebase data

PleyZ Score and leaderboard entries are stored in Cloud Firestore. Signed-in players get one point and one game-count increment each time a game page opens; the page updates both the private profile and public leaderboard entry in one Firestore transaction. Guests can still play, but their game opens do not affect the shared leaderboard. Firestore rules only allow a signed-in player to update their own entry, by exactly one point and one game per transaction.

Publish the score and leaderboard changes with `npx -y firebase-tools@latest deploy --only firestore:rules,hosting`. This does not deploy Cloud Functions or require the Blaze plan. Firebase CLI login may be required. No score migration is needed.

The `Gems for You` category updates automatically: games are included when marked as a gem, tagged as a classic, categorized as nostalgia, listed as trending, or given a rating of at least 4.5 in game metadata. The sidebar builds its category list from the game catalogue, so categories added to game metadata appear there automatically.

To inspect feedback in Firebase Console, open **Firestore Database → Data → feedback**. Each user's UID contains `games` (ratings, tags, comments), `interactions` (likes/dislikes), and `recommendations` (helpful yes/no and mood). User feedback documents are private to that user in Firestore rules. When a user signs in, their ratings, selected tags, comments, reactions, and recommendation votes are synced into their personalized recommendation ranking; this does not pool private feedback from other users.

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

Use an SMTP account with permission to send from `SMTP_FROM`; set `GAME_SUBMISSION_TO` to the private inbox that should receive messages, and set `SUBMISSION_RATE_LIMIT_KEY` to a unique random value. The endpoint permits five attempts per IP address per hour and stores only an HMAC of the address in Firestore. Enable a Firestore TTL policy on the `expiresAt` field in the `submissionRateLimits` collection to expire those records after one day. The contact form supports general questions, game removal, account or privacy requests, copyright complaints, problem reports, and other inquiries.

The home page can be installed as a PWA on supported browsers. Its service worker caches the app shell and an offline notice; games still require an internet connection.

## Optional notifications

The notification bell is available on the home, account, category, and game pages. Its update feed and signed-in recommendations use PleyZ data; web push is off until a player explicitly enables it. When enabled, opted-in players can receive a gentle reminder after 7 days without play (at most once per week), genuinely new-game announcements, and personalized recommendations every 14 days. Recommendation picks use the existing gameplay and preference-based ranking. Notification categories and hashed device-token IDs are stored under the signed-in player's private Firestore profile.

To enable background delivery:

1. In Firebase Console, generate a Web Push certificate key pair under **Project settings → Cloud Messaging**. Set the public key as `WEB_PUSH_VAPID_KEY` in `notification-center.js`; it is public configuration, not a server secret.
2. Deploy the backend and announcement read rule with `firebase deploy --only functions,firestore:rules`, and publish the static website files through the repository's existing GitHub Pages workflow. Cloud Functions and scheduled reminders require a billing-enabled Firebase project; the scheduled functions also use Cloud Scheduler.
3. Keep the repository secret `FIREBASE_SERVICE_ACCOUNT_PLEYZ_DD9F8` configured for GitHub Actions with permission to create Firestore documents. When a commit to `main` adds game IDs to `feed.json`, the **Notify players about new games** workflow automatically creates deduplicated announcements for those additions. The bell lists those announcements too, using a public query capped at 20 items. The existing `admin`-only `publishPleyzNewGame` callable remains available for announcements outside the catalog workflow.

Browser/device support and permission settings determine whether push can be enabled. iOS push requires an installed web app. Without the Firebase VAPID key and deployed Functions, the bell and local update feed still work, but notifications cannot arrive while the site is closed.