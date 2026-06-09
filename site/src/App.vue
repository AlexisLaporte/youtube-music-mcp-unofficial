<script setup lang="ts">
import TopBar from "./components/TopBar.vue";
import HeroSection from "./components/HeroSection.vue";
import DemoSection from "./components/DemoSection.vue";
import InstallSection from "./components/InstallSection.vue";
import LocalFirstSection from "./components/LocalFirstSection.vue";
import FinalCtaSection from "./components/FinalCtaSection.vue";
import SiteFooter from "./components/SiteFooter.vue";
import { useReveal } from "./composables/useReveal";

useReveal();
</script>

<template>
  <TopBar />
  <main>
    <HeroSection />
    <DemoSection />
    <InstallSection />
    <LocalFirstSection />
    <FinalCtaSection />
  </main>
  <SiteFooter />
</template>
