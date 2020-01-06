const pm2 = require('./libs/pm2wrapper')
const watch = require('./libs/watch')
const { title, asyncForEach } = require('./libs/utils')

const logger = console

const report = async (config) => {
  let pm2Connected = false
  await asyncForEach(Object.entries(config.targets || {}), async ([serviceName, serviceInfo]) => {
    title(serviceName)
    await watch(serviceName, serviceInfo, config.monitorHost).catch(err => { logger.error(err) })
    if (serviceInfo.instanceType === 'pm2') { pm2Connected = true }
  })

  if (pm2Connected) {
    await pm2.disconnect()
  }
}

module.exports = {
  report: report
}
