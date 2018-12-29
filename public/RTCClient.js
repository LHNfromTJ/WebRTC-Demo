class RTCClient {
    constructor() {
        // 事件中心
        this.events = {}
        // 本地media stream
        this.localMediaStream = null
        // 本地WebSocket连接
        this.socket = null
        // 所有与本地相连的peer connection， 键为socket id，值为PeerConnection类型
        this.peerConnections = {}
        // 所有与本地连接的socket的id
        this.connections = []
        // 所有的data channel，键为socket id，值通过PeerConnection实例的createChannel创建
        this.dataChannels = {}
    }
    // 实现一个emit与on的监听触发功能
    on(eventName, handle) {
        this.events[eventName] = this.events[eventName] || []
        this.events[eventName].push(handle)
    }

    emit(eventName, ...args) {
        const events = this.events[eventName]
        for (const key in events) {
            events[key].call(this, ...args)
        }
    }

    log(eventName, ...arg) {
        this.emit(`LOG_${eventName}`, ...arg)
    }

    // 本地连接信道，信道为websocket
    connect(serverHref, userInfo) {
        const socket = this.socket = new WebSocket(serverHref)
        // webscoket建立连接
        socket.onopen = () => {
            // 连接成功，通知服务器我要加入聊天室
            this.socketSend(socket, 'join')
            this.userInfo = userInfo
        }
        // webscoket接收到消息
        socket.onmessage = (e) => {
            const data = JSON.parse(e.data)
            if (data.eventName) this.emit(data.eventName, data.data)
        }
        socket.onclose = () => {
            // 关闭视频
            this.localMediaStream.close()
            // 关闭数据通道
            for (const key in this.peerConnections) {
                this.peerConnections[key].close()
            }
            // 清空所有数据
            this.peerConnections = {}
            this.dataChannels = {}
            this.connections = []
        }
        this.listenEvent()
    }

    socketSend(socket, eventName, data = {}) {
        socket.send(JSON.stringify({
            eventName: `BROWSER_${eventName}`,
            data
        }))
    }

    listenEvent() {
        // 用户加入成功
        this.on('SOCKET_success_join', (data) => {
            this.log('success_join')
            // 保存当前所有连接的id列表
            this.connections = data.connections
            // 通知客户端已经与服务器连接成功
            this.emit('connectd')
        })
        this.on('SOCKET_ice_candidate', (data) => {
            this.log('receive_ice_candidate')
            // const iceCandidate = new RTCIceCandidate(data)
            // const iceCandidate = new RTCIceCandidate(data.candidateObj)
            const pc = this.peerConnections[data.socketId]
            // 收集对方的ice候选信息以进行协商
            // pc.addIceCandidate(iceCandidate)
            pc.addIceCandidate(data.candidateObj)
        })
        // 房间中的其他用户接收到新用户连接
        this.on('SOCKET_add_user', (data) => {
            this.log('add_user')
            // 添加id
            this.connections.push(data.socketId)
            const pc = this.createPeerConnection(data.socketId)
            // 将本地的媒体流添加进PeerConnection中，用于共享
            pc.addStream(this.localMediaStream)
        })
        this.on('SOCKET_leave_user', (data) => {
            const pc = this.peerConnections[data.socketId]
            pc && pc.close()
            delete this.peerConnections[data.socketId]
            delete this.dataChannels[data.socketId]
            // 通知客户端离开了一名用户
            this.emit('leave_user', data.socketId)
        })
        // 接收到新用户的offer信令
        this.on('SOCKET_offer', (data) => {
            this.log('receive_offer')
            // 找到这个新用户
            const pc = this.peerConnections[data.socketId]
            // 设置对方的sdp，为了配对用
            // pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
            pc.setRemoteDescription(data.sdp)
            // 进行应答
            pc.createAnswer(
                // 这里的sdp全称Session Description Protocal
                (sdp) => {
                    this.log('create_answer')
                    pc.setLocalDescription(sdp)
                    this.socketSend(this.socket, 'answer', {
                        socketId: data.socketId,
                        sdp
                    })
                },
                (error) => {
                    console.log(error)
                }
            )
        })
        // 接收到answer信令后将对方的sdp写入PeerConnection中
        this.on('SOCKET_answer', (data) => {
            this.log('receive_answer')
            const pc = this.peerConnections[data.socketId]
            // pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
            pc.setRemoteDescription(data.sdp)
        })
        // 创建与其他用户的连接
        this.on('other_connect', this.otherConnect)
    }
    // 创建本地流
    async createLocalStream(constraints) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            this.log('stream_created')
            this.localMediaStream = stream
            // 创建成功通知客户端
            this.emit('stream_created', stream)
            this.emit('other_connect')
        } catch(error) {
            console.log(error)
        }
    }

    otherConnect() {
        if (this.connections.length === 0) return
        this.log('other_connect')
        // 创建与其他用户连接的PeerConnections
        this.createPeerConnections()
        // 将本地流添加到所有的PeerConnection实例中，使其他的用户可以看到本机视频
        this.addStreams()
        // 对所有的PeerConnections创建Data channel用于传输信息
        this.addDataChannels()
        // 向所有PeerConnection发送Offer信令
        this.sendOffers()
    }

    createPeerConnections() {
        for (const connection of this.connections) {
            this.createPeerConnection(connection)
        }
    }

    addStreams() {
        for (const id in this.peerConnections) {
            this.peerConnections[id].addStream(this.localMediaStream)
        }
    }

    addDataChannels() {
        for (const id in this.peerConnections) {
            const pc = this.peerConnections[id]
            this.addDataChannel(id, pc.createDataChannel(id))
        }
    }
    // 循环所有已连接的用户，不包括自身
    sendOffers() {
        for (const connection of this.connections) {
            const pc = this.peerConnections[connection]
            // 发起一个呼叫，我理解的就是创建一个本地的描述
            // 用来唯一标示这个peerConnection，用于和其他浏览器的进行配对
            pc.createOffer(
                (sdp) => {
                    this.log('create_offer')
                    pc.setLocalDescription(sdp)
                    this.socketSend(this.socket, 'offer', {
                        sdp,
                        socketId: connection
                    })
                },
                (error) => {
                    console.log(error)
                }
            )
        }
    }

    createPeerConnection(socketId) {
        // window.RTCPeerConnection在最新版chrome(71.x)上还没有支持，还是有些兼容性问题的
        const pc = new webkitRTCPeerConnection({
            iceServers: [
                {
                    url: 'stun:stun.l.google.com:19302'
                }
            ]
        })
        // 在实例列表中添加该实例
        this.peerConnections[socketId] = pc
        // 当peerConnection需要向另一个peerConnection发消息的时候就会触发这个事件
        // peerConnection会生成很多ice候选者，用来与远程webRTC进行通讯（能够与远程设备通信所需的协议和路由）
        pc.onicecandidate = (e) => {
            this.log('ice_candidate', e.candidate)
            // ice的相关信息如果有，发给对方，如果是null的话，说明已经收集完成
            if (e.candidate) {
                // this.socketSend(this.socket, 'ice_candidate', {
                //     label: e.candidate.sdpMLineIndex,
                //     candidate: e.candidate.candidate,
                //     socketId
                // })
                this.socketSend(this.socket, 'ice_candidate', {
                    candidateObj: e.candidate,
                    socketId
                })
            }
        }

        pc.onaddstream = (e) => {
            this.log('receive_stream')
            // 告诉浏览器有新的流加入进来了
            this.emit('add_user', e.stream, socketId)
        }

        pc.ondatachannel = (e) => {
            this.log('receive_datachannel')
            // 创建一份对面给我的channel
            this.addDataChannel(socketId, e.channel)
        }

        return pc
    }

    addDataChannel(socketId, channel) {
        // 数据通道关闭时删除
        channel.onclose = () => {
            delete this.dataChannels[socketId]
        }
        // 数据通道接收到消息时
        channel.onmessage = (e) => {
            const data = JSON.parse(e.data)
            // 通知客户端来消息了
            this.emit('new_message', data.message, data.userInfo)
        }

        this.dataChannels[socketId] = channel

        // return channel
    }
    // 广播消息
    broadcast(message) {
        for (const key in this.dataChannels) {
            const dataChannel = this.dataChannels[key]
            if (dataChannel.readyState.toLowerCase() === 'open') {
                dataChannel.send(JSON.stringify({
                    message,
                    userInfo: this.userInfo
                }))
            }
        }
    }
}