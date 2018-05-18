const Listr = require('listr')
const { Subject } = require('rxjs/Subject')
const { Observable } = require('rxjs/Observable')
const { forkJoin } = require('rxjs/observable/forkJoin')
const { concat } = require('rxjs/observable/concat')
const { yellow, green } = require('chalk')
const { exec } = require('./lib/exec')

const noop = () => exec('true')

class Tusk {
  constructor (input) {
    this.input = Object.entries(input).reduce(
      (a, [key, value]) => ({
        ...a,
        [key]: {
          dependencies: Array.isArray(value)
            ? value
            : value.dependencies ? value.dependencies : [],
          action: typeof value === 'function'
            ? value
            : value.action ? value.action : noop
        }
      }),
      {}
    )
  }

  run (task) {
    const expandedDependencies = this.expandDependencies(task)

    const context = expandedDependencies.reduce((acc, { name }) => {
      const subject = new Subject()
      subject.completed = false
      subject.subscribe(null, null, () => (subject.completed = true))
      return {
        ...acc,
        [name]: subject
      }
    }, {})

    return new Listr(
      expandedDependencies
        .filter(dep => dep.action !== noop)
        .map(({ name, action, dependencies }) => ({
          title: name +
        (dependencies.length > 0
          ? ` [ ${yellow(dependencies.join(' '))} ]`
          : ''),
          task: (ctx, task) => {
            const dependencies$ = dependencies.map(dep => [dep, ctx[dep]])
            dependencies$.forEach(([dep, dep$]) => {
              if (!dep$) return

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

            return concat(forkJoin(...dependencies.map(dep => ctx[dep] ? ctx[dep] : Promise.resolve())), Observable.of(0))
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
    ).run(context).catch(err => {
      console.error('\n', err.message)
      process.exit(1)
    })
  }

  expandDependencies (task) {
    return this.collectDependencies(task).map(dep => ({ ...this.input[dep], name: dep }))
  }

  collectDependencies (task, acc = new Set([task])) {
    const dependencies = this.input[task].dependencies.filter(dep => !acc.has(dep))
    if (dependencies.length === 0) {
      return [...acc]
    }
    return [...new Set(Array.prototype.concat(...dependencies.map(dep => this.collectDependencies(dep, new Set([...acc, dep])))))]
  }
}

module.exports = { Tusk }
