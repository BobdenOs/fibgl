function power(x, y, p) {
  // Initialize result
  let res = 1
  if (x == 0) return x;
  while (y > 0) {
    if (y & 1) {
      res = res * x
    }
    y = y >> 1 // y / 2
    x = (x * x)
  }
  console.log('res', res, 'x', x)
  return Math.round(res);
}

const sqrt_five = Math.sqrt(5)
const phi = (sqrt_five + 1) / 2

for (let i = 2; i < 10; i++) {
  console.log(
    Math.round(power(phi, i) / sqrt_five)
  )
}