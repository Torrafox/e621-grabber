export const Headers = Object.freeze({
  USER_AGENT: 'e621-Grabber/1.0 (by Torrafox on e621)'
})

export const Urls = Object.freeze({
  CORS_PROXY: 'https://grabber-cors-anywhere.herokuapp.com/',
  E621: 'https://e621.net/',
  get E621_HELP () { return this.E621 + 'help/cheatsheet' },
  get E621_POSTS () { return this.E621 + 'posts.json' },
  get E621_POOLS () { return this.E621 + 'pools.json' },
  E621_STATIC: 'https://static1.e621.net/data/',
  get E621_REDCRYSTAL () { return this.E621 + 'users/584293' },
  AUTHOR: 'https://github.com/Torrafox',
  REPO: 'https://github.com/Torrafox/e621-grabber'
})

export const Status = Object.freeze({
  READY: 0,
  RETRIEVING_POSTS: 1,
  RETRIEVING_POOLS: 2,
  RETRIEVING_POOL_POSTS: 3,
  AWAITING_USER_INPUT: 4,
  DOWNLOADING: 5,
  ZIPPING: 6,
  SAVING: 7,
  DONE: 8
})

export const LocalStorage = Object.freeze({
  MAIN: 'e621-grabber',
  get SETTINGS () { return this.MAIN + '.settings' }
})

export const Timer = ms => new Promise(res => setTimeout(res, ms))