const os = require('os')
const psaux = require('psaux')
const childProcess = require('child_process')
const { promisify } = require('util')

const pm2 = require('./pm2wrapper')
const { get, requestRpc } = require('./utils')
const Server = require('./server')
const { round, subtitle, asyncForEach, post } = require('./utils')
const logger = console

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

const rpcCollector = async ({ rpc }) => {
  let response = null
  try {
    response = await requestRpc({ ...rpc, uri: encodeURI(rpc.uri) })
  } catch (err) {
    return { rpc: false }
  }

  const result = (typeof response === 'object') ? { rpc: true, ...response } : { rpc: true }
  if (typeof rpc.chain === 'string') {
    result.blockNumber = {}
    switch (rpc.chain) {
      case 'ethereum':
      case 'orbit':
        result.blockNumber[rpc.chain] = [parseInt(response, 16)]
        break
      default:
        result.blockNumber[rpc.chain] = [response]
        break
    }
  }
  return result
}

const diskCollector = async () => {
  const df = await promisify(childProcess.exec)('df -h --sync')

  const diskUsages = df.stdout.split('\n').slice(1)
  const hardDiskFilesystemPattern = /^\/dev\/sd[a-z][0-9]?$/
  return {
    disk: Object.fromEntries(
      diskUsages.map(usage => usage.split(/\s+/))
        .filter(([filesystem]) => hardDiskFilesystemPattern.test(filesystem))
        .map(([filesystem, size, used, avail, usedPercent]) => {
          const parsedPercent = (usedPercent != null) ? parseInt(usedPercent.replace('%', '')) : 0.0
          return [filesystem, {
            size: size,
            used: used,
            avail: avail,
            usedPercent: isNaN(parsedPercent) ? 0.0 : round(parsedPercent / 100)
          }]
        })
    )
  }
}

const pm2Watcher = async ({ http, responseField, serviceId, rpc, makeSupportWallet, checkDisk }, serviceName, monitorHost) => {
  const totalMemory = os.totalmem()
  const instances = await pm2.describe(serviceName)
  if (instances.length === 0) {
    throw Error('InstanceNotFound')
  }

  const report = instances.reduce((totalUsage, instance) => ({
    cpuUsage: totalUsage.cpuUsage + instance.monit.cpu / 100,
    memoryUsage: totalUsage.memoryUsage + instance.monit.memory / totalMemory
  }), { cpuUsage: 0, memoryUsage: 0 })
  report.cpuUsage = round(report.cpuUsage)
  report.memoryUsage = round(report.memoryUsage)

  if (http != null) {
    Object.assign(report, await httpCollector({ http: http, responseField: responseField }))
  }
  if (rpc != null) {
    Object.assign(report, await rpcCollector({ rpc: rpc }))
  }
  if (checkDisk) {
    Object.assign(report, await diskCollector())
  }

  report.serviceName = serviceName
  if (serviceId != null) { report.serviceId = serviceId }
  logger.info(report)

  if (monitorHost != null) {
    subtitle('submitting...')
    const response = await new Server(monitorHost).submit(report)
    logger.info(response)
    if (response.callbacks != null) {
      await asyncForEach(response.callbacks, async callback => {
        switch (callback) {
          case 'restart':
            await pm2.restart(serviceName).catch(err => { logger.error(err.message) })
            logger.info('restarted')
            break
          case 'makeSupportWallet':
            await post({ uri: makeSupportWallet, body: { count: 10 } })
            logger.info('madeSupportWallet')
            break
        }
      })
    }
  }
  return report
}

const commonWatcher = async ({ http, responseField, serviceId, rpc, instanceType, checkDisk }, serviceName, monitorHost) => {
  const instances = (await psaux()).query({ command: `~${instanceType}` })
  // if (instances.length === 0) {
  //   throw Error('InstanceNotFound')
  // }

  const report = instances.reduce((totalUsage, instance) => ({
    cpuUsage: totalUsage.cpuUsage + instance.cpu / 100,
    memoryUsage: totalUsage.memoryUsage + instance.mem / 100
  }), { cpuUsage: 0, memoryUsage: 0 })
  report.cpuUsage = round(report.cpuUsage)
  report.memoryUsage = round(report.memoryUsage)

  if (http != null) {
    Object.assign(report, await httpCollector({ http: http, responseField: responseField }))
  }
  if (rpc != null) {
    Object.assign(report, await rpcCollector({ rpc: rpc }))
  }
  if (checkDisk) {
    Object.assign(report, await diskCollector())
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
    throw Error('InstanceTypeRequired')
  }
  return watcher(serverInfo.instanceType.trim().toLowerCase())(serverInfo, serviceName, monitorHost)
}

module.exports = watch
