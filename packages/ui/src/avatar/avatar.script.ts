// Avatar's client script (decision-62, decision-63). `<lu-avatar>` follows the loading status of
// its image (its `<img>` child): `data-loading` while it loads and `data-error` when it failed or
// has no source, Base UI's attributes, on the image, which stays hidden meanwhile (avatar.css);
// `data-loaded` on the root once it has loaded, which hides the fallback. Each change dispatches
// `loadingstatuschange` on the image. A new `src` or `srcset`, or a new image, starts over.
// It must not import `lumiose`: server-rendered pages load it without the runtime.

/** An avatar image's loading status. */
export type AvatarLoadingStatus = "loading" | "loaded" | "error";

/** The `detail` of `loadingstatuschange`. */
export interface AvatarLoadingStatusChangeDetail {
  status: AvatarLoadingStatus;
}

export class AvatarElement extends HTMLElement {
  #observer: MutationObserver | undefined;
  #image: HTMLImageElement | null = null;
  #status: AvatarLoadingStatus | undefined;

  /** The loading status of the avatar's image; `undefined` while it has none. */
  get status(): AvatarLoadingStatus | undefined {
    return this.#status;
  }

  connectedCallback(): void {
    // `load` and `error` do not bubble: they reach the root in the capture phase.
    this.addEventListener("load", this.#settle, true);
    this.addEventListener("error", this.#settle, true);
    this.#observer = new MutationObserver(this.#check);
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributeFilter: ["src", "srcset"],
    });
    this.#check();
  }

  disconnectedCallback(): void {
    this.removeEventListener("load", this.#settle, true);
    this.removeEventListener("error", this.#settle, true);
    this.#observer?.disconnect();
  }

  #settle = (event: Event): void => {
    const image = this.#current();
    if (image !== null && event.target === image) {
      this.#set(image, event.type === "load" ? "loaded" : "error");
    }
  };

  #check = (): void => {
    const image = this.#current();
    if (image === null) {
      this.#image = null;
      this.#status = undefined;
      this.removeAttribute("data-loaded");
    } else if (!image.getAttribute("src") && !image.getAttribute("srcset")) {
      this.#set(image, "error");
    } else if (!image.complete) {
      this.#set(image, "loading");
    } else if (image.naturalWidth > 0) {
      this.#set(image, "loaded");
    } else {
      // Complete without a size: a broken image, or an SVG without intrinsic dimensions.
      const source = image.currentSrc;
      const done = (status: AvatarLoadingStatus) => () => {
        if (image.currentSrc === source && this.#current() === image) this.#set(image, status);
      };
      this.#set(image, "loading");
      image.decode().then(done("loaded"), done("error"));
    }
  };

  #current(): HTMLImageElement | null {
    return this.querySelector<HTMLImageElement>(":scope > img");
  }

  #set(image: HTMLImageElement, status: AvatarLoadingStatus): void {
    image.toggleAttribute("data-loading", status === "loading");
    image.toggleAttribute("data-error", status === "error");
    this.toggleAttribute("data-loaded", status === "loaded");
    if (image === this.#image && status === this.#status) return;
    this.#image = image;
    this.#status = status;
    image.dispatchEvent(
      new CustomEvent<AvatarLoadingStatusChangeDetail>("loadingstatuschange", {
        detail: { status },
      }),
    );
  }
}

if (!customElements.get("lu-avatar")) {
  customElements.define("lu-avatar", AvatarElement);
}
