// https://source.chromium.org/chromium/chromium/src/+/main:net/base/net_error_list.h

const isRetryableError = (error) => {
    if(!error) return false
    return error.name === 'TimeoutError'
}

const isNotRetryableError = (error) => !isRetryableError(error)

const getErrorCode = (error) => {
    if(error.code) return error.code

    const netErr = new RegExp('net::[A-Z_]+', 'g')
    if (netErr.test(error.message)){
        return error.message.match(netErr)[0]
    }
    return error.message.
        split('\n')[0].
        split(':')[0]
}


module.exports = {
    getErrorCode,
    isRetryableError,
    isNotRetryableError,
}