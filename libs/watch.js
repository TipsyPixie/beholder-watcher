const pm2 = require('./pm2wrapper')
const os = require('os')
const request = require('request-promise-native')
const psaux = require('psaux')

const httpWatcher = async ({ uri, responseField }) => {
  const response = await request({
    uri: encodeURI(uri),
    headers: { 'User-Agent': 'Beholder-Watcher' },
    json: true
  })

  let result = {}
  if (typeof response === 'object') {
    result = response
    if (typeof responseField === 'string') {
      for (let field in responseField.split('.')) {
        if (response.hasOwnProperty(field)) {
          result = response[field]
        }
      }
    }
  }

  return {
    http: true,
    ...result
  }
}

const pm2Watcher = async ({ identifier, uri, responseField }) => {
  try {
    const instance = await pm2.describe(identifier)
    let result = {
      memoryUsage: Math.ceil(instance.monit.memory / os.totalmem() * 10000) / 100,
      cpuUsage: instance.monit.cpu
    }

    if (uri != null) {
      result = Object.assign(await httpWatcher({ uri, responseField }), result)
    }
    return result
  } catch (err) {
    console.error(err)
    return {}
  }
}

const uwsgiWatcher = async ({ pid, uri, responseField }) => {
  try {
    const ps = await psaux()
    const queryOptions = (pid == null) ? { command: '~uwsgi' } : { pid: pid }

    let result = ps.query(queryOptions).reduce((totalUsage, instance) => ({
        cpuUsage: totalUsage.cpuUsage + instance.cpu,
        memoryUsage: totalUsage.memoryUsage + instance.mem
      }), { cpuUsage: 0, memoryUsage: 0 }
    )

    if (uri != null) {
      result = Object.assign(await httpWatcher({ uri, responseField }), result)
    }
    return result
  } catch (err) {
    console.error(err)
    return {}
  }
}

const watcher = (instanceType) => {
  switch (instanceType) {
    case 'uwsgi':
      return uwsgiWatcher
    case 'http':
      return pm2Watcher
    case 'pm2':
      return pm2Watcher
    default:
      throw Error(`${instanceType} instance type not supported`)
  }
}

const watch = async (serverName, serverInfo) => {
  if (serverInfo.instanceType == null) {
    throw Error('instanceType required')
  }
  const result = {
    serverName: serverName,
    ...await watcher(serverInfo.instanceType.trim().toLowerCase())(serverInfo)
  }
  if (Object.keys(result).length === 0) {
    throw Error(`${serverName} got nothing to report`)
  }
  return result
}

module.exports = watch
