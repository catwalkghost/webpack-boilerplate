'use strict'

const pt = require('path')
const wp = require('webpack')
const bc = require('./build-const')

const PROD    = process.env.NODE_ENV === 'production'
const SRC_DIR = pt.resolve(bc.SRC_SCRIPTS_ROOT_DIR)
const OUT_DIR = pt.resolve(bc.OUT_ROOT_DIR)

const clientConfig = require('./webpack.config.client')

module.exports = {
  mode: process.env.NODE_ENV || 'development',

  get entry() {
    const entry = {
      'server': pt.join(SRC_DIR, 'server.js'),
    }
    if (PROD) {
      entry['server-start'] = pt.join(SRC_DIR, 'server-start.js')
    }
    return entry
  },

  /*
  Note on code splitting / async imports. In the client config, we have to
  configure `output.publicPath` for chunk URLs, but when target is set to
  'node', it's not required.
  */
  output: {
    path: OUT_DIR,
    filename: '[name].js',
    libraryTarget: 'commonjs-module',
  },

  target: 'node',

  module: {
    rules: [
      {
        test: /\.js$/,
        include: SRC_DIR,
        use: {loader: 'babel-loader', options: babelOptions()},
      },
    ],
  },

  resolve: clientConfig.resolve,

  plugins: [
    new wp.optimize.ModuleConcatenationPlugin(),
    new wp.ProvidePlugin({reactShim: pt.join(SRC_DIR, 'react-shim.js')}),
  ],

  optimization: {minimize: false, minimizer: []},

  devtool: false,

  stats: clientConfig.stats,
}

function babelOptions() {
  return {
    presets: [
      ['@babel/preset-env', {
        targets: {node: 'current'},
        // Keep ES modules for Webpack
        modules: false,
        // Don't generate useless garbage
        loose: true,
      }],
    ],
    plugins: [
      ['@babel/transform-react-jsx', {pragma: 'reactShim.createElement', pragmaFrag: 'reactShim.Fragment'}],
    ],
  }
}
