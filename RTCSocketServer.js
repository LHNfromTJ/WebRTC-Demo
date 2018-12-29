const WebSocketServer = require('ws').Server
const UUID = require('node-uuid')
const events = require('events')
const util = require('util')

class RTCSocket {
	constructor() {
		// 所有连接的用户（其实就是每一个socket）list
		this.users = []
		this.on('BROWSER_join', this.join)
		this.on('BROWSER_ice_candidate', this.ice_candidate)
		// 接收到呼叫方的offer信令
		this.on('BROWSER_offer', this.offer)
		// 接收到answer回应
		this.on('BROWSER_answer', this.answer)
	}

	socketSend(socket, eventName, data = {}) {
		socket.send(JSON.stringify({
			eventName: `SOCKET_${eventName}`,
			data
		}), (error) => {
			error && this.emit('log_error', eventName, socket.id, error)
		})
	}

	log(eventName, ...arg) {
		this.emit(`LOG_${eventName}`, ...arg)
	}

	init(socket) {
		// 给socket设置一个id
		socket.id = UUID.v4()
		this.users.push(socket)
		// 接收数据
		socket.on('message', (json) => {
			const data = JSON.parse(json)
			if (data.eventName) this.emit(data.eventName, socket, data.data)
		})
		socket.on('close', () => {
			// 从用户列表中删除
			this.removeUser(socket)
			for (const user of this.users) {
				// 通知其他用户，有一个用户断开了连接
				this.socketSend(user, 'leave_user', {
					socketId: socket.id
				})
			}
			this.log('leave_user', socket)
		})
		this.log('new_connect', socket)
	}

	findUser(socketId) {
		return this.users.find(user => user.id === socketId)
	}

	removeUser(socket) {
		const index = this.users.findIndex(user => user.id === socket.id)
		this.users.splice(index, 1)
	}

	join(socket) {
		const ids = []
		for (const user of this.users) {
			// 不用通知自己
			if (user.id === socket.id) continue
			// ids维护了一个除了新进来用户的id列表
			ids.push(user.id)
			// 告诉其他的所有用户，新进来了一个用户
			this.socketSend(user, 'add_user', {
				socketId: socket.id
			})
		}
		this.socketSend(socket, 'success_join', {
			connections: ids
		})
		this.log('add_user', socket)
	}

	ice_candidate(socket, data) {
		const user = this.findUser(data.socketId)
		if (user) {
			// this.socketSend(user, 'ice_candidate', {
			// 	label: data.label,
			// 	candidate: data.candidate,
			// 	socketId: socket.id
			// })
			this.socketSend(user, 'ice_candidate', {
				socketId: socket.id,
				candidateObj: data.candidateObj
			})
			this.log('ice_candidate', socket)
		}
	}

	offer(socket, data) {
		const user = this.findUser(data.socketId)
		if (user) {
			this.socketSend(user, 'offer', {
				sdp: data.sdp, // 这里的sdp指的是发送offer的用户
				socketId: socket.id // 这里的id指的是发送offer的用户
			})
			this.log('offer', socket)
		}
	}

	answer(socket, data) {
		const user = this.findUser(data.socketId)
		if (user) {
			this.socketSend(user, 'answer', {
				sdp: data.sdp, // 这里的sdp指的是发送answer的用户
				socketId: socket.id // 这里的id指的是发送answer的用户
			})
			this.log('answer', socket)
		}
	}
}

// 继承EventEmitter的原型函数，使之拥有emit，on方法
util.inherits(RTCSocket, events.EventEmitter)

module.exports.connect = function (server) {
	const RTCSocketServer = new WebSocketServer({
		server
	})
	// 给webscoket挂载rtc
	RTCSocketServer.RTCSocket = new RTCSocket()
	RTCSocketServer.on('connection', function (socket) {
		// 当用户连接到scoket时，初始化
		this.RTCSocket.init(socket)
	})

	return RTCSocketServer
}