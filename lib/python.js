const path = require('path')
const fs = require('fs')
const execa = require('execa')

const packagePath = pkg => path.join(__dirname, pkg)
const packageHas = what => pkg =>
  fs.existsSync(path.join(packagePath(pkg), what))

const hasSetupPy = packageHas('setup.py')

const requireSetupPy = app => {
  const { stdout } = execa.sync(
    'python',
    ['-c', 'from setup import package; import json; print json.dumps(package)'],
    {
      cwd: packagePath(app)
    }
  )
  return JSON.parse(stdout)
}

module.exports = {
  requireSetupPy,
  hasSetupPy
}
