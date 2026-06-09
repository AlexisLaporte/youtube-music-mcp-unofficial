<script setup lang="ts">
import { onMounted, ref } from "vue";
import GithubIcon from "./GithubIcon.vue";
import { REPO } from "../site";

interface Bar {
  hot: boolean;
  style: { animationDelay: string; animationDuration: string; height: string };
}

const bars = ref<Bar[]>([]);

onMounted(() => {
  bars.value = Array.from({ length: 64 }, () => ({
    hot: Math.random() < 0.14,
    style: {
      animationDelay: `-${(Math.random() * 1.4).toFixed(2)}s`,
      animationDuration: `${(1.0 + Math.random() * 1.2).toFixed(2)}s`,
      height: `${(8 + Math.random() * 70).toFixed(0)}%`,
    },
  }));
});
</script>

<template>
  <section class="hero" style="border-bottom: none; padding-bottom: 0">
    <div class="hero-grid-bg"></div>
    <div class="wrap">
      <p class="kicker">
        <span class="kicker-dot"></span> <b>MCP server</b> for YouTube Music
        <span class="kicker-dot" style="background: var(--line-strong)"></span> open source
        <span class="kicker-dot" style="background: var(--line-strong)"></span> local-first
      </p>
      <h1 class="display">
        Sort <span class="outline">1,500</span> liked songs by talking
        <span class="accent">to&nbsp;Claude.</span>
      </h1>
      <p class="sub">
        ytmusic-manager is an open-source MCP server that lets Claude audit, sort and clean up
        your YouTube Music library — in batches, in plain language.
        <strong>It runs on your machine. Your credentials never leave it.</strong>
      </p>
      <div class="cta-row">
        <a class="btn-primary" :href="REPO" target="_blank" rel="noopener">
          <GithubIcon :size="18" />
          View on GitHub
        </a>
        <a class="cmd-chip" href="#install">
          <span><span class="dollar">$</span> ytmusic-manager setup</span>
          <span class="copy-hint">install ↓</span>
        </a>
      </div>
    </div>
    <div class="wrap" style="max-width: 100%; padding: 0">
      <div class="equalizer" aria-hidden="true">
        <i v-for="(bar, i) in bars" :key="i" :class="{ hot: bar.hot }" :style="bar.style"></i>
      </div>
    </div>
  </section>
</template>
