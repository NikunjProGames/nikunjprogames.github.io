export async function sendPleyzFeedback(user, collectionName, gameId, payload) {
  if (!user) throw new Error('Sign in to send feedback.');
  if (!['games', 'interactions', 'recommendations'].includes(collectionName)) {
    throw new Error('Invalid feedback type.');
  }
  const safeGameId = String(gameId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(safeGameId)) {
    throw new Error('Invalid game ID.');
  }

  const [{ getApp }, firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
  ]);
  const db = window.firebaseDb || firestore.getFirestore(getApp());
  const reference = firestore.doc(db, 'feedback', user.uid, collectionName, safeGameId);
  const snapshot = await firestore.getDoc(reference);
  await firestore.setDoc(reference, {
    ...payload,
    ...(snapshot.exists() ? {} : { createdAt: firestore.serverTimestamp() }),
    updatedAt: firestore.serverTimestamp()
  }, { merge: true });
  return { ok: true };
}