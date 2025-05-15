import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

function sendError(req, res, err) {
  res.statusCode = 404
  res.end(`Failed to find file "${req.url}"\n${err.message}`)
}

const mimes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
}

const srv = http.createServer((req, res) => {
  console.log(req.socket.remoteAddress)
  try {
    req.url = req.url.split(/[?#]/)[0]
    if (req.url === '/') req.url = '/index.html'
    const fd = fs.createReadStream(import.meta.dirname + req.url)
    fd.on('error', err => sendError(req, res, err))
    res.statusCode = 200

    res.setHeader('content-type', mimes[path.extname(req.url)] || 'plain/text')
    res.setHeader('Transfer-Encoding', 'chunked')
    fd.pipe(res)
  } catch (err) {
    sendError(req, res, err)
  }
})

srv.listen(8080, err => {
  if (err) {
    console.error(err.stack)
    process.exit(1)
  }
  console.log('listening on port 8080')
})