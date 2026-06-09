import { onBeforeUnmount, onMounted } from "vue";

/** Reveal-on-scroll: adds `.in` to every `.reveal` element once it enters the viewport. */
export function useReveal() {
  let io: IntersectionObserver | undefined;

  onMounted(() => {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io!.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((el) => io!.observe(el));
  });

  onBeforeUnmount(() => io?.disconnect());
}
