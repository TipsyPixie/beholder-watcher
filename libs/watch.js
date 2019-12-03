const pm2 = require('./pm2wrapper')
const os = require('os')
const { get } = require('request-promise-native')
const psaux = require('psaux')

const httpWatcher = async ({ uri, responseField }) => {
  const response = await get({
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
    const totalMemory = os.totalmem()
    const instances = await pm2.describe(identifier)

    let result = instances.reduce((totalUsage, instance) => ({
        cpuUsage: totalUsage.cpuUsage + instance.monit.cpu,
        memoryUsage: totalUsage.memoryUsage + Math.ceil(instance.monit.memory / totalMemory * 10000) / 100,
      }), { cpuUsage: 0, memoryUsage: 0 }
    )

    if (uri != null) {
      result = Object.assign(await httpWatcher({ uri, responseField }), result)
    }
    return result
  } catch (err) {
    console.error(err.message)
    return {}
  }
}

const uwsgiWatcher = async ({ pid, uri, responseField }) => {
  try {
    const queryOptions = (pid == null) ? { command: '~uwsgi' } : { pid: pid }
    const instances = (await psaux()).query(queryOptions)

    let result = instances.reduce((totalUsage, instance) => ({
        cpuUsage: totalUsage.cpuUsage + instance.cpu,
        memoryUsage: totalUsage.memoryUsage + instance.mem,
      }), { cpuUsage: 0, memoryUsage: 0 }
    )

    if (uri != null) {
      result = Object.assign(await httpWatcher({ uri, responseField }), result)
    }
    return result
  } catch (err) {
    console.error(err.message)
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

const watch = async (serviceName, serverInfo) => {
  if (serverInfo.instanceType == null) {
    throw Error('instanceType required')
  }
  const result = {
    serviceName: serviceName,
    ...await watcher(serverInfo.instanceType.trim().toLowerCase())(serverInfo)
  }
  if (Object.keys(result).length === 0) {
    throw Error(`${serviceName} got nothing to report`)
  }
  return result
}

module.exports = watch
