function log(rTCClient) {
    rTCClient.on('LOG_success_join', function () {
        console.log('用户加入成功')
    })
    rTCClient.on('LOG_stream_created', function () {
        console.log('本地视频创建成功')
    })
    rTCClient.on('LOG_add_user', function () {
        console.log('老用户接收到新用户进来的通知')
    })
    rTCClient.on('LOG_other_connect', function () {
        console.log('新用户与其他用户创建连接')
    })
    rTCClient.on('LOG_receive_ice_candidate', function () {
        console.log('接收到其他用户的ice候选')
    })
    rTCClient.on('LOG_ice_candidate', function (candidate) {
        console.log('生成ice候选：', candidate ? candidate.candidate : '')
    })
    rTCClient.on('LOG_create_offer', function () {
        console.log('新用户发送offer信令')
    })
    rTCClient.on('LOG_receive_offer', function () {
        console.log('老用户接到新用户发送的offer信令')
    })
    rTCClient.on('LOG_create_answer', function () {
        console.log('老用户发送answer信令给新用户')
    })
    rTCClient.on('LOG_receive_answer', function () {
        console.log('新用户接收到老用户发送的answer信令')
    })
    rTCClient.on('LOG_receive_stream', function () {
        console.log('接收到其他用户的视频流并通知浏览器添加显示')
    })
}
