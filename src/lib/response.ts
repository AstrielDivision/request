import type * as http from 'http'

export default class Response {
  resOptions: any
  public body: Buffer
  private readonly statusCode: http.IncomingMessage['statusCode']
  constructor (res: any) {
    this.body = Buffer.alloc(0)

    this.statusCode = res.statusCode
  }

  public addChunk (chunk: any) {
    this.body = Buffer.concat([this.body, chunk])
  }

  get json () {
    return this.statusCode === 204 ? null : JSON.parse(this.body as any)
  }

  get text () {
    return this.body.toString()
  }

  get buffer() {
    return Buffer.from(this.body)
  }
}
