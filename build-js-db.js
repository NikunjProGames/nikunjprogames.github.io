const fs = require('fs');

const FEED_FILE = 'feed.json';

function generateJsDatabase() {
  const gamesData = fs.readFileSync(FEED_FILE, 'utf8');
  const games = JSON.parse(gamesData);

  // Set this to whatever ID you want to start from (since your last game is 43)
  let startingId = 44; 

  // Map the feed data to your exact JavaScript array structure
  const formattedGames = games.map((game, index) => {
    // Generate the exact same HTML slug we used in the previous scripts
    const slug = game.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    return {
      id: startingId + index,
      name: game.title,
      cat: game.category.toLowerCase(), // Converts "Sports" to "sports"
      color: '#0057B8', // Default color for auto-generated games
      gradient: 'linear-gradient(135deg,#001530,#003080)',
      players: '0',
      imageUrl: game.thumb,
      iframeUrl: `${slug}.html`
    };
  });

  // Convert the array of objects into a nicely formatted JavaScript string
  // We use regex to remove the quotes around the keys to match your exact coding style
  let jsOutput = `const NEW_GAMES = ${JSON.stringify(formattedGames, null, 2)};\n`;
  jsOutput = jsOutput.replace(/"([^"]+)":/g, '$1:');

  // Save it to a new file
  fs.writeFileSync('generated-games-db.js', jsOutput);
  
  console.log(`Success! ${games.length} games formatted for your JS array.`);
}

generateJsDatabase();