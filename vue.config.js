module.exports = {
  publicPath: process.env.NODE_ENV === 'production'
    ? '/e621-grabber/'
    : '/',
  transpileDependencies: [
    'vuetify'
  ]
}
