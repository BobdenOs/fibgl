let maxCarry = 0
function mul_x(a, b, size, x, cc = 0) {
  let ret = 0
  let src = x - b.length
  const trace = !cc ? console.log : () => { }
  trace('mul:', x)
  for (let i = b.length - 1; i > -1; i--) {
    const c = src++
    if (c < -1) continue
    if (c >= a.length) break
    trace('c1:', c, a[c + 1], 'i:', i, b[i], 'result:', (((a[c + 1] | 0) * b[i]) >> 8) & 255)
    trace('c0:', c, a[c], 'i:', i, b[i], 'result:', ((a[c] | 0) * b[i]) & 255)
    ret += ((a[c] | 0) * b[i]) & 255
    ret += (((a[c + 1] | 0) * b[i]) >> 8) & 255
  }
  const org = x + cc
  if (
    // Taking from karatsuba principle
    // top and bottom 25% of the result cannot be influenced
    // while the middle can be influenced by everything
    (!cc ||
      (org < size * 0.75 && x <= size * 0.75) ||
      (org >= size * 0.75)
    ) &&
    x + 1 < size) {
    const carry = mul_x(a, b, size, x + 1, cc + 1) >> 8
    if (carry > maxCarry) maxCarry = carry
    ret += carry
  }
  return ret
}

function mul(a, b) {
  a = buffer(a)
  b = buffer(b)
  const size = a.length + b.length
  c = Buffer.alloc(size)
  if (b.length > a.length) {
    const t = a
    a = b
    b = t
  }
  for (let i = 0; i < c.length; i++) {
    c[i] = mul_x(a, b, size, i)
  }
  return c
}

function pow2_x(a, b, size, x, cc = 0) {
  let ret = 0
  const src = x - b.length
  const trace = !cc ? console.log : () => { }
  trace('pow2:', x)

  // TODO: find middle point
  // stop at the middle point and double `ret`
  // if the length is not divisable by 2 add the middle point only once
  let o = 0
  let i = b.length - 1
  if (x < b.length) { // Skip some loop steps when possible
    o = (b.length - 1) - x
    i = x
  }
  const start = i
  const end = Math.max(-1, src - 1)
  const mid = Math.floor((i - end) / 2)
  const odd = end & 1
  trace(i, end, end + mid, src)
  for (; i > end + mid; i--) {
    const c = src + o++
    if (i === mid && odd) {
      ret = (ret * 2) & 255
    }
    const c1 = ((a[c + 1] | 0) * b[i]) * (
      src >= 0 && i === end ? 1 : 2
    )
    // When `src < 0 && i === start` is true `a[c]` will be `undefined`
    // Therefor it would be better to start from the other direction
    const c0 = (a[c] | 0) * b[i] * (
      src < 0 && i === start ? 1 : 2
    )
    trace('c1:', c, a[c + 1], 'i:', i, b[i], 'result:', (c1 >> 8) & 255, 'org:', (((a[c + 1] | 0) * b[i]) >> 8) & 255)
    trace('c0:', c, a[c], 'i:', i, b[i], 'result:', c0 & 255, 'org:', ((a[c] | 0) * b[i]) & 255)
    ret += (c1 >> 8) & 255
    ret += c0 & 255
  }
  if (!odd) {
    ret = (ret * 2) & 255
  }
  const org = x + cc
  if (
    // Taking from karatsuba principle
    // top and bottom 25% of the result cannot be influenced
    // while the middle can be influenced by everything
    (!cc ||
      (org < size * 0.75 && x <= size * 0.75) ||
      (org >= size * 0.75)
    ) &&
    x + 1 < size) {
    const carry = pow2_x(a, b, size, x + 1, cc + 1) >> 8
    if (carry > maxCarry) maxCarry = carry
    ret += carry
  }
  return ret
}

function pow2(a) {
  a = buffer(a)
  const size = a.length * 2
  c = Buffer.alloc(size)
  for (let i = 0; i < c.length; i++) {
    c[i] = pow2_x(a, a, size, i)
  }
  return c
}

function buffer(n) {
  const str = n.toString(16)
  return Buffer.from(str.length & 1 ? '0' + str : str, 'hex')
}

function rand(n) {
  if (n) {
    let ret = rand()
    for (; n > -1; n--) {
      ret *= rand()
    }
    return ret
  }
  return BigInt(Math.round(Math.random() * (1 << 30)))
}

let s
for (let i = 1; i < 2; i++) {
  const size = 1 << 30
  // BigInt('0xffff') // 
  const a = rand(i)
  const expect = a ** 2n

  s = performance.now()
  const mul_res = mul(a, a)
  const mul_dur = performance.now() - s

  s = performance.now()
  const pow2_res = pow2(a)
  console.log('mul:', mul_dur, 'pow2', performance.now() - s)
  const pow2_result = BigInt('0x' + pow2_res.toString('hex'))
  const mul_result = BigInt('0x' + mul_res.toString('hex'))
  console.log('a:', a)
  console.log('expect:', expect)
  console.log('mul(a,a):', mul_result)
  console.log('pow2(a):', pow2_result)
  console.log('carry:', maxCarry)
  maxCarry = 0
  if (pow2_result !== expect || mul_result !== expect) {
    debugger
    mul(a, a)
    throw new Error('Failed')
  }
}

/*
0000 1111
0000 1111
---------
0000 1111
0001 1110
0011 1100
0111 1000
1111 0000
*/