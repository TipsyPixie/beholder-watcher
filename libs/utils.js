const logger = console

module.exports = {
  ceil: (value, precision = 4) => Math.ceil(value * Math.pow(10, precision)) / Math.pow(10, precision),
  title: (message) => { logger.info(`------------------------------ ${message} ------------------------------`) },
  subtitle: (message) => { logger.info(`* ${message}`) }
}
