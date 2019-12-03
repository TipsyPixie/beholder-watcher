const { post } = require('request-promise-native')

class Server {
  constructor (uri, version=1) {
    this.uri = `${encodeURI(uri)}/api/v${version}`
  }

  async submit (report) {
    return post({
      uri: `${encodeURI(this.uri)}/reports`,
      headers: { 'User-Agent': 'Beholder-Watcher' },
      body: report,
      json: true
    })
  }
}

module.exports = Server