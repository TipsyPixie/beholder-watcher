#! /usr/bin/env node

const yargs = require('yargs')
const fs = require('fs')
const watch = require('./libs/watch')

const argv = yargs
  .option('file', {
    alias: 'f',
    description: 'target JSON file',
    type: 'object'
  })
  .help('help')
  .argv

if (argv.file == null) {
  console.error('ERROR: target file required')
  process.exit(1)
}

try {
  const targetFile = JSON.parse(fs.readFileSync(argv.file).toString())
  Object.entries(targetFile.targets).forEach(([serverName, serverInfo]) => {
    watch(serverName, serverInfo).then(console.log)
  })
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
