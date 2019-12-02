#! /usr/bin/env node

const yargs = require('yargs')
const fs = require('fs')

const watch = require('./libs/watch')
const Server = require('./libs/server')

const argv = yargs
  .option('file', {
    alias: 'f',
    description: 'target JSON file',
    type: 'string'
  })
  .help('help')
  .argv

if (argv.file == null) {
  console.error('ERROR: target file required')
  process.exit(1)
}

try {
  const targetFile = JSON.parse(fs.readFileSync(argv.file).toString())
  Object.entries(targetFile.targets).forEach(async ([serviceName, serverInfo]) => {
    try {
      const report = await watch(serviceName, serverInfo)
      console.log(report)
      await new Server(targetFile.monitorHost).submit(report)
    } catch (err) {console.error(err.message)}
  })
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
