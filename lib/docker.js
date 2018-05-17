const { blueBright: blue } = require('chalk')
const Listr = require('listr')
const path = require('path')
const { exec } = require('./exec')
const { id } = require('./functional')
const { makeFancy } = require('./vanity')
const { requirePackageJson, startVerdaccioTask } = require('./npm')
const { requireSetupPy, hasSetupPy } = require('./python')
const dockerLogo = ''

const packagePath = pkg => path.join(__dirname, pkg)

const prepareDockerImagesTask = (apps, opts) => ({
  title: (opts.fancyfont ? makeFancy(dockerLogo, blue) : id)(
    `prepare ${blue('docker')} images`
  ),
  task: (_, task) =>
    new Listr([
      startVerdaccioTask('host'),
      {
        title: 'Build images',
        task: () =>
          new Listr(apps.map(prepareDockerImageTask), { concurrent: true })
      }
    ])
})

const prepareDockerImageTask = app => {
  const { hasPackageJson, npmCmd } = require('./npm')
  const { name, version } = hasPackageJson(app)
    ? requirePackageJson(app)
    : hasSetupPy(app) ? requireSetupPy(app) : { name: app, version: 'unknown' }

  const npmDockerBuildTask = {
    title: `npm run docker:build`,
    task: (ctx, task) => {
      const extraOpts = ctx.options.republish
        ? [`--${name}:docker_no_cache=true`]
        : []
      if (extraOpts > 0) {
        task.title = `npm run ${extraOpts.join(' ')} docker:build`
      }
      return npmCmd(app, 'run', [...extraOpts, 'docker:build'])
    }
  }

  const dockerComposeBuildTask = {
    title: 'docker-compose build',
    task: (ctx, task) => {
      const extraOpts = ctx.options.republish ? ['--no-cache'] : []
      if (extraOpts > 0) {
        task.title = `docker-compose ${extraOpts.join(' ')} build`
      }
      return exec('docker-compose', [...extraOpts, 'build'], {
        cwd: packagePath(app)
      })
    }
  }

  const dockerBuildTask = hasPackageJson(app)
    ? npmDockerBuildTask
    : hasSetupPy(app) ? dockerComposeBuildTask : undefined

  return {
    title: `${app}:${version}`,
    task: () => {
      if (!dockerBuildTask) {
        return Promise.reject(
          new Error('Either package.json or setup.py required')
        )
      }
      return new Listr([dockerBuildTask])
    }
  }
}

const dockerComposeTask = (args, opts = {}) => ({
  title: `docker-compose ${args.join(' ')}`,
  task: () => exec('docker-compose', args, opts)
})

module.exports = {
  dockerLogo,
  prepareDockerImagesTask,
  prepareDockerImageTask,
  dockerComposeTask
}
