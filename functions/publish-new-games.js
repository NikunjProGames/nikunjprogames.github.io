const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

function getPreviousFeed(revision) {
  try {
    return execFileSync("git", ["show", `${revision}:feed.json`], { encoding: "utf8" });
  } catch (error) {
    if (error.status === 128) {
      console.warn(`Cannot read previous catalog revision ${revision}; skipping announcements.`);
      return null;
    }
    throw error;
  }
}

function parseFeed(contents, label) {
  const parsed = JSON.parse(contents);
  if (!Array.isArray(parsed)) throw new Error(`${label} must contain a JSON array.`);
  return parsed;
}

function toPlainText(value) {
  const entities = {
    amp: "&", apos: "'", bull: "•", gt: ">", ldquo: "“", lsquo: "‘", lt: "<",
    mdash: "—", nbsp: " ", ndash: "–", quot: '"', rdquo: "”", rsquo: "’",
    trade: "™", reg: "®"
  };
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&([a-z]+);/gi, (match, entity) => entities[entity.toLowerCase()] || match)
    .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim()
}

function slugify(value) {
  return toPlainText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function main() {
  let revision = process.argv[2];
  if (!revision || /^0+$/.test(revision)) {
    revision = execFileSync("git", ["rev-parse", "HEAD^"], { encoding: "utf8" }).trim();
  }
  const previousFeed = getPreviousFeed(revision);
  if (previousFeed === null) return;

  const previousIds = new Set(parseFeed(previousFeed, "Previous feed")
    .map(game => String(game.id || "").trim())
    .filter(Boolean));
  const currentGames = parseFeed(readFileSync("feed.json", "utf8"), "Current feed");
  if (currentGames.some(game => !String(game.id || "").trim())) {
    throw new Error("Every catalog entry needs a stable game ID before it can be announced.");
  }
  const addedGames = currentGames.filter(game => {
    const id = String(game.id || "").trim();
    if (!id || previousIds.has(id)) return false;
    previousIds.add(id);
    return true;
  });
  if (!addedGames.length) {
    console.log("No new game IDs found in feed.json.");
    return;
  }

  const { cert, getApps, initializeApp } = require("firebase-admin/app");
  const { getFirestore, FieldValue } = require("firebase-admin/firestore");
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
  if (!serviceAccount || !serviceAccount.project_id) {
    throw new Error("The FIREBASE_SERVICE_ACCOUNT GitHub secret is missing or invalid.");
  }
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
  const announcements = getFirestore(app).collection("notificationAnnouncements");

  for (const game of addedGames) {
    const gameId = String(game.id).trim();
    const name = toPlainText(game.title);
    const slug = String(game.slug || slugify(name));
    const href = `/games/${slug}.html`;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(gameId)
      || !name || name.length > 120
      || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,180}$/.test(slug)
      || !/^\/games\/[A-Za-z0-9][A-Za-z0-9_-]{0,180}\.html$/.test(href)) {
      throw new Error(`New catalog entry ${gameId || "(missing ID)"} has invalid announcement data.`);
    }

    try {
      await announcements.doc(gameId).create({
        gameId,
        name,
        href,
        createdAt: FieldValue.serverTimestamp()
      });
      console.log(`Published new-game announcement for ${gameId}: ${name}`);
    } catch (error) {
      if (error.code === 6 || error.code === "already-exists") {
        console.log(`Announcement already exists for ${gameId}; skipping duplicate.`);
        continue;
      }
      throw error;
    }
  }
}

main().catch(error => {
  console.error("New-game announcements failed:", error);
  process.exitCode = 1;
});
