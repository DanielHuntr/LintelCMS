import { clamp, eachBehaviour, prefersReducedMotion } from "./behaviour-helpers.js";
import { enableDragScroll } from "./drag-scroll.js";

/** Sliders, the gallery's lightbox, frames that load on request, and before-and-after. */

export function setUpCarousels(root: ParentNode): void {
  eachBehaviour(root, "carousel", (carousel) => {
    const track = carousel.querySelector<HTMLElement>(".lintel-carousel__track");
    if (!track) return;
    if (carousel.hasAttribute("data-free-drag")) enableDragScroll(track);
    const slides = [...track.children] as HTMLElement[];
    const dots = [...carousel.querySelectorAll<HTMLButtonElement>("[data-carousel=dot]")];
    const previous = carousel.querySelector<HTMLButtonElement>("[data-carousel=previous]");
    const next = carousel.querySelector<HTMLButtonElement>("[data-carousel=next]");
    const pause = carousel.querySelector<HTMLButtonElement>("[data-carousel=pause]");
    const loops = carousel.hasAttribute("data-loop");
    const current = () => {
      const start = track.getBoundingClientRect().left;
      let nearest = 0;
      slides.forEach((slide, index) => {
        const distance = Math.abs(slide.getBoundingClientRect().left - start);
        const best = Math.abs((slides[nearest]?.getBoundingClientRect().left ?? 0) - start);
        if (distance < best) nearest = index;
      });
      return nearest;
    };
    const lastStart = () => {
      const perView = Math.max(
        1,
        Math.round(track.clientWidth / (slides[0]?.clientWidth || track.clientWidth)),
      );
      return Math.max(0, slides.length - perView);
    };
    const goTo = (index: number) => {
      const target = loops
        ? index > lastStart()
          ? 0
          : index < 0
            ? lastStart()
            : index
        : clamp(index, 0, lastStart());
      const slide = slides[target];
      if (slide)
        track.scrollTo({
          left: slide.offsetLeft - track.offsetLeft,
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
    };
    const update = () => {
      const index = current();
      dots.forEach((dot, at) => dot.setAttribute("aria-current", String(at === index)));
      if (!loops) {
        if (previous) previous.disabled = index === 0;
        if (next) next.disabled = index >= lastStart();
      }
    };
    previous?.addEventListener("click", () => goTo(current() - 1));
    next?.addEventListener("click", () => goTo(current() + 1));
    dots.forEach((dot, index) => dot.addEventListener("click", () => goTo(index)));
    track.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") goTo(current() + 1);
      else if (event.key === "ArrowLeft") goTo(current() - 1);
      else return;
      event.preventDefault();
    });
    let settle: number | undefined;
    track.addEventListener("scroll", () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(update, 80);
    });
    update();

    const seconds = Number(carousel.dataset.autoplay);
    if (!seconds || !pause) return;
    // People who prefer less motion get a slider that waits for them.
    let paused = prefersReducedMotion();
    let held = false;
    const showPaused = () => {
      pause.setAttribute("aria-pressed", String(paused));
      pause.textContent = paused ? "Play" : "Pause";
    };
    showPaused();
    pause.addEventListener("click", () => {
      paused = !paused;
      showPaused();
    });
    const hold = (value: boolean) => () => {
      held = value;
    };
    carousel.addEventListener("pointerenter", hold(true));
    carousel.addEventListener("pointerleave", hold(false));
    carousel.addEventListener("focusin", hold(true));
    carousel.addEventListener("focusout", hold(false));
    window.setInterval(() => {
      if (!paused && !held && document.visibilityState === "visible") goTo(current() + 1);
    }, seconds * 1000);
  });
}

export function setUpProductGalleries(root: ParentNode): void {
  eachBehaviour(root, "product-gallery", (gallery) => {
    const track = gallery.querySelector<HTMLElement>(".lintel-product-gallery__track");
    const thumbnails = [
      ...gallery.querySelectorAll<HTMLAnchorElement>(".lintel-product-gallery__thumbnail"),
    ];
    if (!track) return;
    thumbnails.forEach((thumbnail, index) => {
      thumbnail.addEventListener("click", (event) => {
        event.preventDefault();
        const slide = track.children[index] as HTMLElement | undefined;
        if (slide)
          track.scrollTo({
            left: slide.offsetLeft - track.offsetLeft,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        thumbnails.forEach((other) =>
          other.setAttribute("aria-current", String(other === thumbnail)),
        );
      });
    });
  });
}

export function setUpLightboxes(root: ParentNode): void {
  eachBehaviour(root, "gallery", (gallery) => {
    const links = [...gallery.querySelectorAll<HTMLAnchorElement>(".lintel-gallery__open")];
    if (links.length === 0) return;
    const dialog = document.createElement("dialog");
    dialog.className = "lintel-lightbox";
    dialog.setAttribute("aria-label", "Picture");
    dialog.innerHTML =
      '<form method="dialog" class="lintel-lightbox__close"><button type="submit" aria-label="Close">×</button></form>' +
      '<img alt="">' +
      '<div class="lintel-lightbox__controls"><button type="button" data-step="-1">Previous</button>' +
      '<p class="lintel-lightbox__caption" aria-live="polite"></p>' +
      '<button type="button" data-step="1">Next</button></div>';
    document.body.append(dialog);
    const image = dialog.querySelector("img") as HTMLImageElement;
    const caption = dialog.querySelector(".lintel-lightbox__caption") as HTMLElement;
    let shown = 0;
    let opener: HTMLElement | null = null;
    const show = (index: number) => {
      shown = (index + links.length) % links.length;
      const link = links[shown] as HTMLAnchorElement;
      const thumbnail = link.querySelector("img");
      image.src = link.href;
      image.alt = thumbnail?.alt ?? "";
      caption.textContent = `${link.dataset.caption ?? thumbnail?.alt ?? ""} (${shown + 1} of ${links.length})`;
    };
    links.forEach((link, index) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        opener = link;
        show(index);
        dialog.showModal();
      });
    });
    dialog.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => {
      button.addEventListener("click", () => show(shown + Number(button.dataset.step)));
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") show(shown + 1);
      if (event.key === "ArrowLeft") show(shown - 1);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => opener?.focus());
  });
}

/** Videos, maps and embeds from other sites: the frame only loads when asked for. */
export function setUpConsentFrames(root: ParentNode): void {
  eachBehaviour(root, "consent-frame", (placeholder) => {
    const source = placeholder.dataset.frameSrc;
    const button = placeholder.querySelector<HTMLButtonElement>(".lintel-consent__load");
    if (!source || !button) return;
    button.addEventListener("click", () => {
      const frame = document.createElement("iframe");
      frame.src = source;
      frame.title = placeholder.dataset.frameTitle ?? "";
      frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation",
      );
      const height = placeholder.closest<HTMLElement>("[data-height]")?.dataset.height;
      if (height) frame.height = height;
      placeholder.replaceChildren(frame);
      frame.focus();
    });
  });
}

export function setUpBeforeAfter(root: ParentNode): void {
  eachBehaviour(root, "before-after", (figure) => {
    const frame = figure.querySelector<HTMLElement>(".lintel-before-after__frame");
    const range = figure.querySelector<HTMLInputElement>(".lintel-before-after__range");
    if (!frame || !range) return;
    const before =
      figure.querySelector(".lintel-before-after__label--before")?.textContent?.toLowerCase() ??
      "before";
    const show = () => {
      frame.style.setProperty("--lintel-position", `${range.value}%`);
      range.setAttribute("aria-valuetext", `${range.value}% ${before}`);
    };
    range.addEventListener("input", show);
    show();
  });
}

/** Videos that play by themselves stay still for people who prefer less motion. */
export function setUpQuietVideos(root: ParentNode): void {
  eachBehaviour<HTMLVideoElement>(root, "video", (video) => {
    if (prefersReducedMotion()) {
      video.pause();
      video.removeAttribute("autoplay");
    }
  });
}
