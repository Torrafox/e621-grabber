import Vue from 'vue'
import Vuetify from 'vuetify/lib/framework'

Vue.use(Vuetify)

export default new Vuetify({
  breakpoint: {
    thresholds: {
      xs: 576,
      sm: 768,
      md: 992,
      lg: 1246
    },
    scrollBarWidth: 24
  },
  theme: {
    dark: true,
    themes: {
      light: {
        background: '#002a56'
      },
      dark: {
        background: '#002a56'
      }
    }
  }
})
