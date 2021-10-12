import * as http from 'http'
import * as https from 'https'
import * as path from 'path'
import * as qs from 'querystring'
import { URL } from 'url'
import * as zlib from 'zlib'
import Response from './response'

const supportedCompressions = ['gzip', 'deflate']

export default class Request {
  private url: URL
  private readonly method: string
  private data: string | Buffer | null
  private sendDataAs: 'form' | 'json' | 'buffer' | string | null
  private reqHeaders: { [k: string]: string | number }
  private streamEnabled: boolean
  private compressionEnabled: boolean
  private timeoutTime: number | null
  private readonly resOptions: {
    maxBuffer: number
  }

  constructor (url: string, method = 'GET') {
    this.url = typeof url === 'string' ? new URL(url) : url
    this.method = method
    this.data = null
    this.sendDataAs = null
    this.reqHeaders = {}
    this.streamEnabled = false
    this.compressionEnabled = false
    this.timeoutTime = null

    this.resOptions = {
      maxBuffer: 50 * 1000000
    }

    return this
  }

  query (a1: string | Record<string, string>, a2: string) {
    if (typeof a1 === 'object') {
      Object.keys(a1).forEach((queryKey) => {
        this.url.searchParams.append(queryKey, a1[queryKey])
      })
    } else this.url.searchParams.append(a1, a2)

    return this
  }

  path (relativePath: string) {
    this.url.pathname = path.join(this.url.pathname, relativePath)

    return this
  }

  public body (data: any, sendAs: 'form' | 'json' | 'buffer') {
    this.sendDataAs = typeof data === 'object' && !sendAs && !Buffer.isBuffer(data) ? 'json' : (sendAs ? sendAs.toLowerCase() : 'buffer')
    this.data = this.sendDataAs === 'form' ? qs.stringify(data) : (this.sendDataAs === 'json' ? JSON.stringify(data) : data)

    return this
  }

  public header (a1: string | Record<string, string>, a2: string) {
    if (typeof a1 === 'object') {
      Object.keys(a1).forEach((headerName) => {
        this.reqHeaders[headerName.toLowerCase()] = a1[headerName]
      })
    } else this.reqHeaders[a1.toLowerCase()] = a2

    return this
  }

  public timeout (timeout: number) {
    this.timeoutTime = timeout

    return this
  }

  public stream () {
    this.streamEnabled = true

    return this
  }

  public compress () {
    this.compressionEnabled = true

    if (!this.reqHeaders['accept-encoding']) this.reqHeaders['accept-encoding'] = supportedCompressions.join(', ')

    return this
  }

  public send (): Promise<Response> {
    return new Promise((resolve, reject) => {
      if (this.data) {
        if (!this.reqHeaders.hasOwnProperty('content-type')) {
          if (this.sendDataAs === 'json') {
            this.reqHeaders['content-type'] = 'application/json'
          } else if (this.sendDataAs === 'form') {
            this.reqHeaders['content-type'] = 'application/x-www-form-urlencoded'
          }
        }

        if (!this.reqHeaders.hasOwnProperty('content-length')) {
          this.reqHeaders['content-length'] = Buffer.byteLength(this.data)
        }
      }

      const options = {
        protocol: this.url.protocol,
        host: this.url.hostname,
        port: this.url.port,
        path: this.url.pathname + this.url.search ?? '',
        method: this.method,
        headers: this.reqHeaders
      }

      let req: any

      const Handler = (res: any) => {
        let stream = res

        if (this.compressionEnabled) {
          if (res.headers['content-encoding'] === 'gzip') {
            stream = res.pipe(zlib.createGunzip())
          } else if (res.headers['content-encoding'] === 'deflate') {
            stream = res.pipe(zlib.createInflate())
          }
        }

        let Res: Response

        if (this.streamEnabled) {
          resolve(stream)
        } else {
          Res = new Response(res)

          stream.on('error', (err: Error) => {
            reject(err)
          })

          stream.on('aborted', () => {
            reject(new Error('Server aborted request'))
          })

          stream.on('data', (chunk: any) => {
            Res.addChunk(chunk)

            if (this.resOptions.maxBuffer !== null && Res.body.length > this.resOptions.maxBuffer) {
              stream.destroy()

              reject(Error('Received a response which was longer than acceptable when buffering. (' + this.body.length + ' bytes)'))
            }
          })

          stream.on('end', () => {
            resolve(Res)
          })
        }
      }

      if (this.url.protocol === 'http:') {
        req = http.request(options, Handler)
      } else if (this.url.protocol === 'https:') {
        req = https.request(options, Handler)
      } else throw new Error('Bad URL protocol: ' + this.url.protocol)

      if (this.timeoutTime) {
        req.setTimeout(this.timeoutTime, () => {
          req.abort()

          if (!this.streamEnabled) {
            reject(new Error('Timeout reached'))
          }
        })
      }

      req.on('error', (err: Error) => {
        reject(err)
      })

      if (this.data) req.write(this.data)

      req.end()
    })
  }
}
