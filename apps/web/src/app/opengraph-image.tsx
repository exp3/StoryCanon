import { ImageResponse } from "next/og";

/**
 * Generated rather than a static file: the Docker runner stage copies only
 * `.next/standalone`, `.next/static`, `prisma` and `node_modules`, so anything
 * in `public/` would 404 in production. This compiles into the route tree and
 * ships with the standalone output.
 *
 * Locale-neutral on purpose — one image serves `/`, `/ja` and `/en`, and
 * rendering Japanese here would mean bundling a CJK font file, which brings
 * back the static-asset problem it avoids.
 */
export const alt = "StoryCanon — a structured, private story bible";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#f7f7f4",
          color: "#1d1d1b",
          padding: "96px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#46605a",
            fontWeight: 700,
          }}
        >
          Structured story bible
        </div>
        <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: "-0.045em", marginTop: 28 }}>
          StoryCanon
        </div>
        <div style={{ fontSize: 36, lineHeight: 1.45, color: "#5d5d57", marginTop: 28, maxWidth: 860 }}>
          Scenes, characters, worldbuilding and foreshadowing — with a fixed structure and an API your AI can write into.
        </div>
        <div style={{ display: "flex", marginTop: 56, height: 6, width: 180, background: "#46605a" }} />
      </div>
    ),
    size,
  );
}
