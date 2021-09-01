<template>
  <v-app :style="{ background: $vuetify.theme.themes[theme].background }">
    <v-app-bar app dark color="primary">
      <div class="d-flex align-center">
        <h1 class="text-h5 font-weight-bold">
          e621-Grabber
        </h1>
      </div>
      <v-spacer></v-spacer>
      <v-btn text :href='Urls.REPO' target="_blank">
        <span class="mr-2">GitHub</span>
        <v-icon>mdi-github</v-icon>
      </v-btn>
    </v-app-bar>
    <v-main>
      <Core />
    </v-main>
    <v-footer app absolute padless>
      <v-card flat tile max-width="600" color="transparent" class="text-center mx-auto">
        <v-card-text>
          This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with <a :href="Urls.E621" target="_blank">e621.net</a>, or any of its subsidiaries or its affiliates.
          <br/>pog621 by <a :href="Urls.E621_REDCRYSTAL" target="_blank">Redcrystal</a>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-text>Copyright © 2021 <a :href="Urls.AUTHOR" target="_blank">Torrafox</a></v-card-text>
      </v-card>
    </v-footer>
  </v-app>
</template>

<script>
import Core from '@/components/Core.vue'
import { Urls } from '@/constants.js'

export default {
  name: 'App',
  components: {
    Core
  },
  data: () => ({
    Urls
  }),
  computed: {
    theme () {
      return (this.$vuetify.theme.dark) ? 'dark' : 'light'
    }
  }
}
</script>
