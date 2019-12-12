const { promisify } = require('util')
const pm2 = require('pm2')

const callbackFunctions = ['connect', 'start', 'stop', 'restart', 'delete', 'reload', 'killDaemon', 'describe', 'list', 'dump', 'disconnect']

module.exports = Object.fromEntries(
  callbackFunctions.filter(fn => typeof pm2[fn] === 'function').map(fn => [fn, promisify(pm2[fn])])
)
