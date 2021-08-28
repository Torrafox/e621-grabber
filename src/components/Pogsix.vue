<template>
  <v-img
    :src="pogsixWatching ? imgPogsixWatching : imgPogsixDefault"
    class="my-3"
    contain
    height="200"
  ></v-img>
</template>

<script>
export default {
  data: () => ({
    pogsixWatching: false,
    imgPogsixDefault: require('@/assets/pogsix.png'),
    imgPogsixWatching: require('@/assets/pogsix_watching.png')
  }),
  methods: {
    randomIntFromInterval (min, max) {
      return Math.floor(Math.random() * (max - min + 1) + min)
    },
    setNotWatchingTimeout () {
      const rand = this.randomIntFromInterval(15, 60)
      setTimeout(() => {
        this.pogsixWatching = true
        this.setWatchingTimeout()
      }, rand * 1000)
    },
    setWatchingTimeout () {
      const rand = this.randomIntFromInterval(1, 25)
      setTimeout(() => {
        this.pogsixWatching = false
        this.setNotWatchingTimeout()
      }, rand * 100)
    }
  },
  mounted () {
    this.setNotWatchingTimeout()
  }
}
</script>

<style scoped>
.rotate {
  animation: rotation 3s infinite linear;
}
@keyframes rotation {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(359deg);
  }
}
</style>
