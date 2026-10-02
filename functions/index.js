const { randomUUID } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { Pool } = require("pg");

initializeApp();

const db = getFirestore();
const region = "asia-southeast1";
const minimumHeartbeatMs = 25_000;
const maximumHeartbeatMs = 45_000;
const databaseUrl = defineSecret("DATABASE_URL");
let feedbackPool;
const rewardTiers = [
  [60, 1],
  [300, 2],
  [600, 5],
  [1800, 20],
  [3600, 50]
];

function requireUser(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to use the leaderboard.");
  return request.auth;
}

function cleanUsername(value, auth) {
  const fallback = auth.token.name || auth.token.email?.split("@")[0] || "Player";
  const username = String(value || fallback).trim().slice(0, 40);
  return username || "Player";
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function ensureProfile(uid, email, username) {
  const userRef = db.collection("users").doc(uid);
  const leaderboardRef = db.collection("leaderboard").doc(uid);

  await db.runTransaction(async transaction => {
    const [userSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(leaderboardRef)
    ]);
    const profile = userSnapshot.data() || {};
    const now = Timestamp.now();
    const profileData = {
      email: email || profile.email || "",
      username,
      createdAt: profile.createdAt || now,
      pleyzScore: safeCount(profile.pleyzScore),
      gamesPlayed: safeCount(profile.gamesPlayed)
    };

    if (profile.lastPlayed) profileData.lastPlayed = profile.lastPlayed;
    transaction.set(userRef, profileData);
    transaction.set(leaderboardRef, {
      uid,
      username,
      pleyzScore: profileData.pleyzScore,
      gamesPlayed: profileData.gamesPlayed,
      updatedAt: now
    });
  });

  return {
    userRef: db.collection("users").doc(uid),
    leaderboardRef: db.collection("leaderboard").doc(uid)
  };
}

exports.ensurePlayerProfile = onCall({ region }, async request => {
  const auth = requireUser(request);
  await ensureProfile(auth.uid, auth.token.email, cleanUsername(request.data?.username, auth));
  return { ok: true };
});

exports.startGameplaySession = onCall({ region }, async request => {
  const auth = requireUser(request);
  const uid = auth.uid;
  const username = cleanUsername(request.data?.username, auth);
  const gameId = String(request.data?.gameId || "game").slice(0, 180);
  const { userRef, leaderboardRef } = await ensureProfile(uid, auth.token.email, username);
  const sessionRef = db.collection("gameSessions").doc(uid);
  const candidateSessionId = randomUUID();

  const sessionId = await db.runTransaction(async transaction => {
    const [sessionSnapshot, userSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(userRef),
      transaction.get(leaderboardRef)
    ]);
    const now = Timestamp.now();
    const existing = sessionSnapshot.data();
    if (existing?.sessionId && now.toMillis() - existing.lastPingAt.toMillis() <= maximumHeartbeatMs) {
      return existing.sessionId;
    }

    const profile = userSnapshot.data() || {};
    const gamesPlayed = safeCount(profile.gamesPlayed) + 1;
    transaction.set(sessionRef, {
      sessionId: candidateSessionId,
      gameId,
      startedAt: now,
      lastPingAt: now,
      playedSeconds: 0,
      awardedPoints: 0
    });
    transaction.set(userRef, { gamesPlayed, lastPlayed: now }, { merge: true });
    transaction.set(leaderboardRef, {
      uid,
      username: profile.username || username,
      pleyzScore: safeCount(profile.pleyzScore),
      gamesPlayed,
      updatedAt: now
    });
    return candidateSessionId;
  });

  return { sessionId };
});

exports.gameplayHeartbeat = onCall({ region }, async request => {
  const auth = requireUser(request);
  const uid = auth.uid;
  const sessionId = String(request.data?.sessionId || "");
  if (!sessionId) throw new HttpsError("invalid-argument", "A session is required.");

  const sessionRef = db.collection("gameSessions").doc(uid);
  const userRef = db.collection("users").doc(uid);
  const leaderboardRef = db.collection("leaderboard").doc(uid);

  return db.runTransaction(async transaction => {
    const [sessionSnapshot, userSnapshot, leaderboardSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(userRef),
      transaction.get(leaderboardRef)
    ]);
    const session = sessionSnapshot.data();
    if (!session || session.sessionId !== sessionId) {
      throw new HttpsError("failed-precondition", "The gameplay session has expired.");
    }

    const now = Timestamp.now();
    const elapsedMs = now.toMillis() - session.lastPingAt.toMillis();
    if (elapsedMs < minimumHeartbeatMs) return { accepted: false };
    if (elapsedMs > maximumHeartbeatMs) {
      throw new HttpsError("failed-precondition", "The gameplay session timed out.");
    }

    const playedSeconds = safeCount(session.playedSeconds) + Math.floor(elapsedMs / 1000);
    const priorAward = safeCount(session.awardedPoints);
    const nextAward = rewardTiers.reduce(
      (award, [threshold, points]) => playedSeconds >= threshold ? points : award,
      0
    );
    const pointsToAdd = nextAward - priorAward;
    const profile = userSnapshot.data() || {};
    const leaderboard = leaderboardSnapshot.data() || {};
    const score = safeCount(profile.pleyzScore) + pointsToAdd;
    const gamesPlayed = safeCount(profile.gamesPlayed);

    transaction.update(sessionRef, {
      lastPingAt: now,
      playedSeconds,
      awardedPoints: nextAward
    });
    if (pointsToAdd > 0) {
      transaction.set(userRef, { pleyzScore: score, lastPlayed: now }, { merge: true });
      transaction.set(leaderboardRef, {
        uid,
        username: profile.username || leaderboard.username || "Player",
        pleyzScore: score,
        gamesPlayed,
        updatedAt: now
      });
    }

    return { accepted: true, pointsAdded: pointsToAdd, playedSeconds };
  });
});
