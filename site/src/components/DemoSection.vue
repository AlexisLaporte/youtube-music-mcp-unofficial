<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const body = ref<HTMLElement | null>(null);
const animating = ref(false);
let timers: ReturnType<typeof setTimeout>[] = [];
let io: IntersectionObserver | undefined;

function play() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  timers.forEach(clearTimeout);
  timers = [];
  const msgs = body.value!.querySelectorAll(".msg");
  animating.value = true;
  msgs.forEach((m) => m.classList.remove("shown"));
  let t = 200;
  msgs.forEach((m) => {
    timers.push(setTimeout(() => m.classList.add("shown"), t));
    t += m.classList.contains("claude") ? 950 : 600;
  });
  timers.push(setTimeout(() => (animating.value = false), t + 600));
}

onMounted(() => {
  let played = false;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !played) {
          played = true;
          play();
          io!.disconnect();
        }
      }
    },
    { threshold: 0.25 },
  );
  io.observe(body.value!);
});

onBeforeUnmount(() => {
  io?.disconnect();
  timers.forEach(clearTimeout);
});
</script>

<template>
  <section id="demo">
    <div class="wrap">
      <div class="sec-head reveal">
        <h2 class="display">The conversation <br />is the interface.</h2>
        <span class="idx">01 — DEMO</span>
      </div>

      <div class="demo-stats reveal">
        <div class="stat">
          <div class="num">1,688</div>
          <div class="lbl">liked songs</div>
        </div>
        <div class="stat">
          <div class="num red">1,448</div>
          <div class="lbl">in no playlist at all</div>
        </div>
        <div class="stat">
          <div class="num">86%</div>
          <div class="lbl">of your library, unsorted</div>
        </div>
      </div>

      <div class="transcript reveal">
        <div class="transcript-bar">
          <span class="traffic"><i></i><i></i><i></i></span>
          <span>claude — ytmusic-manager (stdio)</span>
          <button class="replay-btn" type="button" @click="play">▶ Replay</button>
        </div>
        <div ref="body" class="transcript-body" :class="{ animating }">
          <div class="msg user">
            <span class="role">You</span>
            <div class="body"><p>how messy is my library?</p></div>
          </div>
          <div class="msg claude">
            <span class="role">Claude</span>
            <div class="body">
              <div class="tool-call"><span class="arrow">▸</span><span class="fn">unfiled_liked_songs()</span></div>
              <p>
                You have <b>1,688 liked songs</b>. <b>1,448</b> of them aren't in any playlist —
                that's 86% of your library sitting unsorted.
              </p>
              <p>
                Biggest clusters I can see: electronic (~340), French rap (~210), jazz (~120).
                Want me to start filing them?
              </p>
            </div>
          </div>
          <div class="msg user">
            <span class="role">You</span>
            <div class="body"><p>yes — do the electronic stuff first, something for late-night listening</p></div>
          </div>
          <div class="msg claude">
            <span class="role">Claude</span>
            <div class="body">
              <div class="tool-call">
                <span class="arrow">▸</span><span class="fn">create_playlist("Late Night Electronic")</span>
              </div>
              <div class="tool-call">
                <span class="arrow">▸</span><span class="fn">add_tracks(playlist, 347 video_ids)</span>
                <span class="ret">→ <em>347 added</em></span>
              </div>
              <p>Done. <b>347 tracks</b> filed into <b>“Late Night Electronic”</b> in one batched call.</p>
              <div class="progress-line" aria-hidden="true">
                <span class="progress-track"><i></i></span>
                <span class="progress-pct">1,101 left to sort</span>
              </div>
              <p>Keep going with the French rap cluster?</p>
            </div>
          </div>
          <div class="msg user">
            <span class="role">You</span>
            <div class="body"><p>later. but check if I have duplicate playlists</p></div>
          </div>
          <div class="msg claude">
            <span class="role">Claude</span>
            <div class="body">
              <div class="tool-call">
                <span class="arrow">▸</span><span class="fn">list_playlists()</span>
                <span class="ret">→ 23 playlists</span>
              </div>
              <p>
                You have <b>“Workout”</b> and <b>“workout 2”</b> sharing 31 of 44 tracks. I can
                merge them into one and delete the leftover — say the word.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
