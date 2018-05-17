const Listr = require('listr')
const { exec } = require('./lib/exec')
const { Subject } = require('rxjs/Subject')
const { Observable } = require('rxjs/Observable')
const { forkJoin } = require('rxjs/observable/forkJoin')
const { concat } = require('rxjs/observable/concat')
const { yellow, green } = require('chalk')

const sleep = d => () => exec('sleep', [d.toString()])
const sleep5 = sleep(5)

const input = {
  build: ['gulpBuild'],
  gulpBuild: ['gulpBuildSrc', 'gulpBuildAssets'],
  gulpBuildSrc: ['gulpBuildSrcJs', 'gulpBuildSrcCoffee', 'gulpBuildSrcJson'],
  gulpBuildSrcJs: sleep5,
  gulpBuildSrcCoffee: sleep5,
  gulpBuildSrcJson: sleep5,
  gulpBuildAssets: [
    'gulpBuildAssetsBrowserify',
    'gulpBuildAssetsJs',
    'gulpBuildAssetsCss',
    'gulpBuildAssetsFingerprint'
  ],
  gulpBuildAssetsBrowserify: sleep(1),
  gulpBuildAssetsJs: sleep(3),
  gulpBuildAssetsCss: sleep(6),
  gulpBuildAssetsFingerprint: {
    dependencies: [
      'gulpBuildAssetsBrowserify',
      'gulpBuildAssetsJs',
      'gulpBuildAssetsCss'
    ],
    action: sleep(1)
  }
}

const normalizeInput = input =>
  Object.entries(input).reduce(
    (a, [key, value]) => ({
      ...a,
      [key]: {
        dependencies: Array.isArray(value)
          ? value
          : value.dependencies ? value.dependencies : [],
        action: typeof value === 'function'
          ? value
          : value.action ? value.action : null
      }
    }),
    {}
  )

const normalizedInput = normalizeInput(input)

const build = () => runTask('build')
const runTask = taskName => {
  const result = expandDependencies(taskName)
  const context = result.reduce((acc, { name }) => {
    const subject = new Subject()
    subject.completed = false
    subject.subscribe(null, null, () => (subject.completed = true))
    return {
      ...acc,
      [name]: subject
    }
  }, {})

  return new Listr(
    result.map(({ name, action, dependencies }) => ({
      title: name +
        (dependencies.length > 0
          ? ` [ ${yellow(dependencies.join(' '))} ]`
          : ''),
      task: (ctx, task) => {
        const dependencies$ = dependencies.map(dep => [dep, ctx[dep]])
        dependencies$.forEach(([dep, dep$]) => {
          dep$.next(name)
          dep$.subscribe(null, null, () => {
            task.title =
              name +
              (dependencies.length > 0
                ? ` [ ${dependencies$
                  .map(([dep, dep$]) =>
                    (dep$.completed ? green : yellow)(dep)
                  )
                  .join(' ')} ]`
                : '')
          })
        })

        return concat(forkJoin(...dependencies.map(dep => ctx[dep])), Observable.of(0))
          .flatMap(() => action())
          .do(null, null, () => {
            task.title += ' - done!'
            ctx[name].next('done')
            ctx[name].complete()
          })
      }
    }
    )),
    { concurrent: true, renderer: 'default' }
  ).run(context)
}

const expandDependencies = task => {
  const { dependencies } = normalizedInput[task]
  return Array.prototype.concat(
    ...dependencies.map(
      dep =>
        (normalizedInput[dep].action
          ? { ...normalizedInput[dep], name: dep }
          : expandDependencies(dep))
    )
  )
}

module.exports = { build }
