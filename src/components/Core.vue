<template>
  <v-container>
    <v-row align="center" justify="center" class="text-center">
      <v-col cols="12">
        <Pogsix />
      </v-col>
      <v-col class="mb-4">
        <p class="subheading font-weight-regular">
          Bulk download your favorite images and videos through your browser.
          <br/>No software installation needed.
        </p>
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="search"
          autofocus
          clearable
          outlined
          rounded
          autocomplete="off"
          placeholder="fav:username esix order:score"
          prepend-inner-icon="mdi-magnify"
          :disabled="status !== Status.READY"
          @keyup.enter.prevent="initSearch"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row v-if="status === Status.READY" no-gutters align="center" justify="center" class="text-center">
      <v-col cols="12">
        <v-btn depressed color="primary" class="mr-3" @click="initSearch">Search</v-btn>
        <v-btn text :href="Urls.E621_HELP" target="_blank">Help</v-btn>
      </v-col>
      <v-col cols="auto">
        <v-switch v-model="sfwMode" inset label="SFW Mode" class="text-no-wrap" @change="updateSettings"></v-switch>
      </v-col>
      <v-col cols="12" class="my-3"></v-col>
      <v-col cols="auto" class="mx-1">
        <v-checkbox v-model="globalBlacklistOff" label="Bypass Global Blacklist" class="text-no-wrap" @change="updateSettings"></v-checkbox>
      </v-col>
      <v-col cols="auto" class="mx-1">
        <v-checkbox v-model="downloadPools" label="Download Pools" class="text-no-wrap" @change="updateSettings"></v-checkbox>
      </v-col>
    </v-row>
    <v-row v-else no-gutters align="center" justify="center" class="text-center">
      <v-col cols="12">
        <v-progress-linear
          rounded
          height="10"
          :value="progressValue"
          :active="showProgress"
          :indeterminate="progressIndeterminate"
          :query="true"
        ></v-progress-linear>
        <div>{{ statusText }}</div>
      </v-col>
      <v-col v-if="status === Status.AWAITING_USER_INPUT" cols="12">
        <v-card v-if="(fileCount.posts.whitelisted + fileCount.pools.whitelisted) > 0" flat tile color="transparent">
          <v-card-text class="text-h6 white--text">
            <div class="text-subtitle-1 font-weight-regular">Found {{ fileCount.posts.total }} posts</div>
            <span class="mr-2 success--text">
              <v-icon color="success">mdi-check</v-icon>
              {{ fileCount.posts.whitelisted }}
            </span>
            <span class="error--text">
              <v-icon color="error">mdi-close</v-icon>
              {{ fileCount.posts.blacklisted }}
            </span>
          </v-card-text>
          <v-card-text v-if="downloadPools" class="text-h6 white--text">
            <div class="text-subtitle-1 font-weight-regular">Detected {{ pools.length }} pools with {{ fileCount.pools.total }} posts</div>
            <span class="mr-2 success--text">
              <v-icon color="success">mdi-check</v-icon>
              {{ fileCount.pools.whitelisted }}
            </span>
            <span class="error--text">
              <v-icon color="error">mdi-close</v-icon>
              {{ fileCount.pools.blacklisted }}
            </span>
          </v-card-text>
          <v-card-text class="text-h6 white--text">
            {{ fileCount.posts.whitelisted + fileCount.pools.whitelisted }} files ({{ downloadSize }} MB)<br/><span class="text-subtitle-1">will be downloaded.</span>
          </v-card-text>
          <v-spacer class="my-5"></v-spacer>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text color="primary" @click="restart">Abort</v-btn>
            <v-btn depressed color="primary" @click="download">Download</v-btn>
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
        <v-card v-else flat tile color="transparent">
          <v-card-text class="text-h6 white--text mb-5">
            Nope. Nothing here.<br/>¯\_(ツ)_/¯
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn depressed color="primary" @click="restart">Try again</v-btn>
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col v-else-if="status === Status.DONE" cols="12">
        <v-card flat tile color="transparent">
          <v-card-text class="text-h6 white--text">
            Download complete.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <!--- <v-btn text color="primary" @click="restart">Discard</v-btn>
            <v-btn depressed color="primary" @click="generateZipFile(files, filesPools, 1)">Save</v-btn> --->
            <v-btn depressed color="primary" @click="restart">Finish</v-btn>
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import Pogsix from '@/components/Pogsix.vue'
import streamSaver from 'streamsaver'
import * as pony from 'web-streams-polyfill/ponyfill'
import '@/plugins/zip-stream.js'
import { Headers, Urls, Status, LocalStorage, Timer } from '@/constants.js'

export default {
  name: 'Core',
  components: {
    Pogsix
  },
  data: () => ({
    Urls,
    Status,
    status: Status.READY,
    postsPerPage: 320, // There is a hard limit of 320 posts per request; as per API docs
    pendingApiRequests: 0,
    search: null,
    searchResults: [],
    poolsDetected: 0,
    filesDownloaded: 0,
    files: [],
    filesPools: [],
    pools: [],
    // localStorage
    sfwMode: true,
    globalBlacklistOff: true,
    downloadPools: false
  }),
  computed: {
    statusText () {
      switch (this.status) {
        case Status.RETRIEVING_POSTS: return this.searchResults.length > 0 ? `Searching (${this.searchResults.length} posts found)...` : 'Searching...'
        case Status.RETRIEVING_POOLS: return `Detecting pools...`
        case Status.RETRIEVING_POOL_POSTS: return `Scanning pools (${this.poolsDetected - this.pools.length} left)...`
        case Status.DOWNLOADING: return `Downloading post ${this.filesDownloaded} of ${this.fileCount.posts.whitelisted + this.fileCount.pools.whitelisted}...`
        case Status.ZIPPING: return 'Zipping...'
        case Status.SAVING: return 'Saving ZIP file...'
        default: return ''
      }
    },
    showProgress () {
      switch (this.status) {
        case Status.RETRIEVING_POSTS:
        case Status.RETRIEVING_POOLS:
        case Status.RETRIEVING_POOL_POSTS:
        case Status.DOWNLOADING:
        case Status.ZIPPING:
        case Status.SAVING:
        case Status.DONE:
          return true
        default: return false
      }
    },
    progressIndeterminate () {
      switch (this.status) {
        case Status.RETRIEVING_POSTS:
        case Status.RETRIEVING_POOLS:
        case Status.RETRIEVING_POOL_POSTS:
        case Status.ZIPPING:
        case Status.SAVING:
          return true
        default: return false
      }
    },
    progressValue () {
      return (100 * this.filesDownloaded) / (this.fileCount.posts.whitelisted + this.fileCount.pools.whitelisted)
    },
    searchResultsFiltered () {
      const filtered = this.searchResults.filter(v => {
        return !v.file.skipDownload && (this.globalBlacklistOff || !!v.file.url)
      })
      return filtered
    },
    poolsFiltered () {
      const filtered = []
      this.pools.forEach(pool => {
        const postsFiltered = pool.posts.filter(p => {
          if (this.globalBlacklistOff) {
            return true
          } else {
            return !!p.file.url
          }
        })
        filtered.push({ pool: pool.pool, posts: postsFiltered })
      })
      return filtered
    },
    fileCount () {
      const postsTotal = this.searchResults.length
      const postsWhitelisted = this.searchResultsFiltered.length
      const postsBlacklisted = postsTotal - postsWhitelisted
      const posts = { total: postsTotal, whitelisted: postsWhitelisted, blacklisted: postsBlacklisted }

      const poolsTotal = this.pools.reduce((acc, cur) => acc + cur.posts.length, 0)
      const poolsWhitelisted = this.poolsFiltered.reduce((acc, cur) => acc + cur.posts.length, 0)
      const poolsBlacklisted = poolsTotal - poolsWhitelisted
      const pools = { total: poolsTotal, whitelisted: poolsWhitelisted, blacklisted: poolsBlacklisted }

      return { posts, pools }
    },
    downloadSize () {
      const postsSizeBytes = this.searchResultsFiltered.reduce((accumulator, currentValue) => accumulator + currentValue.file.size, 0)
      const poolsSizeBytes = this.poolsFiltered.reduce((accumulator, currentValue) => accumulator + currentValue.posts.reduce((acc2, cur2) => acc2 + cur2.file.size, 0), 0)
      return ((postsSizeBytes + poolsSizeBytes) / (1000 * 1000)).toFixed(2) // Return size as MB with 2 decimals
    },
    mainDirName () {
      let dirName = this.search.split(' ')[0] // first tag is the main directory name
      if (dirName.includes(':')) {
        const tags = dirName.split(':')
        switch (tags[0]) {
          case 'favoritedby':
          case 'fav':
            dirName = `${tags[1]}'s Favorites`
            break
          case 'user':
            dirName = `${tags[1]}'s Uploads`
            break
          case 'approver':
            dirName = `${tags[1]}'s Approvals`
            break
          // default: dirName = tags[1]
        }
      }
      return dirName
    }
  },
  methods: {
    updateSettings () {
      localStorage.setItem(LocalStorage.SETTINGS + '.sfwmode', this.sfwMode)
      localStorage.setItem(LocalStorage.SETTINGS + '.globalblacklistoff', this.globalBlacklistOff)
      localStorage.setItem(LocalStorage.SETTINGS + '.downloadpools', this.downloadPools)
    },
    initSearch () {
      if (this.search) this.search = this.search.trim()
      if (this.search) {
        this.status = Status.RETRIEVING_POSTS

        // Add 'rating:safe' tag to query string if SFW mode is on and tag is not included already
        if (this.sfwMode && !['rating:safe', 'rating:s'].some(term => this.search.includes(term))) {
          this.search += ' rating:safe'
        }

        this.searchPosts(null)
      }
    },
    searchPosts (fromID) {
      this.axios.get(Urls.CORS_PROXY + Urls.E621_POSTS, {
        headers: { 'User-Agent': Headers.USER_AGENT },
        params: {
          tags: this.search,
          limit: this.postsPerPage,
          ...(fromID ? { page: `b${fromID}` } : {})
        }
      }).then((response) => {
        this.searchResults = [...this.searchResults, ...response.data.posts]
        if (response.data.posts.length === 320) {
          this.searchPosts(response.data.posts[response.data.posts.length - 1].id)
        } else {
          for (let i = 0; i < this.searchResults.length; i++) {
            const fileUrl = this.searchResults[i].file.url
            if (!fileUrl) {
              this.$set(this.searchResults[i].file, 'constructedUrl', this.constructSourceUrl(this.searchResults[i]))
            }
          }
          
          if (this.downloadPools) this.fetchPools()
          else this.status = Status.AWAITING_USER_INPUT
        }
      })
    },
    constructSourceUrl (post) {
      const fileHash = post.file.md5
      const fileExtension = post.file.ext
      const urlPathP1 = fileHash.substring(0, 2) // First 2 characters of md5
      const urlPathP2 = fileHash.substring(2, 4) // 3rd and 4th character of md5
      return `${Urls.E621_STATIC}${urlPathP1}/${urlPathP2}/${fileHash}.${fileExtension}`
    },
    fetchPools () {
      this.status = Status.RETRIEVING_POOLS

      const poolIds = []
      for (let i = 0; i < this.searchResults.length; i++) {
        const pools = this.searchResults[i].pools
        if (pools.length > 0) {
          pools.forEach(id => poolIds.indexOf(id) === -1 && poolIds.push(id))
          this.$set(this.searchResults[i].file, 'skipDownload', true)
        }
      }

      if (poolIds.length === 0) {
        this.status = Status.AWAITING_USER_INPUT
        return
      }

      this.pendingApiRequests++
      this.axios.get(Urls.CORS_PROXY + Urls.E621_POOLS, {
        headers: { 'User-Agent': Headers.USER_AGENT },
        params: {
          'search[id]': poolIds.join(',')
        }
      }).then(response => {
        this.poolsDetected = response.data.length
        // this.fetchPoolPosts(response.data)
        this.prepareFetchPoolPosts(response.data)
      }).catch(error => {
        console.log(error)
      }).then(() => {
        this.pendingApiRequests--
      })
    },
    async prepareFetchPoolPosts (poolMetadata) {
      this.status = Status.RETRIEVING_POOL_POSTS

      for (let i = 0; i < poolMetadata.length; i++) {
        this.pools.push({ pool: poolMetadata[i], posts: [] })
        this.fetchPoolPosts(poolMetadata[i].id, null)
        await Timer(500) // As per API docs: "E621/E926 have a hard rate limit of two requests per second."
      }

      // Every second, check if all api requests completed
      const completionInterval = setInterval(() => {
        if (this.pendingApiRequests === 0) {
          clearInterval(completionInterval)
          this.status = Status.AWAITING_USER_INPUT
        }
      }, 1000)
    },
    fetchPoolPosts (poolID, fromID) {
      this.pendingApiRequests++
      this.axios.get(Urls.CORS_PROXY + Urls.E621_POSTS, {
        headers: { 'User-Agent': Headers.USER_AGENT },
        params: {
          tags: `pool:${poolID}${this.sfwMode ? ' rating:safe' : ''}`,
          limit: 320,
          ...(fromID ? { page: `b${fromID}` } : {})
        }
      }).then(response2 => {
        let targetPool = this.pools.find(p => p.pool.id === poolID)
        targetPool.posts = [...targetPool.posts, ...response2.data.posts]

        if (response2.data.posts.length === 320) {
          this.fetchPoolPosts(poolID, response2.data.posts[response2.data.posts.length - 1].id)
        } else {
          for (let j = 0; j < targetPool.posts.length; j++) {
            const fileUrl = targetPool.posts[j].file.url
            if (!fileUrl) {
              this.$set(targetPool.posts[j].file, 'constructedUrl', this.constructSourceUrl(targetPool.posts[j]))
            }
          }
        }
      }).catch(error => {
        console.log(error)
      }).then(() => {
        this.pendingApiRequests--
      })
    },
    async download () {
      this.status = Status.DOWNLOADING

      // Download posts
      for (let i = 0; i < this.searchResultsFiltered.length; i++) {
        const fileUrl = this.searchResultsFiltered[i].file.url
        const constructedUrl = this.searchResultsFiltered[i].file.constructedUrl
        this.pendingApiRequests++

        this.axios.get(`${Urls.CORS_PROXY}${fileUrl || constructedUrl}`, {
          responseType: 'arraybuffer'
        }).then(response => {
          this.files.push({ post: this.searchResultsFiltered[i], data: new Uint8Array(response.data) })
          this.filesDownloaded++
        }).catch(error => {
          console.log(error)
        }).then(() => {
          this.pendingApiRequests--
        })

        // Limit concurrent network requests to 5
        while (this.pendingApiRequests > 5) await Timer(200)
      }

      // Download pools
      this.filesPools = this.poolsFiltered
      for (let k = 0; k < this.filesPools.length; k++) {
        for (let l = 0; l < this.filesPools[k].posts.length; l++) {
          const fileUrl = this.filesPools[k].posts[l].file.url
          const constructedUrl = this.filesPools[k].posts[l].file.constructedUrl
          this.pendingApiRequests++

          this.axios.get(`${Urls.CORS_PROXY}${fileUrl || constructedUrl}`, {
            responseType: 'arraybuffer'
          }).then(response => {
            this.$set(this.filesPools[k].posts[l].file, 'binaryData', new Uint8Array(response.data))
            this.filesDownloaded++
          }).catch(error => {
            console.log(error)
          }).then(() => {
            this.pendingApiRequests--
          })

          // Limit concurrent network requests to 5
          while (this.pendingApiRequests > 5) await Timer(200)
        }
      }

      // Every second, check if all downloads finished
      const completionInterval = setInterval(() => {
        if (this.pendingApiRequests === 0) {
          // const filesDownloaded = this.files.length
          // const filesSkipped = this.searchResults.length - this.files.length
          // console.log(`Downloaded ${filesDownloaded}, skipped ${filesSkipped} files.`)
          clearInterval(completionInterval)
          this.generateZipFile(this.files, this.filesPools, 1)
        }
      }, 1000)
    },
    generateZipFile (_files, _filesPools, zipNumber) {
      streamSaver.mitm = process.env.BASE_URL + 'streamsaver/mitm.html?version=' + streamSaver.version.full
      const zipFileName = `e621_grabber_${zipNumber}.zip`
      const dirName = this.mainDirName
      const fileStream = streamSaver.createWriteStream(zipFileName)
      const files = _files
      const filesPools = _filesPools
      let zipSizeLimitExceeded = false

      const readableZipStream = window.ZIP({
        start (ctrl) {
          if (zipNumber === 1) ctrl.enqueue({ name: dirName, directory: true })
          const zipMaxSize = 4 * 1000 * 1000 * 1000 // Limit ZIP size to 4GB; refer to streamSaver.js
          let dataSize = 0

          // Posts
          for (let f = 0; f < files.length; f++) {
            const fileSize = files[f].data.length

            if ((dataSize + fileSize) < zipMaxSize) {
              const fileHash = files[f].post.file.md5
              const fileExtension = files[f].post.file.ext
              const fileName = `${fileHash}.${fileExtension}`
              const file1 = new File([files[f].data], `${dirName}/${fileName}`)

              ctrl.enqueue(file1)
              dataSize += fileSize
              files.splice(files.indexOf(files[f]), 1)
              f--
            } else {
              zipSizeLimitExceeded = true
              break
            }
          }

          // Pools
          for (let p = 0; p < filesPools.length; p++) {
            const poolSize = filesPools[p].posts.reduce((acc, cur) => acc + cur.file.binaryData.length, 0)

            if ((dataSize + poolSize) < zipMaxSize) {
              const poolDirName = `[${filesPools[p].pool.id}] ${filesPools[p].pool.name.replaceAll('_', ' ')}`
              ctrl.enqueue({ name: `${dirName}/${poolDirName}`, directory: true })

              for (const file of filesPools[p].posts) {
                const fileId = file.id
                const fileExtension = file.file.ext
                const fileName = `${filesPools[p].pool.post_ids.indexOf(fileId)+1}.${fileExtension}`
                // const fileHash = file.file.md5
                // const fileName = `${fileHash}.${fileExtension}`
                const file2 = new File([file.file.binaryData], `${dirName}/${poolDirName}/${fileName}`)
                ctrl.enqueue(file2)
              }

              dataSize += poolSize
              filesPools.splice(filesPools.indexOf(filesPools[p]), 1)
              p--
            } else {
              zipSizeLimitExceeded = true
              break
            }
          }

          ctrl.close()
        }
      })

      if (zipSizeLimitExceeded) this.generateZipFile(files, filesPools, zipNumber+1)

      this.status = Status.SAVING
      if (window.WritableStream && readableZipStream.pipeTo) {
        // more optimized
        return readableZipStream.pipeTo(fileStream).catch(err => {
          this.status = Status.DONE
          console.log(`StreamSaver.js: something went wrong...`)
          console.log(err)
        }).then(() => {
          this.status = Status.DONE
          console.log(`StreamSaver.js: done writing ${zipFileName}.`)
        })
      } else {
        // less optimized
        const writer = fileStream.getWriter()
        const reader = readableZipStream.getReader()
        const pump = () => reader.read()
          .then(res => {
            if (res.done) {
              this.status = Status.DONE
              writer.close()
            } else {
              writer.write(res.value).then(pump)
            }
          })
        pump()
      }
    },
    restart () {
      this.status = Status.READY
      this.pendingApiRequests = 0
      this.searchResults = []
      this.pools = []
      this.filesDownloaded = 0
      this.files = []
      this.filesPools = []
    }
  },
  created () {
    // Ponyfill for firefox
    if (!window.WritableStream) {
      streamSaver.WritableStream = pony.WritableStream
      window.WritableStream = pony.WritableStream
    }

    // Read preferences from localStorage
    const sfwMode = JSON.parse(localStorage.getItem(LocalStorage.SETTINGS + '.sfwmode'))
    const globalBlacklistOff = JSON.parse(localStorage.getItem(LocalStorage.SETTINGS + '.globalblacklistoff'))
    const downloadPools = JSON.parse(localStorage.getItem(LocalStorage.SETTINGS + '.downloadpools'))
    this.sfwMode = sfwMode !== null ? sfwMode : true
    this.globalBlacklistOff = globalBlacklistOff !== null ? globalBlacklistOff : true
    this.downloadPools = downloadPools !== null ? downloadPools : false
  }
}
</script>
