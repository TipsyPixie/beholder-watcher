const { post } = require('./utils')

class Server {
  constructor (uri, version = 1) {
    this.uri = `${encodeURI(uri)}/api/v${version}`
  }

  async submit (report) {
    return post({
      uri: `${encodeURI(this.uri)}/reports`,
      body: report
    })
  }
}

module.exports = Server
