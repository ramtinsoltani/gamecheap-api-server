const path = require('path');
const fs = require('fs-extra');

// Delete dist (but keep dist/.logs)
if ( fs.existsSync(path.resolve(__dirname, 'dist')) ) {

  const files = fs.readdirSync(path.join(__dirname, 'dist'));

  for ( const file of files ) {

    if ( file === '.logs' ) continue;

    fs.removeSync(path.join(__dirname, 'dist', file));

  }

}

// Add tsconfig paths to src/paths.json
const tsconfigPaths = require('./tsconfig.json').compilerOptions.paths || {};

// Remove ./src/ from the beginning
for ( const alias in tsconfigPaths ) {

  for ( let i = 0; i < tsconfigPaths[alias].length; i++ ) {

    tsconfigPaths[alias][i] = tsconfigPaths[alias][i].replace(/^\.?\/?src\//, '');

  }

}

fs.writeFileSync(path.resolve(__dirname, 'src', 'paths.json'), JSON.stringify(tsconfigPaths, null, 2));
