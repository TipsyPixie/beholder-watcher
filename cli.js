#! /usr/bin/env node

require('./libs/monkey')

const yargs = require('yargs')
const fs = require('fs').promises
const pm2 = require('pm2')

const watch = require('./libs/watch')
const { title } = require('./libs/utils')

const logger = console

const argv = yargs
  .option('file', {
    alias: 'f',
    description: 'target JSON file',
    type: 'string'
  })
  .help('help')
  .argv

if (argv.file == null) {
  logger.error('ERROR: target file required')
  process.exit(1)
}

const runCmd = async (argv) => {
  const buffer = await fs.readFile(argv.file, { flag: 'r' })
  const description = JSON.parse(buffer.toString())
  let pm2Connected = false
  await Object.entries(description.targets || {}).asyncForEach(async ([serviceName, serviceInfo]) => {
    title(serviceName)
    if (serviceInfo.instanceType === 'pm2') { pm2Connected = true }
    await watch(serviceName, serviceInfo, description.monitorHost)
  })

  if (pm2Connected) {
    await pm2.disconnect()
  }
}

runCmd(argv).catch(err => {
  logger.error(err.message)
  process.exit(2)
})
