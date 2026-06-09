<script setup lang="ts">
import GithubIcon from "./GithubIcon.vue";
import { REPO } from "../site";
</script>

<template>
  <section class="final-cta">
    <div class="wrap">
      <p class="kicker"><span class="kicker-dot"></span> pip-free install via uvx</p>
      <h2 class="display">Your likes deserve <span class="accent">better.</span></h2>
      <div class="cta-row">
        <a class="btn-primary" :href="REPO" target="_blank" rel="noopener">
          <GithubIcon :size="18" />
          Install from GitHub
        </a>
      </div>
    </div>
  </section>
</template>
