'use strict'

/*
This file should be executed when starting the build system and when starting
the server. It must be imported before all other application files.
*/

Error.stackTraceLimit = Infinity

const cp = require('child_process')
const dotenv = require('dotenv')

dotenv.config({path: '.env.properties'})

process.env.COMMIT = cp.execSync('git rev-parse --short HEAD', {stdio: []}).toString().trim()