const { options, help } = require('runjs')
const assert = require('assert')
const chalkAnimation = require('chalk-animation')
const dedent = require('dedent')
const Listr = require('listr')
const { Subject } = require('rxjs')

const { apps, deps } = require('./tuskfile')
const { dbExists } = require('./mongo')
const { prepareDockerImagesTask, dockerComposeTask } = require('./docker')
const { execTask } = require('./exec')

const {
  npmTask,
  requirePackageJson,
  startVerdaccioTask,
  preparePackagesTask,
  stopVerdaccioTask
} = require('./npm')

const cleanTaskFor = pkg => ({
  title: pkg,
  task: () =>
    new Listr([
      npmTask(pkg, 'run', ['clean']),
      execTask('rm', ['-rvf', 'node_modules'], { cwd: pkg })
    ])
})

const cleanTask = {
  title: 'Clean up',
  task: () =>
    new Listr(Object.keys(deps).map(key => cleanTaskFor(key)), {
      concurrent: 4,
      showSubtasks: false
    })
}

const verdaccio = {
  start: () => new Listr([startVerdaccioTask()]).run(),
  stop: () => new Listr([stopVerdaccioTask()]).run()
}

help(verdaccio.start, 'Start local npm server')
help(verdaccio.stop, 'Stop local npm server')

function clean () {
  return new Listr([cleanTask]).run()
}

help(clean, {
  description: '🛀  Clean all the things! Specifically, would run `npm run clean` in each directory and delete `node_modules` (a copy of all modules still exists in `verdaccio/storage`',
  examples: dedent`
    [npx] run clean
  `
})

const initBuildContext = (deps, options = {}) => ({
  subjects: Object.keys(deps).reduce(
    (o, key) => ({ ...o, [key]: new Subject() }),
    {}
  ),
  options
})

help(build, {
  description: '🏗   Build all the things!',
  options: {
    verbose: 'Moar output!',
    silent: 'No output!',
    republish: 'Override the currently published version. Normally the publish step skips if the package is already published.',
    fancyfont: 'Nerdfonts silliness'
  },
  examples: dedent`
    👍 [npx] run build
    👍 [npx] run build --verbose
    👍 [npx] run build --silent
    😡 [npx] run build --verbose --silent
  `
})

function build () {
  const opts = options(this)
  const { verbose, silent } = opts
  assert(!(verbose && silent), "water can't be dry. make up your mind!")
  const renderer = verbose ? 'verbose' : silent ? 'silent' : 'default'

  return new Listr(
    [preparePackagesTask(deps, opts), prepareDockerImagesTask(apps, opts)],
    {
      renderer
    }
  ).run(initBuildContext(deps, opts))
}

const prepareMockDataTask = {
  title: 'Prepare mock data',
  skip: () =>
    dbExists('mongodb://localhost:27017')('nodeloop') &&
    'mockdata already loaded',
  task: () =>
    new Listr([
      dockerComposeTask(['up', '--detach', 'mongo', 'redis', 'consul'], {
        env: {
          consul_config: 'localhost'
        }
      }),
      npmTask('loop', 'run', ['mockdata:nodeloop']),
      npmTask('loop', 'run', ['mockdata:mockloops'])
    ])
}

const startAllTheThingsTask = {
  title: 'Start all the things!',
  task: (ctx, task) => {
    setInterval(() => (task.title = ctx.rainbow.frame().substring(11)), 50)
    return new Listr([
      prepareMockDataTask,
      dockerComposeTask(['up', '--detach'], {
        env: {
          loop_version: requirePackageJson('loop').version,
          reporting_version: requirePackageJson('loop-reporting').version,
          arusha_version: requirePackageJson('loop-arusha-reporting').version
        }
      })
    ])
  }
}

help(start, 'Start all Loop services')
help(destroy, 'Stop all Loop services and delete any associated state')

async function start () {
  const rainbow = chalkAnimation.rainbow(startAllTheThingsTask.title).stop()
  const tasks = new Listr([startAllTheThingsTask])
  const ctx = await tasks.run({ rainbow })
  ctx.rainbow.stop()
  process.exit(0)
}

const stop = () =>
  new Listr(
    [
      {
        title: 'Stop all services',
        task: () => new Listr([dockerComposeTask(['down'])])
      }
    ],
    { showSubtasks: false }
  ).run()

function destroy () {
  return new Listr([dockerComposeTask(['down', '--volumes'])]).run()
}

help(stop, 'Stop all Loop services')

module.exports = {
  build,
  clean,
  verdaccio,
  start,
  stop,
  destroy
}
