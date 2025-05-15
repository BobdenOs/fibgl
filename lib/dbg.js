const fs = require('fs')

// const phi = 1.618033988749894848204586834
const phi = Buffer.from(fs.readFileSync(__dirname + '/phi.hex', 'utf-8'), 'hex') // 0.618033988749894848204586834

function shift(nr, shift) {
  const bytes = shift / 8
  const bytesFloor = Math.floor(bytes)
  const bytesCeil = Math.ceil(bytes)
  const bits = (bytes - bytesFloor) * 8

  const ret = Buffer.alloc(nr.length + bytesCeil)
  for (let i = nr.length; i > bytes * -1; i--) {
    ret[i + bytesFloor] = nr[i] >> bits | (nr[i - 1] | 0) << 8 - bits
  }
  return ret
}

function log(nr) {
  console.log([...new Uint8Array(nr)].map(n => n.toString(2).padStart(8, '0')).join(' '))
}

function mul_phi_(a) {
  const ret = Buffer.alloc(a.length)
  a.copy(ret, 0)

  const stacks = []

  for (let x = phi.length - 1; x > -1; x--) {
    const offset = x * 8
    const curPhi = phi[x]
    if (curPhi & 0b10000000) stacks.push(shift(a, offset + 1))
    if (curPhi & 0b01000000) stacks.push(shift(a, offset + 2))
    if (curPhi & 0b00100000) stacks.push(shift(a, offset + 3))
    if (curPhi & 0b00010000) stacks.push(shift(a, offset + 4))
    if (curPhi & 0b00001000) stacks.push(shift(a, offset + 5))
    if (curPhi & 0b00000100) stacks.push(shift(a, offset + 6))
    if (curPhi & 0b00000010) stacks.push(shift(a, offset + 7))
    if (curPhi & 0b00000001) stacks.push(shift(a, offset + 8))
  }

  let carry = 0
  for (let y = stacks.at(0).length - 1; y > -1; y--) {
    let cur = (ret[y] || 0) + carry
    for (const s of stacks) {
      cur += (s[y] || 0)
    }
    carry = cur >> 8
    ret[y] = cur
  }
  stacks.forEach(s => log(s))
  log(a)
  log(ret)
  return ret
}

module.exports = function fib(n) {
  if (n <= 1) return n
  if (n === 2) return 1
  return Math.round(fib(n - 1) * phi)
}

module.exports = function fib(n) {
  if (n <= 1) return Buffer.from([n])
  if (n === 2) return Buffer.from([1])
  if (n === 3) return Buffer.from([2])
  return mul_phi(fib(n - 1))
}

module.exports.mul_phi = mul_phi
