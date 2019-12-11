const os = require('os')
const psaux = require('psaux')
const pm2 = require('pm2')

const logger = console
const { get, callRpc } = require('./utils')
const Server = require('./server')
const { round, subtitle } = require('./utils')

const httpCollector = async ({ http, responseField }) => {
  let response = null
  try {
    response = await get({ ...http, uri: encodeURI(http.uri) })
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

  return (typeof result === 'object') ? { http: true, ...result } : { http: true }
}

const rpcCollector = async ({ rpc, extraHandler }) => {
  let response = null
  try {
    response = await callRpc({ ...rpc, uri: encodeURI(rpc.uri) })
  } catch (err) {
    return { rpc: false }
  }

  if (rpc.method === 'eth_blockNumber') {
    response = { blockNumber: parseInt(response, 16) }
  }
  return (typeof response === 'object') ? { http: true, ...response } : { http: true }
}

const pm2Watcher = async ({ http, responseField, serviceId, rpc }, serviceName, monitorHost) => {
  try {
    const totalMemory = os.totalmem()
    const instances = await pm2.describe(serviceName)

    const report = instances.reduce((totalUsage, instance) => ({
      cpuUsage: totalUsage.cpuUsage + round(instance.monit.cpu / 100),
      memoryUsage: totalUsage.memoryUsage + round(instance.monit.memory / totalMemory)
    }), { cpuUsage: 0, memoryUsage: 0 }
    )

    if (http != null) {
      Object.assign(report, await httpCollector({ http: http, responseField: responseField }))
    }
    if (rpc != null) {
      Object.assign(report, await rpcCollector({ rpc: rpc }))
    }

    report.serviceName = serviceName
    if (serviceId != null) { report.serviceId = serviceId }
    logger.info(report)

    if (monitorHost != null) {
      subtitle('submitting...')
      const response = await new Server(monitorHost).submit(report)
      logger.info(response)
      if (response.callbacks != null) {
        await response.callbacks.asyncForEach(async callback => {
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

const commonWatcher = async ({ http, responseField, serviceId, rpc, instanceType }, serviceName, monitorHost) => {
  try {
    const instances = (await psaux()).query({ command: `~${instanceType}` })

    const report = instances.reduce((totalUsage, instance) => ({
      cpuUsage: totalUsage.cpuUsage + round(instance.cpu / 100),
      memoryUsage: totalUsage.memoryUsage + round(instance.mem / 100)
    }), { cpuUsage: 0, memoryUsage: 0 }
    )

    if (http != null) {
      Object.assign(report, await httpCollector({ http: http, responseField: responseField }))
    }
    if (rpc != null) {
      Object.assign(report, await rpcCollector({ rpc: rpc }))
    }

    report.serviceName = serviceName
    if (serviceId != null) { report.serviceId = serviceId }
    logger.info(report)

    if (monitorHost != null) {
      subtitle('submitting...')
      const response = await new Server(monitorHost).submit(report)
      logger.info(response)
      /**
       * not sure how to handle restart here...
       **/
      // if (response.callbacks != null) {
      //   await response.callbacks.asyncForEach(async callback => {
      //     if (callback === 'restart' && restart != null) {
      //       await promisify(child_process.spawn())
      //     }
      //   })
      // }
    }
    return report
  } catch (err) {
    logger.error(err.message)
    return {}
  }
}

const watcher = (instanceType) => {
  if (instanceType === 'pm2') {
    return pm2Watcher
  } else {
    return commonWatcher
  }
}

const watch = async (serviceName, serverInfo, monitorHost) => {
  subtitle('collecting...')
  if (serverInfo.instanceType == null) {
    throw Error('instanceType required')
  }
  return watcher(serverInfo.instanceType.trim().toLowerCase())(serverInfo, serviceName, monitorHost)
}

module.exports = watch
