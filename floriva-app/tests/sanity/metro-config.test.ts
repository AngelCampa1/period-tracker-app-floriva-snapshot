const fs = require('node:fs');
const path = require('node:path');

describe('metro config', () => {
  it('keeps SQL files in source extensions and wasm in asset extensions', () => {
    const metroConfigSource = fs.readFileSync(path.join(process.cwd(), 'metro.config.js'), 'utf8');

    expect(metroConfigSource).toContain("sourceExts.includes('sql')");
    expect(metroConfigSource).toContain("assetExts.includes('wasm')");
  });
});
