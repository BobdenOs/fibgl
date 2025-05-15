const fib = require('../lib/fib.js')
const truth = require('../build/Release/native')
const { test } = require('node:test')

const fast = false

let s
let js_dur = 0
let nav_dur = 0
let last = Buffer.from([1])
test(`fib(x)`, () => {
  const fib0Col = {}
  const x = 1
  const mod = (1n << (BigInt(x) * 8n)) - 1n
  for (let i = 0; i <= 30; i++) {
    s = performance.now()
    const ret = last = fast && i > 2 ? fib.mul_phi(last) : fib(i, x)
    js_dur += performance.now() - s

    s = performance.now()
    const exp = truth.fib(i)
    nav_dur += performance.now() - s

    const result = typeof ret === 'bigint' ? ret : typeof ret === 'number' ? BigInt(ret) : BigInt('0x' + ret.toString('hex'))
    const expected = (BigInt('0x' + exp.toString().replaceAll(String.fromCharCode(0), '0')))
    if (expected !== result) throw new Error(`fib(${i}): fail (${result} != ${expected})`)
    else if (!(result in fib0Col)) {
      fib0Col[result] = true
      console.log(`fib(${i}) = ${result.toString().padStart(3, ' ')} uniques ${Object.keys(fib0Col).length}`)
      js_dur = nav_dur = 0
    }
  }

  debugger
})
