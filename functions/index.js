const { createHmac } = require("node:crypto");
const { Readable } = require("node:stream");
const Busboy = require("busboy");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");

initializeApp();

const db = getFirestore();
const region = "asia-southeast1";
const databaseUrl = defineSecret("DATABASE_URL");
const smtpHost = defineSecret("SMTP_HOST");
const smtpPort = defineSecret("SMTP_PORT");
const smtpUser = defineSecret("SMTP_USER");
const smtpPassword = defineSecret("SMTP_PASSWORD");
const smtpFrom = defineSecret("SMTP_FROM");
const submissionRecipient = defineSecret("GAME_SUBMISSION_TO");
const submissionRateLimitKey = defineSecret("SUBMISSION_RATE_LIMIT_KEY");
let feedbackPool;
const maximumSubmissionBytes = 10 * 1024 * 1024;

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

function playerScore(profile) {
  return Math.max(
    safeCount(profile.pleyzScore),
    safeCount(profile.score),
    safeCount(profile.points)
  );
}

function playerGamesPlayed(profile) {
  return Math.max(safeCount(profile.gamesPlayed), safeCount(profile.games));
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
      pleyzScore: playerScore(profile),
      gamesPlayed: playerGamesPlayed(profile)
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

exports.fetchPleyzLeaderboard = onCall({ region }, async request => {
  const readCandidates = async collectionRef => {
    const orderedSnapshot = await collectionRef.orderBy("pleyzScore", "desc").limit(500).get();
    if (orderedSnapshot.size >= 10) return orderedSnapshot.docs;

    const fallbackSnapshot = await collectionRef.limit(500).get();
    const documents = new Map(orderedSnapshot.docs.map(document => [document.id, document]));
    fallbackSnapshot.docs.forEach(document => documents.set(document.id, document));
    return [...documents.values()];
  };

  const [leaderboardDocuments, profileDocuments] = await Promise.all([
    readCandidates(db.collection("leaderboard")),
    readCandidates(db.collection("users"))
  ]);
  const entries = new Map();

  for (const document of [...leaderboardDocuments, ...profileDocuments]) {
    const data = document.data();
    const uid = String(data.uid || document.id);
    const existing = entries.get(uid);
    entries.set(uid, {
      uid,
      username: data.username || data.displayName || data.name || existing?.username || "Player",
      pleyzScore: Math.max(
        existing?.pleyzScore || 0,
        playerScore(data)
      ),
      gamesPlayed: Math.max(
        existing?.gamesPlayed || 0,
        playerGamesPlayed(data)
      )
    });
  }

  if (request.auth && !entries.has(request.auth.uid)) {
    const ownProfile = await db.collection("users").doc(request.auth.uid).get();
    if (ownProfile.exists) {
      const data = ownProfile.data();
      entries.set(request.auth.uid, {
        uid: request.auth.uid,
        username: data.username || data.displayName || "Player",
        pleyzScore: playerScore(data),
        gamesPlayed: playerGamesPlayed(data)
      });
    }
  }

  const rankedEntries = [...entries.values()]
    .sort((first, second) => second.pleyzScore - first.pleyzScore);
  const currentUserIndex = request.auth
    ? rankedEntries.findIndex(entry => entry.uid === request.auth.uid)
    : -1;

  return {
    entries: rankedEntries.slice(0, 10),
    currentUserRank: currentUserIndex >= 0 ? currentUserIndex + 1 : null
  };
});

function submissionError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseSubmission(request) {
  return new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(request.rawBody)) {
      reject(submissionError("Could not read the submitted form."));
      return;
    }

    let parser;
    try {
      parser = Busboy({
        headers: request.headers,
        limits: {
          fieldSize: 10_000,
          fields: 20,
          files: 2,
          fileSize: maximumSubmissionBytes
        }
      });
    } catch {
      reject(submissionError("Submit the form using the provided page."));
      return;
    }

    const fields = Object.create(null);
    const attachments = [];
    const attachmentNames = new Set();
    let totalFileBytes = 0;
    let parseFailure = null;
    const fail = message => { parseFailure ||= submissionError(message); };

    parser.on("field", (name, value, info) => {
      if (info.valueTruncated || Object.hasOwn(fields, name)) {
        fail("One of the form fields is too long or duplicated.");
        return;
      }
      fields[name] = value;
    });

    parser.on("file", (name, stream, info) => {
      if (!["Game File", "Game Thumbnail"].includes(name) || !info.filename) {
        stream.resume();
        if (info.filename) fail("The form contains an unexpected file.");
        return;
      }
      if (attachmentNames.has(name)) {
        stream.resume();
        fail("Only one file may be uploaded for each file field.");
        return;
      }
      attachmentNames.add(name);

      const extension = info.filename.split(".").pop().toLowerCase();
      const allowedExtensions = name === "Game File"
        ? ["html", "zip"]
        : ["png", "jpg", "jpeg", "webp"];
      if (!allowedExtensions.includes(extension)) {
        stream.resume();
        fail("A file has an unsupported file type.");
        return;
      }

      const chunks = [];
      stream.on("data", chunk => {
        totalFileBytes += chunk.length;
        if (totalFileBytes > maximumSubmissionBytes) {
          fail("The combined upload must be no larger than 10 MB.");
          return;
        }
        chunks.push(chunk);
      });
      stream.on("limit", () => fail("A file is larger than the 10 MB upload limit."));
      stream.on("end", () => {
        if (parseFailure) return;
        const safeName = info.filename
          .replace(/[^A-Za-z0-9._-]/g, "_")
          .slice(-100) || `submission.${extension}`;
        attachments.push({
          filename: safeName,
          content: Buffer.concat(chunks),
          contentType: name === "Game File"
            ? extension === "zip" ? "application/zip" : "text/html"
            : extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : extension === "webp" ? "image/webp" : "image/png"
        });
      });
      stream.on("error", () => fail("A file could not be read."));
    });

    parser.on("filesLimit", () => fail("Only a game file and one optional thumbnail may be uploaded."));
    parser.on("fieldsLimit", () => fail("The form contains too many fields."));
    parser.on("error", () => fail("The form could not be read."));
    parser.on("close", () => {
      if (parseFailure) reject(parseFailure);
      else resolve({ fields, attachments });
    });
    Readable.from([request.rawBody]).pipe(parser);
  });
}

async function allowSubmission(ipAddress, key) {
  const now = Timestamp.now();
  const windowMs = 60 * 60 * 1000;
  const keyHash = createHmac("sha256", key).update(ipAddress).digest("hex");
  const rateLimitRef = db.collection("submissionRateLimits").doc(keyHash);

  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(rateLimitRef);
    const previous = snapshot.data() || {};
    const windowStartedAt = previous.windowStartedAt?.toMillis() || 0;
    const inCurrentWindow = now.toMillis() - windowStartedAt < windowMs;
    const count = inCurrentWindow ? safeCount(previous.count) : 0;
    if (count >= 5) return false;

    transaction.set(rateLimitRef, {
      windowStartedAt: inCurrentWindow ? previous.windowStartedAt : now,
      count: count + 1,
      expiresAt: Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000)
    });
    return true;
  });
}

function readSubmissionFields(fields, attachments) {
  const field = (name, maximumLength, required = false) => {
    const value = String(fields[name] || "").trim();
    if (value.length > maximumLength || (required && !value)) {
      throw submissionError("Check the required fields and try again.");
    }
    return value;
  };

  if (fields.companyWebsite) throw submissionError("The submission was rejected.");
  if (fields.formType === "contact") {
    if (attachments.length) throw submissionError("Contact messages cannot include file uploads.");
    const topic = field("Inquiry Type", 40, true);
    if (![
      "General question",
      "Copyright complaint",
      "Report a problem",
      "Game removal request",
      "Account or privacy request",
      "Other inquiry"
    ].includes(topic)) {
      throw submissionError("Choose a valid contact topic.");
    }
    const contactEmail = field("Contact Email", 254, true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw submissionError("Enter a valid contact email.");
    }
    return {
      kind: "contact",
      creator: field("Contact Name", 120, true),
      submitterEmail: contactEmail,
      title: topic,
      description: field("Message", 5000, true),
      attachments: []
    };
  }

  if (fields["Final Submission Confirmation"] !== "Accepted") {
    throw submissionError("Confirm the submission terms before sending.");
  }

  const category = field("Category", 40, true);
  const categories = ["Action", "Adventure", "Arcade", "Casual", "Multiplayer", "Puzzle", "Racing", "Simulation", "Sports", "Strategy", "Other"];
  if (!categories.includes(category)) throw submissionError("Choose a valid game category.");

  const submitterEmail = field("Submitter Email", 254, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw submissionError("Enter a valid contact email.");
  }

  const httpsUrl = (name, required = false) => {
    const value = field(name, 2048, required);
    if (!value) return "";
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw submissionError("Enter a valid web address.");
    }
    return value;
  };

  const gameFile = attachments.find(file => /\.html$|\.zip$/i.test(file.filename));
  if (!gameFile) throw submissionError("Upload the required HTML or ZIP game file.");

  return {
    kind: "game",
    creator: field("Creator / Developer Name", 120, true),
    submitterEmail,
    title: field("Game Title", 160, true),
    category,
    playableUrl: httpsUrl("Playable Game URL"),
    description: field("Game Description", 5000, true),
    tags: field("Game Tags", 300),
    website: httpsUrl("Creator Website"),
    social: httpsUrl("Creator Social Link"),
    attachments
  };
}

exports.submitGame = onRequest({
  region,
  cors: [
    "https://nikunjprogames.github.io",
    "https://pleyz-dd9f8.web.app",
    "https://pleyz-dd9f8.firebaseapp.com"
  ],
  secrets: [
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    smtpFrom,
    submissionRecipient,
    submissionRateLimitKey
  ],
  maxInstances: 2,
  timeoutSeconds: 60,
  memory: "512MiB"
}, async (request, response) => {
  if (request.method !== "POST") {
    response.set("Allow", "POST").status(405).json({ ok: false, error: "Use POST to submit this form." });
    return;
  }

  const ipAddress = request.ip || request.socket.remoteAddress;
  if (!ipAddress) {
    response.status(400).json({ ok: false, error: "The request could not be verified." });
    return;
  }

  try {
    const allowed = await allowSubmission(ipAddress, submissionRateLimitKey.value());
    if (!allowed) {
      response.status(429).json({ ok: false, error: "Too many submissions. Please try again later." });
      return;
    }

    const { fields, attachments } = await parseSubmission(request);
    const submission = readSubmissionFields(fields, attachments);
    const port = Number(smtpPort.value());
    const mailSettings = [
      smtpHost.value(),
      smtpUser.value(),
      smtpPassword.value(),
      smtpFrom.value(),
      submissionRecipient.value()
    ];
    if (!Number.isInteger(port) || port < 1 || port > 65535 || mailSettings.some(value => !value)) {
      console.error("Game submission mail secrets are not configured.");
      response.status(503).json({ ok: false, error: "The submission service is not configured yet." });
      return;
    }

    const transport = nodemailer.createTransport({
      host: smtpHost.value(),
      port,
      secure: port === 465,
      auth: { user: smtpUser.value(), pass: smtpPassword.value() }
    });
    const body = submission.kind === "contact"
      ? [
          `Name: ${submission.creator}`,
          `Contact email: ${submission.submitterEmail}`,
          `Topic: ${submission.title}`,
          "",
          "Message:",
          submission.description
        ].join("\n")
      : [
          `Creator / Developer: ${submission.creator}`,
          `Contact email: ${submission.submitterEmail}`,
          `Game title: ${submission.title}`,
          `Category: ${submission.category}`,
          `Playable URL: ${submission.playableUrl || "Not provided"}`,
          `Tags: ${submission.tags || "Not provided"}`,
          `Website: ${submission.website || "Not provided"}`,
          `Social link: ${submission.social || "Not provided"}`,
          "",
          "Game description:",
          submission.description
        ].join("\n");

    await transport.sendMail({
      from: {
        name: submission.kind === "contact" ? "PleyZ Contact" : "PleyZ Game Submissions",
        address: smtpFrom.value()
      },
      to: submissionRecipient.value(),
      replyTo: submission.submitterEmail,
      subject: `PleyZ ${submission.kind === "contact" ? "message" : "game submission"}: ${submission.title.replace(/[\r\n]+/g, " ").slice(0, 160)}`,
      text: body,
      attachments: submission.attachments.map(file => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
        contentDisposition: "attachment"
      }))
    });

    response.status(200).json({ ok: true, kind: submission.kind });
  } catch (error) {
    if (error.statusCode === 400) {
      response.status(400).json({ ok: false, error: error.message });
      return;
    }
    console.error("Game submission email delivery failed:", error.code || "unknown");
    response.status(502).json({ ok: false, error: "We could not send your submission. Please try again later." });
  }
});
