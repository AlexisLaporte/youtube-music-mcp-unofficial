<script setup lang="ts">
const repo = "https://github.com/AlexisLaporte/ytmusic-manager";
</script>

<template>
  <!-- Placeholder — design à venir (Alexis) -->
  <main>
    <h1>ytmusic-manager</h1>
    <p>
      MCP server for YouTube Music: ask Claude to audit your liked songs and organize your
      playlists. Open source, runs on your machine — your account never leaves it.
    </p>
    <pre><code>uvx --from git+{{ repo }} ytmusic-manager setup</code></pre>
    <p><a :href="repo">GitHub</a></p>
  </main>
</template>
