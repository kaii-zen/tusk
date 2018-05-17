const { exec } = require('./lib/exec')
const { Tusk } = require('./')

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

const tusk = new Tusk(input)

const build = () => tusk.run('build')

module.exports = { build }
