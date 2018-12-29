module.exports = function (RTCSocket) {
    RTCSocket.on('LOG_new_connect', function () {
        console.log('用户连接中...')
    })

    RTCSocket.on('LOG_leave_user', function (socket) {
        console.log(`用户"${socket.id}"已离开`)
    })

    RTCSocket.on('LOG_add_user', function (socket) {
        console.log(`新用户"${socket.id}"加入房间`)
    })

    RTCSocket.on('LOG_ice_candidate', function (socket) {
        console.log(`接收到来自"${socket.id}"的ICE Candidate`)
    })

    RTCSocket.on('LOG_offer', function (socket) {
        console.log(`接收到来自"${socket.id}"的Offer`)
    })

    RTCSocket.on('LOG_answer', function (socket) {
        console.log(`接收到来自"${socket.id}"的Answer`)
    })

    RTCSocket.on('LOG_error', function (eventName, socket, error) {
        console.log(`发生错误：${error.message} 事件：${eventName} 用户：${socket.id}`)
    })
}