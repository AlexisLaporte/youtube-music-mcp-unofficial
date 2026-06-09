<script setup lang="ts">
import { REPO } from "../site";
</script>

<template>
  <footer>
    <div class="wrap foot-inner">
      <span>ytmusic—manager · open source · MIT</span>
      <div class="foot-links">
        <a :href="REPO" target="_blank" rel="noopener">GitHub</a>
        <a :href="`${REPO}/blob/main/LICENSE`" target="_blank" rel="noopener">MIT License</a>
      </div>
      <span>Not affiliated with YouTube or Google. Built on ytmusicapi, an unofficial API.</span>
    </div>
  </footer>
</template>
