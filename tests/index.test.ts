import { equal } from 'assert'
import request from '../src/index'

export async function get() {
  equal(typeof await request('https://jsonplaceholder.typicode.com/posts/1').send(), 'object')
}

export async function post() {
  const req = await request('https://jsonplaceholder.typicode.com/posts', 'POST').body({
    title: 'foo',
    body: 'bar',
    userId: 1
  }, 'json').send()

  equal(typeof req.json, 'object')
}
