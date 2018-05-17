const execa = require('execa')
const { basename } = require('path')
const { Observable } = require('rxjs')
const streamToObservable = require('stream-to-observable')
const split = require('split')

const exec = (cmd, args, opts) => {
  const cp = execa(cmd, args, opts)

  return Observable.merge(
    streamToObservable(cp.stdout.pipe(split()), { await: cp }),
    streamToObservable(cp.stderr.pipe(split()), { await: cp })
  ).filter(Boolean)
}

const execTask = (cmd, args, opts = {}) => ({
  title: opts.title
    ? opts.title
    : opts.cwd
      ? basename(opts.cwd) + '> '
      : '' + `${cmd} ${args.join(' ')}`,
  task: () => exec(cmd, args, opts)
})

module.exports = {
  exec,
  execTask
}
