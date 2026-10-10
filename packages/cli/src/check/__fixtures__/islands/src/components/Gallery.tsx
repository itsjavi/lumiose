import { Button } from "./Button.stsx";

export function Gallery(props: { images: { src: string; load: () => Promise<void> }[] }) {
  return <ul>{props.images.map((image) => <li>{image.src}</li>)}</ul>;
}

export const Page = () => (
  <main>
    <Gallery client:visible images={[{ src: "a.png", load: async () => {} }]} />
    <Button label="Ok" client:load />
  </main>
);
