'use strict'

const PROD = process.env.NODE_ENV === 'production'
exports.PROD = PROD

exports.BROWSER_LIST = PROD ? '> 1% and ie 11 and ios 7' : '> 1% and not ie 11'

exports.SRC_STATIC_ROOT_DIR  = 'static'
exports.SRC_STYLES_ROOT_DIR  = 'styles'
exports.SRC_SCRIPTS_ROOT_DIR = 'scripts'
exports.SRC_IMAGES_ROOT_DIR  = 'images'
exports.OUT_ROOT_DIR         = 'target'
exports.OUT_PUBLIC_DIR       = 'target/public'

exports.SERVER_PORT    = process.env.SERVER_PORT
exports.API_SERVER_URL = process.env.API_SERVER_URL
exports.JITSI_MEET_SERVER_URL = process.env.JITSI_MEET_SERVER_URL

exports.DEV_WATCH_AND_REBUILD_SERVER = process.env.DEV_WATCH_AND_REBUILD_SERVER === 'true'
exports.DEV_SKIP_PRERENDER           = process.env.DEV_SKIP_PRERENDER           === 'true'