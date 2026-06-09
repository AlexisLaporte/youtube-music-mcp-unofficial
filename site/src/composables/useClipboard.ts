import { ref } from "vue";

/** Copy text to the clipboard with a transient "copied" flag (1.6 s). */
export function useClipboard() {
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function copy(text: string) {
    const flash = () => {
      copied.value = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied.value = false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(flash, flash);
    } else {
      flash();
    }
  }

  return { copied, copy };
}
