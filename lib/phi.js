const fs = require('fs')

const Decimal = require("decimal.js")

// Read desired precision from command-line argument, default to 100 if not provided. 
const precisionArg = process.argv[2]
const precision = (precisionArg ? parseInt(precisionArg, 10) : 64) + 1

// Set the global precision for Decimal calculations.
Decimal.set({ precision: precision })

// Compute phi = (1 + sqrt(5))/2
const one = new Decimal(1)
const five = new Decimal(5)
const sqrtFive = five.sqrt()
const phi = one.plus(sqrtFive).dividedBy(2)

const hex = phi.toHex().slice(4)
fs.writeFileSync(__dirname + '/phi.hex', hex)
fs.writeFileSync(__dirname + '/phi.bin', Buffer.from(hex, 'hex'))
