<script setup lang="ts">
import GithubIcon from "./GithubIcon.vue";
import { REPO } from "../site";
</script>

<template>
  <header class="topbar">
    <div class="wrap topbar-inner">
      <a class="wordmark" href="#">
        <span class="mark"><i></i><i></i><i></i><i></i></span>
        <span>ytmusic<span class="dim">—</span>manager</span>
      </a>
      <nav class="toplinks">
        <a class="hide-mobile" href="#demo">Demo</a>
        <a class="hide-mobile" href="#install">Install</a>
        <a class="hide-mobile" href="#local">Local-first</a>
        <a class="gh-pill" :href="REPO" target="_blank" rel="noopener">
          <GithubIcon />
          GitHub
        </a>
      </nav>
    </div>
  </header>
</template>
