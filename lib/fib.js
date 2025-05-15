const fs = require('fs')

const phi = loadPhi() // 0.618033988749894848204586834

function pick(nr, index, shift) {
  const bytes = shift / 8
  const bytesFloor = Math.floor(bytes)

  if ( // Check whether index is inside shift bounds
    index < bytesFloor ||
    nr.length + Math.ceil(bytes) <= index
  ) return 0

  const bits = (bytes - bytesFloor) * 8
  return (nr[index - bytesFloor] >> bits | (nr[index - bytesFloor - 1] | 0) << 8 - bits) & 0b11111111
}

function loadPhi() {
  try {
    return Buffer.from(fs.readFileSync(__dirname + '/phi.hex', 'utf-8'), 'hex')
  } catch {
    require('./phi')
    return loadPhi()
  }
}

function mul_phi(a) {
  const ret = Buffer.alloc(a.length)
  a.copy(ret, 0)

  let carry = 0
  // Start computing the carry outside of the number range
  // So that the carry can bubble into the number range
  for (let i = ret.length; i >= 0; i--) {
    let cur = (ret[i] | 0) + carry
    for (let x = phi.length - 1; x >= 0; x--) {
      const offset = x * 8
      const curPhi = phi[x]
      if (curPhi & 0b10000000) cur += pick(a, i, offset + 1)
      if (curPhi & 0b01000000) cur += pick(a, i, offset + 2)
      if (curPhi & 0b00100000) cur += pick(a, i, offset + 3)
      if (curPhi & 0b00010000) cur += pick(a, i, offset + 4)
      if (curPhi & 0b00001000) cur += pick(a, i, offset + 5)
      if (curPhi & 0b00000100) cur += pick(a, i, offset + 6)
      if (curPhi & 0b00000010) cur += pick(a, i, offset + 7)
      if (curPhi & 0b00000001) cur += pick(a, i, offset + 8)
    }
    carry = cur >> 8

    // Add Rounding behavior
    // When i is equal to the ret.length
    // It means it is the bit before the whole numbers
    // If the first bit is set it means it is 0.5 or higher
    // As the logic requires a Math.round
    // If the bit is set it should actually carry up
    if (ret.length === i && cur & 0b10000000) carry += 1

    ret[i] = cur & 0b11111111
  }
  if (!carry) return ret
  const lret = Buffer.alloc(ret.length + 1)
  ret.copy(lret, 1)
  lret[0] = carry
  return lret
}

function mul_phi_byte(a, n) {
  let ret = 0
  let carry = 0
  // Start computing the carry outside of the number range
  // So that the carry can bubble into the number range
  for (let i = n + 5; i >= n; i--) {
    let cur = (a[i] | 0) + carry
    for (let x = phi.length - 1; x >= 0; x--) {
      const offset = x * 8
      const curPhi = phi[x]
      if (curPhi & 0b10000000) cur += pick(a, i, offset + 1)
      if (curPhi & 0b01000000) cur += pick(a, i, offset + 2)
      if (curPhi & 0b00100000) cur += pick(a, i, offset + 3)
      if (curPhi & 0b00010000) cur += pick(a, i, offset + 4)
      if (curPhi & 0b00001000) cur += pick(a, i, offset + 5)
      if (curPhi & 0b00000100) cur += pick(a, i, offset + 6)
      if (curPhi & 0b00000010) cur += pick(a, i, offset + 7)
      if (curPhi & 0b00000001) cur += pick(a, i, offset + 8)
    }
    carry = cur >> 8

    // Add Rounding behavior
    // When i is equal to the ret.length
    // It means it is the bit before the whole numbers
    // If the first bit is set it means it is 0.5 or higher
    // As the logic requires a Math.round
    // If the bit is set it should actually carry up
    if (a.length === i && cur & 0b10000000) carry += 1

    ret = cur & 0b11111111
  }
  return ret
}

module.exports = function fib(n) {
  if (n <= 1) return Buffer.from([n])
  if (n === 2) return Buffer.from([1])
  if (n === 3) return Buffer.from([2])
  return mul_phi(fib(n - 1))
}

module.exports.mul_phi = function (a) {
  const ret = Buffer.alloc(a.length + 1)
  for (let i = 0; i < ret.length; i++) {
    ret[i] = mul_phi_byte(a, i - 1)
  }
  if (ret[0] === 0) return ret.subarray(1)
  return ret
}

// Attempt to understand gmp lib npm_fib
module.exports = function (n) {
  let mask = 1
  for (let i = n; i > -1; i /= 2) mask <<= 1
  let f1p = 0
  let fp = 0
  let size = 1

  let xp

  while (mask != 1) {
    xp = fp * fp
    fp = f1p * f1p
    size *= 2

    f1p = xp + fp

    fp |= (n & mask ? 2 : 0)
  }

}

// Attempt to understand some fib implementation of some blog post
module.exports = function (n) {
  let a = BigInt(0)
  let b = BigInt(1)
  let tmp
  // let temp2
  let bit = 1
  for (; bit < n; bit <<= 1) { };
  for (; bit; bit >>= 1) {
    // temp2 = a * b
    tmp = a * a // a ** 2n
    // temp2 = temp2 << 1n // temp2 * 2n // temp2 + temp2
    a = tmp + (a * b << 1n)
    // temp2 = b * b // b ** 2n
    b = tmp + b * b //temp1 + temp2
    if (n & bit) {
      tmp = a
      a = a + b
      b = tmp
    }
  }
  return a
}

module.exports.fib0 = function (n) {
  let a = BigInt(0)
  let b = BigInt(1)
  let tmp
  // let temp2
  let bit = 1
  let step = 0
  for (; bit < n; bit <<= 1) { };
  for (; bit; bit >>= 1) {
    // temp2 = a * b
    tmp = (a * a) & 255n // a ** 2n
    // temp2 = temp2 << 1n // temp2 * 2n // temp2 + temp2
    a = (tmp + (((a * b) & 255n) << 1n & 255n) & 255n)
    // temp2 = b * b // b ** 2n
    b = tmp + (b * b & 255n) & 255n   //temp1 + temp2
    if (n & bit) {
      tmp = a
      a = a + b & 255n
      b = tmp
    }
  }
  return a
}

module.exports.fibX = function (n, x) {
  let a = BigInt(0)
  let b = BigInt(1)
  let tmp
  // let temp2
  let bit = 1
  const mod = (1n << (BigInt(x) * 8n)) - 1n
  for (; bit < n; bit <<= 1) { };
  for (; bit; bit >>= 1) {
    // temp2 = a * b
    tmp = (a * a) & mod // a ** 2n
    // temp2 = temp2 << 1n // temp2 * 2n // temp2 + temp2
    a = (tmp + (((a * b) & mod) << 1n & mod) & mod)
    // temp2 = b * b // b ** 2n
    b = tmp + (b * b & mod) & mod   //temp1 + temp2
    if (n & bit) {
      tmp = a
      a = a + b & mod
      b = tmp
    }
  }
  return a >> (BigInt(x - 1) * 8n)
}