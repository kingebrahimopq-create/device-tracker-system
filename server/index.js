{
  "name": "device-tracker-server",
  "version": "2.0.0",
  "description": "Device Tracker Server",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js",
    "build": "npm install --omit=dev",
    "postinstall": "npm install --omit=dev"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "engines": {
    "node": ">=14.0.0"
  },
  "keywords": ["device", "tracker", "server"],
  "author": "",
  "license": "ISC"
}