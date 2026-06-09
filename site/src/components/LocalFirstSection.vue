<template>
  <section id="local">
    <div class="wrap">
      <div class="local-grid">
        <div class="local-copy reveal">
          <span class="idx">03 — LOCAL-FIRST</span>
          <h2 class="display">Your library. Your machine.</h2>
          <p>
            The server runs as a local process and talks to Claude over stdio. This site is
            static — it hosts nothing, collects nothing, and has no backend.
          </p>
          <ul class="local-points">
            <li>credentials stored locally, never transmitted to us</li>
            <li>no telemetry, no analytics, no account</li>
            <li>every line of code auditable on GitHub</li>
          </ul>
        </div>
        <div class="machine-diagram reveal" aria-label="Architecture diagram: everything runs on your machine">
          <span class="dia-label">Your machine</span>
          <div class="dia-node">
            <span>Claude Desktop / Claude Code</span>
            <span class="tag">client</span>
          </div>
          <div class="dia-link"><span>stdio</span><span class="pipe"></span><span>local only</span></div>
          <div class="dia-node">
            <span>ytmusic-manager</span>
            <span class="tag">MCP · Python</span>
          </div>
          <div class="dia-link"><span>browser.json</span><span class="pipe"></span><span>stays here</span></div>
          <div class="dia-node">
            <span>ytmusicapi → YouTube Music</span>
            <span class="tag">your session</span>
          </div>
          <div class="dia-outside">
            <span>// outside this box: nothing of yours</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
