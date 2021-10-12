import Request from './lib/request'

export = (url: string, method?: string) => {
  return new Request(url, method)
}
