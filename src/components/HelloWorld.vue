<template>
  <v-container>
    <v-row align="center" justify="center" class="text-center">
      <v-col cols="12">
        <Pogsix />
      </v-col>
      <v-col class="mb-4">
        <p class="subheading font-weight-regular">
          Bulk download your favorite images and videos.
          <br/>No need to compile or install anything on your device.
        </p>
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="search"
          autofocus
          clearable
          outlined
          rounded
          placeholder="esix rating:s"
          prepend-inner-icon="mdi-magnify"
          :disabled="status !== statusEnum.READY"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row v-if="status === statusEnum.READY" no-gutters align="center" justify="center" class="text-center">
      <v-col cols="12" class="mb-5">
        <v-btn depressed color="primary" class="mb-2" @click="initSearch(null)">Search</v-btn>
        <div class="text-caption"><a href="https://e621.net/help/cheatsheet" target="_blank">Search help</a></div>
      </v-col>
      <v-col cols="auto">
        <v-checkbox v-model="globalBlacklistOff" label="Bypass Global Blacklist"></v-checkbox>
      </v-col>
      <v-col cols="auto">
        <v-checkbox v-model="downloadPools" label="Download Pools"></v-checkbox>
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
      <v-col v-if="status === statusEnum.AWAITING_USER_INPUT" cols="12">
        <v-card flat tile color="transparent">
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
            <div class="text-subtitle-1 font-weight-regular">Detected {{ fileCount.pools.total }} posts in {{ pools.length }} pools</div>
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
      </v-col>
      <v-col v-else-if="status === statusEnum.DONE" cols="12">
        <v-card flat tile color="transparent">
          <v-card-text class="text-h6 white--text">
            Download complete.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text color="primary" @click="restart">Discard</v-btn>
            <v-btn depressed color="primary" @click="generateZipArchive">Save</v-btn>
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
import '@/plugins/zip-stream.js'
import { saveAs } from 'file-saver'

const CORS_PROXY = 'https://grabber-cors-anywhere.herokuapp.com/'
const Status = Object.freeze({
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

export default {
  name: 'HelloWorld',
  components: {
    Pogsix
  },
  data: () => ({
    statusEnum: Status,
    status: Status.READY,
    postsPerPage: 320, // There is a hard limit of 320 posts per request; as per API docs
    search: 'renamon fav:RaRa young',
    searchResults: [],
    pendingApiRequests: 0,
    filesDownloaded: 0,
    files: [],
    filesPools: [],
    pools: [],
    // Preferences
    globalBlacklistOff: true,
    downloadPools: true
  }),
  computed: {
    statusText () {
      switch (this.status) {
        case Status.RETRIEVING_POSTS: return this.searchResults.length > 0 ? `Searching (${this.searchResults.length} posts found)...` : 'Searching...'
        case Status.RETRIEVING_POOLS: return `Detecting pools...`
        case Status.RETRIEVING_POOL_POSTS: return `Scanning pools (${this.pendingApiRequests} left)...`
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
        if (this.globalBlacklistOff) {
          return true
        } else {
          return !!v.file.url
        }
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
    }
  },
  methods: {
    initSearch (fromID) {
      this.status = Status.RETRIEVING_POSTS
      this.axios.get('https://e621.net/posts.json', {
        params: {
          tags: this.search,
          limit: this.postsPerPage,
          ...(fromID ? { page: `b${fromID}` } : {})
        }
      }).then((response) => {
        console.log(response.data)
        this.searchResults = [...this.searchResults, ...response.data.posts]
        if (response.data.posts.length === 320) {
          this.initSearch(response.data.posts[response.data.posts.length - 1].id)
        } else {
          console.log(`Found ${this.searchResults.length} posts.`)
          console.log(this.searchResults)

          for (let i = 0; i < this.searchResults.length; i++) {
            const fileUrl = this.searchResults[i].file.url
            if (!fileUrl) {
              this.$set(this.searchResults[i].file, 'constructedUrl', this.constructSourceUrl(this.searchResults[i]))
            }
          }
          
          if (this.downloadPools) this.prepare()
          else this.status = Status.AWAITING_USER_INPUT
        }
      })
    },
    constructSourceUrl (post) {
      const fileHash = post.file.md5
      const fileExtension = post.file.ext
      const urlPathP1 = fileHash.substring(0, 2) // First 2 characters of md5
      const urlPathP2 = fileHash.substring(2, 4) // 3rd and 4th character of md5
      return `https://static1.e621.net/data/${urlPathP1}/${urlPathP2}/${fileHash}.${fileExtension}`
    },
    prepare () {
      this.status = Status.RETRIEVING_POOLS

      const poolIds = []
      for (let i = 0; i < this.searchResults.length; i++) {
        const pools = this.searchResults[i].pools
        pools.forEach(id => poolIds.indexOf(id) === -1 && poolIds.push(id))
      }

      this.pendingApiRequests++
      this.axios.get('https://e621.net/pools.json', {
        params: {
          'search[id]': poolIds.join(',')
        }
      }).then(response => {
        this.status = Status.RETRIEVING_POOL_POSTS
        response.data.forEach(entry => {
          this.pendingApiRequests++
          this.axios.get(CORS_PROXY + 'https://e621.net/posts.json', {
            params: {
              tags: `pool:${entry.id}`,
              limit: 320
            }
          }).then(response2 => {
            for (let j = 0; j < response2.data.posts.length; j++) {
              const fileUrl = response2.data.posts[j].file.url
              if (!fileUrl) {
                this.$set(response2.data.posts[j].file, 'constructedUrl', this.constructSourceUrl(response2.data.posts[j]))
              }
            }
            this.pools.push({ pool: entry, posts: response2.data.posts })
          }).catch(error => {
            console.log(error)
          }).then(() => {
            this.pendingApiRequests--
          })
        })
      }).catch(error => {
        console.log(error)
      }).then(() => {
        this.pendingApiRequests--
      })

      // Every second, check if all api requests completed
      const completionInterval = setInterval(() => {
        if (this.pendingApiRequests === 0) {
          clearInterval(completionInterval)
          this.status = Status.AWAITING_USER_INPUT
          console.log(`${this.searchResultsFiltered.length} files ready to download, totalling ${this.downloadSize} MB. ${this.searchResults.length - this.searchResultsFiltered.length} posts blacklisted.`)
        }
      }, 1000)
    },
    download () {
      this.status = Status.DOWNLOADING
      let requestsQueued = 0

      // Download posts
      for (let i = 0; i < this.searchResultsFiltered.length; i++) {
        const fileUrl = this.searchResultsFiltered[i].file.url
        const constructedUrl = this.searchResultsFiltered[i].file.constructedUrl
        requestsQueued++

        // TODO: not more than 5 concurrent requests
        this.axios.get(`${CORS_PROXY}${fileUrl || constructedUrl}`, {
          responseType: 'arraybuffer'
        }).then(response => {
          this.files.push({ post: this.searchResultsFiltered[i], data: new Uint8Array(response.data) })
          this.filesDownloaded++
        }).catch(error => {
          console.log(error)
        }).then(() => {
          requestsQueued--
        })
      }

      // Download pools
      this.filesPools = this.poolsFiltered
      for (let k = 0; k < this.filesPools.length; k++) {
        for (let l = 0; l < this.filesPools[k].posts.length; l++) {
          const fileUrl = this.filesPools[k].posts[l].file.url
          const constructedUrl = this.filesPools[k].posts[l].file.constructedUrl
          requestsQueued++

          // TODO: not more than 5 concurrent requests
          this.axios.get(`${CORS_PROXY}${fileUrl || constructedUrl}`, {
            responseType: 'arraybuffer'
          }).then(response => {
            this.$set(this.filesPools[k].posts[l].file, 'binaryData', new Uint8Array(response.data))
            this.filesDownloaded++
          }).catch(error => {
            console.log(error)
          }).then(() => {
            requestsQueued--
          })
        }
      }

      // Every second, check if all downloads finished
      const completionInterval = setInterval(() => {
        if (requestsQueued === 0) {
          // const filesDownloaded = this.files.length
          // const filesSkipped = this.searchResults.length - this.files.length
          // console.log(`Downloaded ${filesDownloaded}, skipped ${filesSkipped} files.`)

          clearInterval(completionInterval)
          this.generateZipArchive()
        }
      }, 1000)
    },
    generateZipArchive () {
      this.status = Status.ZIPPING

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

      streamSaver.mitm = '/streamsaver/mitm.html?version=' + streamSaver.version.full
      const fileStream = streamSaver.createWriteStream('e621_grabber.zip')
      const files = this.files
      const filesPools = this.filesPools

      const readableZipStream = window.ZIP({
        start (ctrl) {
          ctrl.enqueue({ name: dirName, directory: true})

          // Posts
          for (const file of files) {
            const fileHash = file.post.file.md5
            const fileExtension = file.post.file.ext
            const fileName = `${fileHash}.${fileExtension}`

            const file1 = new File([file.data], `${dirName}/${fileName}`)
            ctrl.enqueue(file1)
          }

          // Pools
          filesPools.forEach(pool => {
            const poolDirName = `[${pool.pool.id}] ${pool.pool.name.replaceAll('_', ' ')}`
            ctrl.enqueue({ name: `${dirName}/${poolDirName}`, directory: true})

            for (const file of pool.posts) {
              const fileId = file.id
              const fileExtension = file.file.ext
              const fileName = `${pool.pool.post_ids.indexOf(fileId)+1}.${fileExtension}`
              // const fileHash = file.file.md5
              // const fileName = `${fileHash}.${fileExtension}`

              const file2 = new File([file.file.binaryData], `${dirName}/${poolDirName}/${fileName}`)
              ctrl.enqueue(file2)
            }
          })

          ctrl.close()
        }
      })

      // more optimized
      this.status = Status.SAVING
      if (window.WritableStream && readableZipStream.pipeTo) {
        return readableZipStream.pipeTo(fileStream).then(() => {
          this.status = Status.DONE
          console.log('StreamSaver.js: done writing.')
        })
      }
    },
    save () {
      saveAs(new Blob([this.zipFile]), 'e621_grabber.zip')
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
  }
}
</script>
