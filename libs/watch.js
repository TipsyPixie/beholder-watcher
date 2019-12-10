const os = require('os')
const { get } = require('request-promise-native')
const psaux = require('psaux')
const pm2 = require('pm2')

const logger = console
const Server = require('./server')
const { ceil, subtitle } = require('./utils')

const httpWatcher = async ({ http, responseField }) => {
  let response = null
  try {
    response = await get({
      uri: encodeURI(http),
      headers: { 'User-Agent': 'Beholder-Watcher' },
      json: true,
      timeout: 5000,
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
    const instances = await pm2.describe(serviceName)

    let report = instances.reduce((totalUsage, instance) => ({
      cpuUsage: totalUsage.cpuUsage + ceil(instance.monit.cpu / 100),
      memoryUsage: totalUsage.memoryUsage + ceil(instance.monit.memory / totalMemory)
    }), { cpuUsage: 0, memoryUsage: 0 }
    )
    if (http != null) {
      report = Object.assign(await httpWatcher({ http, responseField }), report)
    }
    report.serviceName = serviceName
    logger.info(report)

    if (monitorHost != null) {
      subtitle('submitting...')
      const response = await new Server(monitorHost).submit(report)
      logger.info(response)
      if (response.callbacks != null) {
        response.callbacks.asyncForEach(async callback => {
          if (callback === 'restart') {
            await pm2.restart(serviceName).catch(err => { logger.error(err.message) }).then(() => logger.info('restarted'))
          }
        })
      }
    }
    return report
  } catch (err) {
    logger.error(err.message)
    return {}
  }
}

const uwsgiWatcher = async ({ pid, http, responseField }, serviceName, monitorHost) => {
  try {
    const queryOptions = (pid == null) ? { command: '~uwsgi' } : { pid: pid }
    const instances = (await psaux()).query(queryOptions)

    let report = instances.reduce((totalUsage, instance) => ({
      cpuUsage: totalUsage.cpuUsage + ceil(instance.cpu / 100),
      memoryUsage: totalUsage.memoryUsage + ceil(instance.mem / 100)
    }), { cpuUsage: 0, memoryUsage: 0 }
    )
    if (http != null) {
      report = Object.assign(await httpWatcher({ http, responseField }), report)
    }
    report.serviceName = serviceName
    logger.info(report)

    if (monitorHost != null) {
      subtitle('submitting...')
      const response = await new Server(monitorHost).submit(report)
      logger.info(response)
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
      throw Error(`instance type ${instanceType} not supported`)
  }
}

const watch = async (serviceName, serverInfo, host) => {
  subtitle('collecting...')
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
