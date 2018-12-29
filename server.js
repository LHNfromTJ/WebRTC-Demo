const express = require('express')
const app = express()
// 把app丢进去，返回的是一个真正的server
const server = require('http').createServer(app)
const RTCSocketServer = require('./RTCSocketServer.js').connect(server)
const path = require("path")
const log = require('./log')

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html')
})
app.get('/getUserMedia', function(req, res) {
	res.sendFile(__dirname + '/getUserMedia.html')
})
app.get('/demo', function(req, res) {
	res.sendFile(__dirname + '/demo.html')
})

log(RTCSocketServer.RTCSocket)

const port = 9090
server.listen(port)
console.log(`服务启动成功，请打开http://localhost:${port}`)

