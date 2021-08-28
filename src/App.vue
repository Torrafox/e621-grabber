<template>
  <v-app :style="{ background: $vuetify.theme.themes[theme].background }">
    <v-app-bar
      app
      color="primary"
      dark
    >
      <div class="d-flex align-center">
        <h1 class="text-h5 font-weight-bold">
          e621-Grabber
        </h1>
      </div>

      <v-spacer></v-spacer>

      <v-btn
        href="https://github.com/Torrafox/e621-grabber"
        target="_blank"
        text
      >
        <span class="mr-2">GitHub</span>
        <v-icon>mdi-github</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <HelloWorld/>
    </v-main>
    <v-footer app padless>
      <v-card flat tile max-width="600" color="transparent" class="text-center mx-auto">
        <v-card-text>
          This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with <a :href="e621Url" target="_blank">e621.net</a>, or any of its subsidiaries or its affiliates.
          <br/>pog621 by <a href="https://e621.net/users/584293" target="_blank">Redcrystal</a>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-text>Copyright © 2021 <a :href="ownerUrl" target="_blank">Torrafox</a></v-card-text>
      </v-card>
    </v-footer>
  </v-app>
</template>

<script>
import HelloWorld from './components/HelloWorld'

export default {
  name: 'App',
  components: {
    HelloWorld
  },
  data: () => ({
    ownerUrl: 'https://github.com/Torrafox',
    e621Url: 'https://e621.net'
  }),
  computed: {
    theme () {
      return (this.$vuetify.theme.dark) ? 'dark' : 'light'
    }
  }
}
</script>
