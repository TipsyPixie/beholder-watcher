const os = require('os')
const { get } = require('request-promise-native')
const psaux = require('psaux')
const pm2 = require('pm2')

const logger = console
const Server = require('./server')

const httpWatcher = async ({ http, responseField }) => {
  let response = null
  try {
    response = await get({
      uri: encodeURI(http),
      headers: { 'User-Agent': 'Beholder-Watcher' },
      json: true,
      timeout: 10000,
      followRedirect: true,
      maxRedirects: 10
    })
  } catch (err) {
    return { http: false }
  }

  let result = {}
  if (typeof response === 'object') {
    result = response
    if (typeof responseField === 'string') {
      for (const field in responseField.split('.')) {
        if (Object.prototype.hasOwnProperty.call(result, field)) {
          result = result[field]
        } else {
          throw Error(`${responseField} not found`)
        }
      }
    }
  }

  return {
    http: true,
    ...result
  }
}

const pm2Watcher = async ({ http, responseField }, serviceName, monitorHost) => {
  try {
    const totalMemory = os.totalmem()
    await pm2.connect()
    const instances = await pm2.describe(serviceName)

    let report = instances.reduce((totalUsage, instance) => ({
      cpuUsage: totalUsage.cpuUsage + instance.monit.cpu / 100,
      memoryUsage: totalUsage.memoryUsage + Math.ceil(instance.monit.memory / totalMemory * 10000) / 10000
    }), { cpuUsage: 0, memoryUsage: 0 }
    )
    if (http != null) {
      report = Object.assign(await httpWatcher({ http, responseField }), report)
    }
    report.serviceName = serviceName

    if (monitorHost != null) {
      const response = await new Server(monitorHost).submit(report)
      if (response.callbacks != null) {
        response.callbacks.asyncForEach(async callback => {
          callback === 'restart' && await pm2.restart(serviceName).catch(err => { logger.error(err.message) })
        })
      }
    }
    return report
  } catch (err) {
    logger.error(err.message)
    return {}
  } finally {
    await pm2.disconnect().catch(err => { logger.error(err.message) })
  }
}

const uwsgiWatcher = async ({ pid, http, responseField }, serviceName, monitorHost) => {
  try {
    const queryOptions = (pid == null) ? { command: '~uwsgi' } : { pid: pid }
    const instances = (await psaux()).query(queryOptions)

    let report = instances.reduce((totalUsage, instance) => ({
      cpuUsage: totalUsage.cpuUsage + instance.cpu / 100,
      memoryUsage: totalUsage.memoryUsage + instance.mem / 100
    }), { cpuUsage: 0, memoryUsage: 0 }
    )
    if (http != null) {
      report = Object.assign(await httpWatcher({ http, responseField }), report)
    }
    report.serviceName = serviceName

    if (monitorHost != null) {
      await new Server(monitorHost).submit(report)
      // if (response.callbacks != null) {
      //   response.callbacks.asyncForEach(async callback => {
      //   })
    }
    return report
  } catch (err) {
    logger.error(err.message)
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

const watch = async (serviceName, serverInfo, host) => {
  if (serverInfo.instanceType == null) {
    throw Error('instanceType required')
  }
  const result = {
    serviceName: serviceName,
    ...await watcher(serverInfo.instanceType.trim().toLowerCase())(serverInfo, serviceName, host)
  }
  if (Object.keys(result).length === 0) {
    throw Error(`${serviceName} got nothing to report`)
  }
  return result
}

module.exports = watch
