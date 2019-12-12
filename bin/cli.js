#! /usr/bin/env node

const yargs = require('yargs')
const fs = require('fs').promises

const { report } = require('../index')

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
  logger.error('ERROR: target file required. try --help')
  process.exit(1)
}

const runCmd = async (argv) => {
  const buffer = await fs.readFile(argv.file, { flag: 'r' })
  await report(JSON.parse(buffer.toString()))
}

runCmd(argv).catch(err => {
  logger.error(err.message)
  process.exit(2)
})
