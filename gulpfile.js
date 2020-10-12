'use strict'

require('./init-env')

/** Dependencies **/

const $    = require('gulp-load-plugins')()
const afr  = require('afr')
const ch   = require('chokidar') // Transitive dependency
const cp   = require('child_process')
const del  = require('del')
const f    = require('fpx')
const gulp = require('gulp')
const log  = require('fancy-log')
const st   = require('stream')
const ur   = require('url')
const bc   = require('./build-const')

/** Globals **/

const SERVER_PORT = parseInt(bc.SERVER_PORT, 10) || undefined

const WEBPACK_CLIENT_CONFIG_PATH = './webpack.config.client.js'
const WEBPACK_SERVER_CONFIG_PATH = './webpack.config.server.js'

const SRC_STATIC_FILES   = `${bc.SRC_STATIC_ROOT_DIR}/**/*`
const SRC_STYLE_FILES    = `${bc.SRC_STYLES_ROOT_DIR}/**/*.scss`
const SRC_STYLE_ENTRY    = `${bc.SRC_STYLES_ROOT_DIR}/main.scss`
const SRC_IMAGES_RASTER  = `${bc.SRC_IMAGES_ROOT_DIR}/**/*.{jpg,png,gif}`
const SRC_IMAGES_SVG     = `${bc.SRC_IMAGES_ROOT_DIR}/**/*.svg`

const OUT_ROOT_DIR   = `${bc.OUT_ROOT_DIR}`
const OUT_STYLE_DIR  = `${bc.OUT_PUBLIC_DIR}/styles`
const OUT_IMAGE_DIR  = `${bc.OUT_PUBLIC_DIR}/images`

const autoprefixerConfig = {
  browserlist: {browsers: [bc.BROWSER_LIST]},
}

const cssCleanConfig = {
  keepSpecialComments: 0,
  aggressiveMerging:   false,
  advanced:            false,
  // Don't inline `@import url()`
  processImport:       false,
}

function trimSvg(source) {
  return source
    .replace(/^\s*<[?].*[?]>\s*$|^\s*<!--.*-->\s*$/gm, '')
    .replace(/^\s*<desc>.*<[/]desc>\s*$/gm, '')
    .replace(/^\s*<title>.*<[/]title>\s*$/gm, '')
    .replace(/^\s*<defs><[/]defs>\s*$/gm, '')
    .replace(/^\s*(.*)\s*$/gm, '$1')
    .replace(/\r|\n/g, '')
}

function moduleExists(path) {
  try {
    require.resolve(path)
    return true
  }
  catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') return false
    throw err
  }
}

function rerequire(path) {
  const fullPath = require.resolve(path)
  delete require.cache[fullPath]
  return require(fullPath)
}

/** Terminal colors **/

const TTY_COLOR_RESET      = '\x1b[0m'
const TTY_COLOR_BRIGHT     = '\x1b[1m'
const TTY_COLOR_DIM        = '\x1b[2m'
const TTY_COLOR_UNDERSCORE = '\x1b[4m'
const TTY_COLOR_BLINK      = '\x1b[5m'
const TTY_COLOR_REVERSE    = '\x1b[7m'
const TTY_COLOR_HIDDEN     = '\x1b[8m'

const TTY_COLOR_FG_BLACK   = '\x1b[30m'
const TTY_COLOR_FG_RED     = '\x1b[31m'
const TTY_COLOR_FG_GREEN   = '\x1b[32m'
const TTY_COLOR_FG_YELLOW  = '\x1b[33m'
const TTY_COLOR_FG_BLUE    = '\x1b[34m'
const TTY_COLOR_FG_MAGENTA = '\x1b[35m'
const TTY_COLOR_FG_CYAN    = '\x1b[36m'
const TTY_COLOR_FG_WHITE   = '\x1b[37m'

const TTY_COLOR_BG_BLACK   = '\x1b[40m'
const TTY_COLOR_BG_RED     = '\x1b[41m'
const TTY_COLOR_BG_GREEN   = '\x1b[42m'
const TTY_COLOR_BG_YELLOW  = '\x1b[43m'
const TTY_COLOR_BG_BLUE    = '\x1b[44m'
const TTY_COLOR_BG_MAGENTA = '\x1b[45m'
const TTY_COLOR_BG_CYAN    = '\x1b[46m'
const TTY_COLOR_BG_WHITE   = '\x1b[47m'

/** Clear **/

gulp.task('clear', () => (
  del(`${OUT_ROOT_DIR}/*`).catch(console.error.bind(console))
))

/** Static **/

gulp.task('static:copy', () => (
  gulp.src(SRC_STATIC_FILES).pipe(gulp.dest(bc.OUT_PUBLIC_DIR))
))

gulp.task('static:watch', () => {
  $.watch(SRC_STATIC_FILES, gulp.series('static:copy'))
})

/** Scripts **/

gulp.task('scripts:build', () => Promise.all([
  buildWithWebpack(require(WEBPACK_CLIENT_CONFIG_PATH)),
  buildWithWebpack(require(WEBPACK_SERVER_CONFIG_PATH)),
]))

// Note: we fork separate processes to allow Webpack instances to run in
// parallel on different cores, although it's not guaranteed.
gulp.task('scripts:watch', () => {
  let proc0
  let proc1

  function rewatch() {
    if (proc0) proc0.kill()
    if (proc1) proc1.kill()
    try {
      proc0 = cp.fork('./webpack-watch.js', [WEBPACK_CLIENT_CONFIG_PATH], {shell: true, stdio: 'inherit'})
      if (bc.DEV_WATCH_AND_REBUILD_SERVER) {
        proc1 = cp.fork('./webpack-watch.js', [WEBPACK_SERVER_CONFIG_PATH], {shell: true, stdio: 'inherit'})
      }
      else {
        buildWithWebpack(require(WEBPACK_SERVER_CONFIG_PATH)).catch(err => {
          log('[webpack]', err)
        })
      }
    }
    catch (err) {
      log('[webpack]', err)
    }
  }

  rewatch()
  $.watch([WEBPACK_CLIENT_CONFIG_PATH, WEBPACK_SERVER_CONFIG_PATH], rewatch)
})

function buildWithWebpack(config) {
  return new Promise((resolve, reject) => {
    require('webpack')(config, (err, stats) => {
      if (err) {
        reject(err)
      }
      else {
        log('[webpack]', stats.toString(config.stats))
        resolve()
      }
    })
  })
}

/** Styles **/

gulp.task('styles:build', () => (
  gulp.src(SRC_STYLE_ENTRY)
    .pipe($.sass({includePaths: [process.cwd()]}))
    .pipe($.autoprefixer(autoprefixerConfig))
    .pipe(bc.PROD ? $.cleanCss(cssCleanConfig) : new st.PassThrough({objectMode: true}))
    .pipe(gulp.dest(OUT_STYLE_DIR))
))

gulp.task('styles:watch', () => {
  $.watch(SRC_STYLE_FILES, gulp.series('styles:build'))
})

/** Images **/

/*
Requires `graphicsmagick`. Install via the package manager of your Unix distro,
or Homebrew on MacOS.

See the GraphicsMagick documentation:
  http://www.graphicsmagick.org/convert.html
  http://www.graphicsmagick.org/batch.html
*/
gulp.task('images:raster', () => (
  gulp.src(SRC_IMAGES_RASTER)
    /*
    Without any options, this runs default optimizations that reduce image size
    without any visible difference. The effect on PNG is minor. The effect on
    JPG is major.
    */
    .pipe($.gm(gmfile => gmfile))
    .pipe(gulp.dest(OUT_IMAGE_DIR))
))

gulp.task('images:svg', () => (
  gulp.src(SRC_IMAGES_SVG)
    .pipe(new st.Transform({
      objectMode: true,
      transform(file, __, done) {
        file.contents = Buffer.from(trimSvg(String(file.contents)))
        done(undefined, file)
      },
    }))
    .pipe(gulp.dest(OUT_IMAGE_DIR))
))

gulp.task('images:build', gulp.parallel('images:raster', 'images:svg'))

gulp.task('images:watch', () => {
  $.watch(SRC_IMAGES_RASTER, gulp.series('images:raster'))
  $.watch(SRC_IMAGES_SVG, gulp.series('images:svg'))
})

/** Servers **/

gulp.task('server:dev', () => {
  f.validate(SERVER_PORT, f.isNatural)

  const proxy = require('http-proxy').createProxyServer()
  proxy.on('error', onProxyDone)

  const ds = new class extends afr.Devserver {
    onRequest(req, res) {
      super.onRequest(req, res, function fallback() {
        rectifyReq(req)
        const {pathname} = ur.parse(req.url)

        if (/^[/]api(?:[/]|$)/.test(pathname)) {
          proxy.web(req, res, {target: bc.API_SERVER_URL, secure: false})
          return
        }

        proxy.web(req, res, {target: `http://localhost:${SERVER_PORT}`})
      })
    }

    onUpgrade(req, socket, head) {
      rectifyReq(req)
      super.onUpgrade(req, socket, head, function fallback() {
        proxy.ws(req, socket, head, {target: bc.API_SERVER_URL, secure: false})
      })
    }
  }()

  ds.watchFiles(bc.OUT_PUBLIC_DIR)

  ds.listen(SERVER_PORT + 1, err => {
    if (err) throw err
    log(`development server listening on ${TTY_COLOR_FG_MAGENTA}http://localhost:${ds.httpServer.address().port} ${TTY_COLOR_RESET} <-- click here`)
  })
})

function rectifyReq(req) {
  // Without this, requests to our Kubernetes ingress fail in weird ways.
  delete req.headers.host
}

function onProxyDone(err, req, res) {
  if (!err || err.code === 'ECONNRESET') return

  log('[proxy error]', err)

  // HTTP response
  if (res.writeHead) {
    res.writeHead(500)
    res.end()
    return
  }

  // WS TCP socket
  if (res.destroy) {
    res.destroy()
  }
}

gulp.task('server:main', () => {
  runServerInProcess(`./${bc.OUT_ROOT_DIR}/server.js`)
})

function runServerInProcess(filePath) {
  let mod

  function stop() {
    if (mod) {
      try {
        if (mod.deinit) mod.deinit()
      }
      catch (err) {
        console.error(`failed to stop ${filePath}:`, err)
      }
      finally {
        mod = undefined
      }
    }
  }

  function restart() {
    stop()
    try {
      mod = rerequire(filePath)
      if (mod.init) mod.init()
    }
    catch (err) {
      console.error(`failed to start ${filePath}:`, err)
    }
  }

  new ch.FSWatcher({ignoreInitial: true})
    .add(filePath)
    .on('add', restart)
    .on('change', restart)
    .on('rename', stop)
    .on('unlink', stop)

  if (moduleExists(filePath)) {
    restart()
  }
}

/** Default **/

gulp.task('build', gulp.series('clear', gulp.parallel(
  'static:copy',
  'styles:build',
  'images:build',
  'scripts:build',
)))

gulp.task('watch', gulp.parallel(...[
  'static:watch',
  'styles:watch',
  'images:watch',
  'scripts:watch',
  'server:main',
  'server:dev',
]))

gulp.task('default', gulp.series('clear', 'build', 'watch'))
