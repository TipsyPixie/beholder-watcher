const { get, post } = require('request-promise-native')

const logger = console

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const retryingRequest = async (method, options) => {
  const maxRetry = (options.retry > 0) ? options.retry : 0
  const delayFactor = (options.delayFactor > 0) ? options.delayFactor : 2
  const initialDelay = (options.delay > 0) ? options.delay : 100

  let retryCount = 0
  let delay = initialDelay
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

const requestRpc = async ({ method, params, jsonrpc, id, ...options }) => (await beholderPost({
  ...options,
  body: {
    jsonrpc: jsonrpc || '2.0',
    method: method,
    params: params || [],
    id: id || 1
  }
})).result

const asyncForEach = async function (array, fn) {
  for (let index = 0; index < array.length; index++) {
    await fn(array[index], index, array)
  }
}

module.exports = {
  round: (value, precision = 4) => parseFloat(value.toPrecision(precision)),
  title: (message) => { logger.info(`------------------------------ ${message} ------------------------------`) },
  subtitle: (message) => { logger.info(`* ${message}`) },
  get: beholderGet,
  post: beholderPost,
  requestRpc: requestRpc,
  asyncForEach: asyncForEach
}
