const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...vals] = line.split('=');
    env[key.trim()] = vals.join('=').trim();
  }
});

module.exports = {
  apps: [{
    name: 'okr-platform',
    script: 'server_dist/index.js',
    node_args: '--experimental-vm-modules',
    env: env
  }]
};
