const apps = [
  'loop',
  'loop-arusha-reporting',
  'loop-reporting',
  'loop-nlp-prototype'
]

const deps = {
  'loop-common': [],
  'loop-client-common': [],
  'loop-hotsos-2': ['loop-common'],
  'loop-guest-inbox': ['loop-common'],
  'loop-online': ['loop-common'],
  'loop-pulse-scoreboard': ['loop-common'],
  'loop-widget': ['loop-common'],
  'loop-decaf-pulse': ['loop-common'],
  'loop-arusha-reporting-ui': ['loop-common'],
  'loop-arusha-tnt': ['loop-common', 'loop-widget'],
  'loop-presenter': ['loop-common', 'loop-client-common', 'loop-arusha-tnt'],
  'loop-reporting': ['loop-common'],
  'loop-arusha-reporting': ['loop-common'],
  loop: [
    'loop-arusha-reporting-ui',
    'loop-arusha-tnt',
    'loop-common',
    'loop-decaf-pulse',
    'loop-guest-inbox',
    'loop-hotsos-2',
    'loop-online',
    'loop-presenter',
    'loop-pulse-scoreboard',
    'loop-widget'
  ]
}

module.exports = { apps, deps }
