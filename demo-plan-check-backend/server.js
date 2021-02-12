'use strict';

const Hapi = require('@hapi/hapi');
const Blipp = require('blipp');
const Path = require('path');
const Wurst = require('wurst');
const Config = require('configue');

const config = new Config({
  disable: {argv: true},
  files: [{file: './config.yaml', format: require('nconf-yaml')}],
  normalize: 'lowerCase',
  separator: '__',
  ignorePrefix: 'DPC_',
  // you can use `node -e "console.log(require('crypto').randomBytes(256).toString('base64'));"` to generate a good jwtkey
  defaults: { server: { host: 'localhost', port: 3000}, jwtkey:'Z/q3QjX2ng6CN/sAAHamvcJNQRDaAKr4tAHF7kaeWvLymEJ1MkatbHDn3Lvm/aRsjYuLiCleTbLsc6cyghnEGGcmz7NyxjO9kePUfKoVuy3vevKueA4xvGOmURQi13dYmG6Z9hjdjOhjb5esrQYRJshKuQuwujBVQekRl5kgykhhg3FIqHMu3itAcn9HXaoSg95DOPcObqSRkxcMEfrj9gAJfIaN+loWLhuD98w4f0sUOoCvt6sYQGm/ZpPlPOCJ1vev2A6UxvuZyvnF+qbXAH973erfEnMUJ5SUquAhYuytCkPWCFig1x8D4nMNSA8JQ4Crecku41VBvR7dzcZGkw=='},
  models: {serverOptions: {host: 'server:host', port: 'server:port'}}
});

const validate = async function (decoded, request, h) {
    console.log('validate '+decoded.id);
    console.log('validate '+JSON.stringify(request.session));
    if(decoded.id === request.session.id) {
      console.log('valid');
      return { isValid: true };
    } else {
      console.log('not valid');
      return { isValid: false };
    }
};


const init = async () => {
    const server = Hapi.server(config._.serverOptions);
    await server.register({ plugin: Blipp, options: { showAuth: true } });
    await server.register(require('hapi-auth-jwt2'));
    server.auth.strategy('jwt', 'jwt', { key: config.get('jwtkey'), // Never Share your secret key
        validate,  // validate function defined above
        verifyOptions: {
            algorithms: [ 'HS256' ]    // specify your secure algorithm
        }
    });
    server.auth.default('jwt');
    await server.register({
    plugin: Wurst,
    options: {
      // ignore: 'foo/**/*.js',
      cwd: Path.join(__dirname, 'routes'),
      routes: '**/*routes.js',
      log: true
    },
  })
    await server.register({
        plugin: require('hapi-server-session'),
        options: {
            cookie: {
                isSecure: true, // never set to false in production
            },
        },
    });
    server.state('token', {
        ttl: config.get('token__ttl',60 * 60 * 1000), // expires an hour from now
        encoding: 'none',    // we already used JWT to encode
        isSecure: true,      // warm & fuzzy feelings
        isHttpOnly: true,    // prevent client alteration
        clearInvalid: true,  // remove invalid cookies
        path: '/',           // so the token cookie set by /auth/login will be sent for any path
        strictHeader: true   // don't allow violations of RFC 6265
    });
    await server.register(config.plugin17('conf'));
    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();
