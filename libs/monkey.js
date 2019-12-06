const pm2 = require('pm2')

const { promisify } = require('util')

const targetFunctions = ['connect', 'start', 'stop', 'restart', 'delete', 'reload', 'killDaemon', 'describe', 'list', 'dump', 'disconnect']
targetFunctions.filter(target => typeof pm2[target] === 'function').forEach(target => { pm2[target] = promisify(pm2[target]) })

Array.prototype.asyncForEach = async function (fn) {
  for (let index = 0; index < this.length; index++) {
    await fn(this[index], index, this)
  }
}
