'use strict'

const pt = require('path')
const wp = require('webpack')
const bc = require('./build-const')

const SRC_DIR = pt.resolve(bc.SRC_SCRIPTS_ROOT_DIR)
const OUT_DIR = pt.resolve(pt.join(bc.OUT_PUBLIC_DIR, bc.SRC_SCRIPTS_ROOT_DIR))

module.exports = {
  mode: process.env.NODE_ENV || 'development',

  entry: {
    main: bc.PROD
      ? pt.join(SRC_DIR, 'client.js')
      : pt.join(SRC_DIR, 'client-dev.js'),
  },

  output: {
    path: OUT_DIR,
    filename: '[name].js',
    // For code splitting / async imports
    publicPath: `/${bc.SRC_SCRIPTS_ROOT_DIR}/`,
  },

  // Don't polyfill any Node globals
  node: false,

  /*
  Module concatenation merges modules together without intermediary IIFE
  wrappers, renaming variables and functions with conflicting names. Unused
  exports are left as dangling variable declarations and can be eliminated by
  minification. This is often called "tree shaking".

  NOTE: Babel's transformation of the `...` spread syntax can interfere with
  this feature in a hard-to-detect way. Suppose we're calling a function from
  another module that was star-imported as a namespace. The call looks like
  this: `mod.fun(...args)`. Babel produces `fun.apply(mod, args)`, causing
  Webpack to materialize the module, preventing tree shaking. We can't simply
  disable the spread transform: Webpack and Uglify can also parse the spread
  syntax, and will NOT warn us about shipping non-ES5 code to the users.
  Instead, we must avoid this feature and use `.apply`. Note that the problem
  pertains only to function calls.
  */
  plugins: [
    // new wp.optimize.ModuleConcatenationPlugin(),
    new wp.ProvidePlugin({reactShim: pt.join(SRC_DIR, 'react-shim.js')}),
  ],

  optimization: bc.PROD ? {
    minimize: true,
    minimizer: [
      new (require('terser-webpack-plugin'))({
        sourceMap: true,
      }),
    ],
  } : undefined,

  // Source maps require TWO separate options to be enabled:
  //   `devtool: 'source-map'` in webpack config
  //   `sourceMap: true` in uglify plugin options
  devtool: bc.PROD ? 'source-map' : false,

  // Disable useless logging
  stats: {
    assets: false,
    builtAt: false,
    colors: true,
    entrypoints: false,
    hash: false,
    modules: false,
    timings: true,
    version: false,
  },
}

function babelOptions() {
  return {
    presets: [
      ['@babel/preset-env', {
        targets: {browsers: [bc.BROWSER_LIST]},
        // Keep ES modules for Webpack
        modules: false,
        // Don't generate useless garbage
        loose: true,
      }],
    ],
    plugins: [
      // Emits a special annotation just before a class-defining IIFE, marking
      // it as side-effect-free. Allows UglifyJS to remove unused classes
      // generated from our code by Babel. Doesn't affect library code. Must
      // precede other class transforms. May require module concatenation for
      // the full benefit.
      //
      // References:
      //   * https://github.com/mishoo/UglifyJS2/issues/1261
      //   * https://github.com/babel/babel/issues/5632
      //   * https://github.com/babel/babel/pull/6209
      //   * https://github.com/blacksonic/babel-webpack-tree-shaking
      () => ({
        visitor: {
          ClassExpression(path) {
            path.addComment('leading', '#__PURE__')
          },
        },
      }),
      ['@babel/transform-react-jsx', {pragma: 'reactShim.createElement', pragmaFrag: 'reactShim.Fragment'}],
    ],
  }
}
