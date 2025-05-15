const truth = require('../build/Release/native')

let s

for (let i = 0; i < 1024; i++) {
  s = performance.now()
  const fib = truth.fib(1 << i)
  const fib_dur = performance.now() - s
  s = performance.now()
  const fib_phi = truth.fib_phi(1 << i)
  const fib_phi_dur = performance.now() - s
  if (Buffer.compare(fib, fib_phi) !== 0) {
    console.log(`Failed fib(${i})`)
    break
  }
  console.log(`fib(${1 << i})`)
  console.log(`duration fib: ${fib_dur} fib_phi: ${fib_phi_dur}`)
  console.log(`ret size fib: ${fib.length} fib_phi: ${fib_phi.length} `)
}
