const fs = require('fs')

const fib = require('./fib.js')

const lastFileName = __dirname + '/last.hex'

let i
let last
try {
  const file = fs.readFileSync(lastFileName, 'utf-8').split('\n')
  i = Number(file[0])
  last = Buffer.from(file[1], 'hex')
} catch {
  i = 4 // fib(4) = 3
  last = Buffer.from([3])
}

const start = Date.now()
for (; Date.now() - start < 1000; i++) {
  last = fib.mul_phi(last)
}

fs.writeFileSync(lastFileName, `${i}\n${last.toString('hex')}`)
