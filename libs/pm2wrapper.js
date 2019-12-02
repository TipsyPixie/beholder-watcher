const pm2 = require('pm2')

const { promisify } = require('util')

const targetFunctions = ['connect', 'start', 'stop', 'restart', 'delete', 'reload', 'killDaemon', 'describe', 'list', 'dump']
targetFunctions.filter(target => typeof pm2[target] === 'function').forEach(target => { pm2[target] = promisify(pm2[target]) })

module.exports = pm2
