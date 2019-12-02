const monkey = require('./libs/pm2wrapper')
monkey.patchPm2()

const yargs = require('yargs')

const argv = yargs
  .option('pm2', {
    alias: 'p',
    description: 'PM2 process name or id list',
    type: 'array'
  })
  .help('help')
  .argv
