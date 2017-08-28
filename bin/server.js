const Koa = require('koa')
const path = require('path')
const ENV = process.env.NODE_ENV
const CLIENT = process.env.CLIENT
const { ROOT_PATH, CLIENT_PATH } = require('./config/path')

function extend(target) {
  var sources = [].slice.call(arguments, 1);
  sources.forEach(function (source) {
      for (var prop in source) {
          target[prop] = source[prop];
      }
  });
  return target;
}

let baseAliasConfig = require(path.resolve(ROOT_PATH, 'app/build/alias.config.base'))
let aliasConfig = require(path.resolve(CLIENT_PATH, 'build/alias.config'))

// Javascript required hook
require('babel-register')({
  extensions: ['.js'],
  plugins: [
    ["module-resolver", {
      "alias": extend({}, baseAliasConfig, aliasConfig)
    }],
    ['inline-replace-variables', {
      __SERVER__: true
    }]
  ]
})

const { createRenderer } = require(path.resolve(ROOT_PATH, 'server/renderer'))
const middlewareRegister = require(path.resolve(ROOT_PATH, 'server/middleware')).default

let server
let hasListen = false
function startServer (app) {
  if (server) {
    try {
      console.log('waiting for restart server ...')
      server && server.close()
      hasListen = false
    } catch (e) {}
  }

  if (hasListen) return

  let config = require('./config').default
  server = require('http').createServer(app.callback())
  
  server.listen(config.port, function () {
    hasListen = true
    console.log('App started, at port %d, CTRL + C to terminate', config.port)
  })
}

console.log('Waiting for webpacking ...')

const app = new Koa()

// set environment variable
app.env = ENV
app.client = CLIENT

if (ENV === 'production') {
  // In production: create server renderer using built server bundle.
  // The server bundle is generated by vue-ssr-webpack-plugin.
  const bundle = require(path.resolve(ROOT_PATH, 'dist/vue-ssr-server-bundle.json'))
  // The client manifests are optional, but it allows the renderer
  // to automatically infer preload/prefetch links and directly add <script>
  // tags for any async chunks used during render, avoiding waterfall requests.
  const clientManifest = require(path.resolve(ROOT_PATH, 'dist/vue-ssr-client-manifest.json'))

  middlewareRegister(app, createRenderer(bundle, {
    clientManifest
  }))

  startServer(app)
} else {
  const readyPromise = require(path.resolve(ROOT_PATH, 'server/setup-dev-server')).default
  readyPromise(app, (bundle, options) => {
    middlewareRegister(app, createRenderer(bundle, options))
    startServer(app)
  })
}