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
          :disabled="searchInitiated"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row v-if="!searchInitiated" no-gutters align="center" justify="center" class="text-center">
      <v-col cols="12">
        <v-btn depressed color="primary" :loading="searching" class="mb-2" @click="initSearch">Search</v-btn>
        <div class="text-caption"><a href="https://e621.net/help/cheatsheet" target="_blank">Search help</a></div>
      </v-col>
      <v-col cols="auto">
        <v-checkbox v-model="globalBlacklistOff" label="Bypass Global Blacklist"></v-checkbox>
        <v-checkbox v-model="downloadPools" label="Download pools"></v-checkbox>
      </v-col>
    </v-row>
    <v-row v-else no-gutters align="center" justify="center" class="text-center">
      <v-col cols="12">
        <v-progress-linear
          rounded
          height="10"
          :value="progressValue"
          :active="searching || downloading"
          :indeterminate="searching"
          :query="true"
        ></v-progress-linear>
      </v-col>
      <v-col v-if="!searching" cols="12">
        <v-card flat tile color="transparent">
          <v-card-text class="text-subtitle-1 white--text">
            <div>Found {{ fileCount.posts.total }} posts and {{ pools.length }} pools</div>
            <div class="success--text">{{ fileCount.posts.whitelisted }} ready to download</div>
            <div>{{ fileCount.posts.blacklisted }} blacklisted</div>
            <div>Found {{ fileCount.pools.total }} pool posts</div>
            <div class="success--text">{{ fileCount.pools.whitelisted }} ready to download</div>
            <div>{{ fileCount.pools.blacklisted }} blacklisted</div>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text color="primary" @click="finSearch">Abort</v-btn>
            <v-btn depressed color="primary" @click="download">Download ({{ downloadSize }} MB)</v-btn>
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import Pogsix from '@/components/Pogsix.vue'
import { saveAs } from 'file-saver'
import { zip } from 'fflate'

export default {
  name: 'HelloWorld',
  components: {
    Pogsix
  },
  data: () => ({
    postsPerPage: 75, // There is a hard limit of 320 posts per request; as per API docs
    search: 'renamon fav:RaRa young',
    searchInitiated: false,
    searching: false,
    searchResults: [],
    pendingApiRequests: 0,
    downloading: false,
    filesDownloaded: 0,
    files: [],
    filesPools: [],
    pools: [],
    // Preferences
    globalBlacklistOff: true,
    downloadPools: true
  }),
  computed: {
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
    initSearch () {
      this.searchInitiated = true
      this.searching = true
      this.searchResults = []
      this.test(null)
    },
    test (fromID) {
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
          this.test(response.data.posts[response.data.posts.length - 1].id)
        } else {
          console.log(`Found ${this.searchResults.length} posts.`)
          console.log(this.searchResults)
          this.prepare()
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
      const poolIds = []
      for (let i = 0; i < this.searchResults.length; i++) {
        const fileUrl = this.searchResults[i].file.url
        const pools = this.searchResults[i].pools
        pools.forEach(id => poolIds.indexOf(id) === -1 && poolIds.push(id))

        if (!fileUrl) {
          this.$set(this.searchResults[i].file, 'constructedUrl', this.constructSourceUrl(this.searchResults[i]))
        }
      }

      this.pendingApiRequests++
      this.axios.get('https://e621.net/pools.json', {
        params: {
          'search[id]': poolIds.join(',')
        }
      }).then(response => {
        response.data.forEach(entry => {
          this.pendingApiRequests++
          this.axios.get('https://e621.net/posts.json', {
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
          this.searching = false
          console.log(`${this.searchResultsFiltered.length} files ready to download, totalling ${this.downloadSize} MB. ${this.searchResults.length - this.searchResultsFiltered.length} posts blacklisted.`)
        }
      }, 1000)
    },
    download () {
      this.downloading = true
      let requestsQueued = 0

      // Download posts
      for (let i = 0; i < this.searchResultsFiltered.length; i++) {
        const fileUrl = this.searchResultsFiltered[i].file.url
        const constructedUrl = this.searchResultsFiltered[i].file.constructedUrl
        requestsQueued++

        this.axios.get(`https://grabber-cors-anywhere.herokuapp.com/${fileUrl || constructedUrl}`, {
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

          this.axios.get(`https://grabber-cors-anywhere.herokuapp.com/${fileUrl || constructedUrl}`, {
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
          this.save()
        }
      }, 1000)
    },
    save () {
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
      const obj = {}

      for (const file of this.files) {
        const fileHash = file.post.file.md5
        const fileExtension = file.post.file.ext
        const fileName = `${fileHash}.${fileExtension}`

        obj[fileName] = file.data
      }

      // Pools
      this.filesPools.forEach(pool => {
        const poolObj = {}
        for (const file of pool.posts) {
          const fileHash = file.file.md5
          const fileExtension = file.file.ext
          const fileName = `${fileHash}.${fileExtension}`
          poolObj[fileName] = file.file.binaryData
        }
        obj[`(${pool.pool.id}) ${pool.pool.name.replaceAll('_', ' ')}`] = poolObj
      })

      zip({ [dirName]: obj }, {
        level: 0
      }, (err, data) => {
        saveAs(new Blob([data]), 'e621_grabber.zip')
      })
    },
    finSearch () {
      this.searchInitiated = false
      this.files = []
    }
  }
}
</script>
