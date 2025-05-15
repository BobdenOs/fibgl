function pow2(a) {
  const m = 1
  const low_index = 1
  const high_index = 0
  let z0 = a[low_index] ** 2
  let z1 = (a[low_index] + a[high_index]) ** 2
  let z2 = a[high_index] ** 2

  let mid = (z1 - z2 - z0) + (z0 >> 8)
  return Buffer.from([z2 >> 8, z2 + (mid >> 8), mid, z0])
}

function mult_length_1(a, b) {
  const ret1 = a[0] * b[0]
  const ret0 = ret1 >> 8
  return ret0 ? Buffer.from([ret0, ret1]) : Buffer.from([ret1])
}

function mult_length_2(a, b) {
  const m = 1
  const low_index = 1
  const high_index = 0
  let z0 = a[low_index] * b[low_index]
  let z1 = (a[low_index] + a[high_index]) * (b[low_index] + b[high_index])
  let z2 = a[high_index] * b[high_index]

  let mid = (z1 - z2 - z0) + (z0 >> 8)

  const ret0 = z2 >> 8
  const ret1 = z2 + (mid >> 8)
  const ret2 = mid
  const ret3 = z0
  return !ret0
    ? !ret1
      ? !ret2
        ? Buffer.from([ret3])
        : Buffer.from([ret2, ret3])
      : Buffer.from([ret1, ret2, ret3])
    : Buffer.from([ret0, ret1, ret2, ret3])
}

function mult_length_n(a, b) {
  const middle = a.length / 2
  const a_low = a.subarray(middle)
  const b_low = b.subarray(middle)
  const a_high = a.subarray(0, middle)
  const b_high = b.subarray(0, middle)
  let z0 = mult(a_low, b_low)
  let z1 = mult(add(a_low, a_high), add(b_low, b_high))
  let z2 = mult(a_high, b_high)

  let mid = add(sub(sub(z1, z2), z0), shift_r(z0, middle))

  const ret0 = shift_r(z2, middle * 2)
  const ret1 = add(z2, shift_r(mid, middle))
  const ret2 = shrink(mid, middle)
  const ret3 = shrink(z0, middle)
  return ret0.length === 0 && !ret1.find(b => b != 0)
    ? !ret2.find(b => b != 0)
      ? ret3
      : Buffer.concat([ret2, ret3])
    : Buffer.concat([ret0, ret1, ret2, ret3])
  return Buffer.from([z2 >> 8, add(z2 + shift_r(mid, middle)), mid, z0])
}

function mult(a, b) {
  if (a.length === 0 || b.length === 0) return Buffer.from([0])
  if (a.length === 1 && b.length === 1) return mult_length_1(a, b)

  // Make b the smallest value (idk makes sense to me)
  if (b.length > a.length) {
    const t = b
    a = b
    b = t
  }
  if (a.length % 2 === 1) {
    const na = Buffer.alloc(a.length + 1)
    a.copy(na, 1)
    a = na
  }
  if (a.length != b.length) {
    const nb = Buffer.alloc(a.length)
    b.copy(nb, a.length - b.length)
    b = nb
  }

  // Remove infinite recursion loop by using byte multiply as root
  if (a.length == 2) return mult_length_2(a, b)
  return mult_length_n(a, b)
}

function add(a, b) {
  const big = a.length >= b.length ? a : b
  const ret = Buffer.alloc(big.length + (big[0] & 128 === 128))
  let carry = 0
  for (let i = 1; i <= ret.length; i++) {
    const cur = (a[a.length - i] | 0) + (b[b.length - i] | 0) + carry
    ret[ret.length - i] = cur
    carry = cur >> 8
  }
  return ret
}

function sub(a, b) {
  const big = a.length >= b.length ? a : b
  const ret = Buffer.alloc(big.length - (big[0] & 128 === 128))
  let carry = 0
  for (let i = 1; i <= ret.length; i++) {
    const cur = (a[a.length - i] | 0) - (b[b.length - i] | 0) + carry
    ret[ret.length - i] = cur
    carry = cur >> 8
  }
  return ret
}

function shift_r(a, n) {
  return a.subarray(0, a.length - n)
}
function shift_l(a, n) {
  const ret = Buffer.alloc(a.length + n)
  a.copy(ret, 0)
  return ret
}

function shrink(a, n) {
  return a.subarray(a.length - n)
}

function mult0(a, b) {
  const low_index = 1
  let z0 = a[low_index] * b[low_index]
  return z0 & 255
}

const two = Buffer.from([2])
function fib_kara(n) {
  let a = Buffer.from([0])
  let b = Buffer.from([1])
  let tmp
  // let temp2
  let bit = 1
  for (; bit < n; bit <<= 1) { };
  for (; bit; bit >>= 1) {
    // temp2 = a * b
    tmp = mult(a, a) // a ** 2n
    // temp2 = temp2 << 1n // temp2 * 2n // temp2 + temp2
    a = add(tmp, mult(mult(a, b), two))
    // temp2 = b * b // b ** 2n
    b = add(tmp, mult(b, b)) //temp1 + temp2
    if (n & bit) {
      tmp = a
      a = add(a, b)
      b = tmp
    }
  }
  return a
}

for (let i = 0; i < 100; i++) {
  const f = fib_kara(i)
  console.log(BigInt('0x' + f.toString('hex')))
}
