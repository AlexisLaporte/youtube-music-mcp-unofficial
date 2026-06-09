<script setup lang="ts">
import { useClipboard } from "../composables/useClipboard";
import { REPO, SETUP_CMD } from "../site";

const mcpConfig = `{
  "mcpServers": {
    "ytmusic": {
      "command": "uvx",
      "args": [
        "--from",
        "git+${REPO}",
        "ytmusic-manager"
      ]
    }
  }
}`;

const setupCopy = useClipboard();
const configCopy = useClipboard();
</script>

<template>
  <section id="install">
    <div class="wrap">
      <div class="sec-head reveal">
        <h2 class="display">Three steps.<br />Two minutes.</h2>
        <span class="idx">02 — INSTALL</span>
      </div>

      <div class="steps reveal">
        <div class="step hot">
          <div class="step-num-col"><span class="step-num">01</span></div>
          <div class="step-body">
            <h3>Capture your session</h3>
            <p class="desc">
              A guided setup grabs your YouTube Music browser headers and stores them locally.
              No OAuth app, no API key to request.
            </p>
            <div class="codeblock">
              <button
                class="copy-btn"
                :class="{ copied: setupCopy.copied.value }"
                type="button"
                @click="setupCopy.copy(SETUP_CMD)"
              >
                {{ setupCopy.copied.value ? "Copied" : "Copy" }}
              </button>
              <span class="c-accent">$</span> {{ SETUP_CMD }}
            </div>
          </div>
        </div>
        <div class="step">
          <div class="step-num-col"><span class="step-num">02</span></div>
          <div class="step-body">
            <h3>Add the server to Claude</h3>
            <p class="desc">
              Paste this into your Claude Desktop or Claude Code MCP config. The server runs
              over stdio — nothing listens on the network.
            </p>
            <div class="codeblock">
              <button
                class="copy-btn"
                :class="{ copied: configCopy.copied.value }"
                type="button"
                @click="configCopy.copy(mcpConfig)"
              >
                {{ configCopy.copied.value ? "Copied" : "Copy" }}
              </button>
              <pre>{
  <span class="c-key">"mcpServers"</span>: {
    <span class="c-key">"ytmusic"</span>: {
      <span class="c-key">"command"</span>: <span class="c-str">"uvx"</span>,
      <span class="c-key">"args"</span>: [
        <span class="c-str">"--from"</span>,
        <span class="c-str">"git+{{ REPO }}"</span>,
        <span class="c-str">"ytmusic-manager"</span>
      ]
    }
  }
}</pre>
            </div>
          </div>
        </div>
        <div class="step">
          <div class="step-num-col"><span class="step-num">03</span></div>
          <div class="step-body">
            <h3>Talk</h3>
            <p class="desc">
              Open Claude and ask. The tools handle search, playlist CRUD, batching and dedupe —
              Claude handles the judgment calls.
            </p>
            <div class="talk-samples">
              <p class="q">“which liked songs aren’t in any playlist?”</p>
              <p class="q">“file everything ambient into one playlist”</p>
              <p class="q">“merge my duplicate workout playlists”</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
