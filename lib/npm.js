const npmLogo = ''
const registryUrl = 'http://localhost:4873'

// This isn't really secret. Verdaccio (local npm registry) seems to require
// authentication for publishing so we have to put * something * here to register
// with. The local registry won't be open to the outside anyway.
const { redBright: red } = require('chalk')
const dedent = require('dedent')
const Listr = require('listr')
const path = require('path')
const fs = require('fs')
const url = require('url')
const { Subject } = require('rxjs')
const NpmRegistryClient = require('npm-registry-client')
const npmClient = new NpmRegistryClient()
const { exec } = require('./exec')
const { id } = require('./functional')
const { makeFancy } = require('./vanity')

const verdaccioDir = path.join(__dirname, 'verdaccio')
const npmrc = path.join(process.cwd(), '.npmrc')

const writeNpmrc = () =>
  new Promise((resolve, reject) =>
    fs.writeFile(
      npmrc,
      dedent`
    registry=${registryUrl}
    //${url.parse(registryUrl).host}/:_authToken="foo"
  `,
      err => {
        if (err) reject(err)
        resolve()
      }
    )
  )

const npmGet = auth => (name, version) =>
  new Promise((resolve, reject) => {
    npmClient.log.level = 'silent'
    npmClient.get(
      `${registryUrl}/${name}/${version}`,
      { auth },
      (err, data, raw, res) => {
        if (err) {
          reject(err)
        }
        resolve(data, raw, res)
      }
    )
  })

const npmCmd = (cwd, cmd, args = []) =>
  exec('npm', ['--userconfig', npmrc, cmd, ...args], {
    cwd
  })

const npm = (cmd, ...args) => () => npmCmd(process.cwd(), cmd, args)

const npmTask = (cwd, cmd, args = []) => ({
  title: `${path.basename(cwd)}> ${red(npmLogo)} ${cmd} ${args.split(' ')}`,
  task: () => npmCmd(cwd, cmd, args)
})

const packagePath = pkg => path.join(__dirname, pkg)
const packageHas = what => pkg =>
  fs.existsSync(path.join(packagePath(pkg), what))

const hasNodeModules = packageHas('node_modules')
const hasPackageJson = packageHas('package.json')

const npmPreparePackage = (pkg, requires = []) =>
  function (_, task) {
    const packageJson = require(path.join(packagePath(pkg), 'package.json'))
    const { name, version } = packageJson

    const alreadyPublished = auth =>
      npmGet(auth)(name, version)
        .then(() => true)
        .catch(() => false)

    return new Listr([
      {
        title: 'install dependencies',
        skip: () => hasNodeModules(pkg) && 'already has node_modules',
        task: () =>
          new Listr([
            {
              title: 'wait for dependencies',
              enabled: () => requires.length > 0,
              task: () =>
                new Listr(
                  requires.map(r => ({
                    title: r,
                    task: ctx => ctx.subjects[r].toPromise()
                  })),
                  { concurrent: true }
                )
            },
            npmTask(pkg, 'install')
          ])
      },
      {
        title: `${red('npm')} publish`,
        skip: async ctx => {
          if (packageJson.private) {
            return 'package marked private'
          }

          if (ctx.options.republish) {
            return false
          }

          if (await alreadyPublished(ctx.npmAuth)) {
            return 'already published'
          }

          return false
        },
        task: (ctx, task) => {
          const { republish } = ctx.options
          task.title = task.title + (republish ? ' --force' : '')
          return npmCmd(pkg, 'publish', republish ? ['--force'] : [])
        }
      },
      {
        title: 'notify dependents',
        enabled: ctx => ctx.subjects[pkg] instanceof Subject,
        task: ctx => ctx.subjects[pkg].complete()
      }
    ])
  }

const generateNpmrc = ctx => writeNpmrc()

const generateNpmrcTask = {
  title: 'Generating npmrc',
  task: generateNpmrc
}

const requirePackageJson = app =>
  require(path.join(packagePath(app), 'package.json'))

const startVerdaccioTask = (net = 'bridge') => ({
  title: `Start local ${red('npm')} registry`,
  task: () =>
    new Listr([
      {
        title: 'docker-compose up',
        task: () =>
          exec('docker-compose', ['up', '--detach', 'verdaccio', 'rabbitmq'], {
            cwd: verdaccioDir,
            env: { net }
          })
      }
    ])
})

function generateVerdaccioConfig () {
  const config = {
    max_body_size: '200mb',
    uplinks: {
      npmjs: {
        url: 'https://registry.npmjs.org/',
        headers: {
          Authorization: `Bearer ${process.env.NPM_TOKEN}`
        }
      }
    },
    storage: '/verdaccio/storage',
    packages: {
      '**': {
        access: '$anonymous',
        publish: '$anonymous',
        proxy: 'npmjs'
      }
    }
  }

  return Promise.resolve(
    fs.writeFileSync(
      path.join(verdaccioDir, 'conf', 'config.yaml'),
      JSON.stringify(config)
    )
  )
}

const stopVerdaccioTask = {
  title: `Stop local ${red('npm')} registry`,
  task: () =>
    exec('docker-compose', ['down', 'verdaccio'], {
      cwd: verdaccioDir
    })
}

const preparePackageTask = (title, requires = []) => ({
  title,
  task: npmPreparePackage(title, requires)
})

const preparePackagesTask = (deps, opts) => ({
  title: (opts.fancyfont ? makeFancy(npmLogo, red) : id)(
    `prepare ${red('npm')} packages`
  ),
  task: (_, task) =>
    new Listr([
      startVerdaccioTask(),
      generateNpmrcTask,
      {
        title: `Publish to local ${red('npm')} registry`,
        task: () =>
          new Listr(
            Object.keys(deps).map(key => preparePackageTask(key, deps[key])),
            { concurrent: 4 }
          )
      }
    ])
})

const dockerCompose = (args = [], opts = {}) =>
  exec(
    'docker-compose',
    ['--project-name', path.basename(process.cwd()), ...args],
    opts
  )
const startVerdaccio = (net = 'bridge') =>
  dockerCompose(['up', '--detach'], {
    cwd: verdaccioDir,
    env: { net }
  })

const stopVerdaccio = () =>
  dockerCompose(['stop'], {
    cwd: verdaccioDir
  })

const nukeVerdaccio = () =>
  dockerCompose(['rm', '-vf'], {
    cwd: verdaccioDir
  })

module.exports = {
  npmLogo,
  writeNpmrc,
  npmGet,
  npmCmd,
  npmTask,
  hasNodeModules,
  hasPackageJson,
  npmPreparePackage,
  generateNpmrcTask,
  generateNpmrc,
  requirePackageJson,
  startVerdaccioTask,
  stopVerdaccioTask,
  preparePackageTask,
  preparePackagesTask,
  startVerdaccio,
  generateVerdaccioConfig,
  stopVerdaccio,
  nukeVerdaccio,
  npm
}
