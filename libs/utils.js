const { get, post } = require('request-promise-native')

const logger = console

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const retryingRequest = async (method, options) => {
  const maxRetry = (options.retry > 0) ? options.retry : 0
  const delayFactor = (options.delayFactor > 0) ? options.delayFactor : 2

  let retryCount = 0
  let delay = options.delay || 100
  while (true) {
    try {
      return await method(options)
    } catch (err) {
      if (retryCount++ <= maxRetry) {
        await sleep(delay)
        delay *= delayFactor
      } else {
        throw err
      }
    }
  }
}

const defaultRequestOptions = {
  headers: { 'User-Agent': 'Beholder-Watcher' },
  json: true,
  timeout: 5000,
  followRedirect: true,
  maxRedirects: 10,
  retry: 3
}

const beholderGet = async (options) => retryingRequest(get, { ...defaultRequestOptions, ...options })

const beholderPost = async (options) => retryingRequest(post, { ...defaultRequestOptions, ...options })

const callRpc = async ({ method, params, jsonrpc, id, ...options }) => (await beholderPost({
  ...options,
  body: {
    jsonrpc: jsonrpc || '2.0',
    method: method,
    params: params || [],
    id: id || 1
  }
})).result

module.exports = {
  round: (value, precision = 4) => Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision),
  title: (message) => { logger.info(`------------------------------ ${message} ------------------------------`) },
  subtitle: (message) => { logger.info(`* ${message}`) },
  get: beholderGet,
  post: beholderPost,
  callRpc: callRpc
}
