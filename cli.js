#! /usr/bin/env node

require('./libs/monkey')

const yargs = require('yargs')
const fs = require('fs').promises

const watch = require('./libs/watch')

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
  await Object.entries(description.targets || {}).asyncForEach(async ([serviceName, serviceInfo]) => {
    const report = await watch(serviceName, serviceInfo, description.monitorHost)
    logger.info(report)
  })
}

runCmd(argv).catch(err => {
  logger.error(err.message)
  process.exit(2)
})
