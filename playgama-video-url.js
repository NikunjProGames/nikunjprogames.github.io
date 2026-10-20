#!/usr/bin/env node

function createPlaygamaVideoUrl(videoId) {
  const id = String(videoId || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) {
    throw new Error('Provide a valid Playgama video ID.');
  }
  return `https://static.playgama.com/p-video/${id}/orig_length_h320.mp4`;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) {
      throw new Error('Usage: node playgama-video-url.js <video-id>');
    }
    console.log(createPlaygamaVideoUrl(process.argv[2]));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = createPlaygamaVideoUrl;
