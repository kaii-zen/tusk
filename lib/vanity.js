const makeFancy = (logo, color) => txt => {
  const decor = color(logo + '  ' + logo)
  return `${decor}  ${txt}  ${decor}`
}

module.exports = { makeFancy }
