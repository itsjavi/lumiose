// The head of an indexable page (TASK-597): its title and meta description, their Open Graph
// twins, and its canonical URL on lumiose.dev. The document holds the site-wide defaults (the home
// page's Open Graph image and the Twitter card), which `image` replaces. Redirect stubs and the 404
// page leave it out, so they get no canonical link.
import { Head, Meta, Title, url } from "lumiose";
import { absoluteUrl, canonicalUrl, metaDescription, type OgImage } from "../lib/site.ts";

export interface PageMetaProps {
  title: string;
  /** Cut to 160 characters (`metaDescription`). */
  description: string;
  /** The Open Graph title, when it differs from the document title. */
  ogTitle?: string;
  /** The page's own Open Graph image, instead of the home page's. */
  image?: OgImage;
}

export function PageMeta(props: PageMetaProps) {
  const description = metaDescription(props.description);
  const canonical = canonicalUrl(url().pathname);
  return (
    <>
      <Title>{props.title}</Title>
      <Meta name="description" content={description} />
      <Meta property="og:title" content={props.ogTitle ?? props.title} />
      <Meta property="og:description" content={description} />
      <Meta property="og:url" content={canonical} />
      {props.image !== undefined && (
        <Meta property="og:image" content={absoluteUrl(props.image.path)} />
      )}
      {props.image !== undefined && <Meta property="og:image:alt" content={props.image.alt} />}
      <Head>
        <link rel="canonical" href={canonical} />
      </Head>
    </>
  );
}
