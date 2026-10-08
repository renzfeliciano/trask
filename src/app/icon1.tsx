import { ImageResponse } from "next/og";
import { appIconDataUri } from "@/components/brand/app-icon";

// PNG sizes for the web manifest (icon.svg covers browser tabs). "maskable" is full bleed so Android
// can crop it to any shape; the T stays inside the safe zone.
const ICONS = {
  "192": { px: 192, fullBleed: false },
  "512": { px: 512, fullBleed: false },
  maskable: { px: 512, fullBleed: true },
} as const;

type IconId = keyof typeof ICONS;

export function generateImageMetadata() {
  return Object.entries(ICONS).map(([id, { px }]) => ({
    id,
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

function isIconId(id: string): id is IconId {
  return Object.hasOwn(ICONS, id);
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const iconId = await id;
  if (!isIconId(iconId)) return new Response(null, { status: 404 });
  // eslint-disable-next-line security/detect-object-injection -- narrowed to a known id above
  const icon = ICONS[iconId];
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>, not next/image
    <img
      src={appIconDataUri({ fullBleed: icon.fullBleed })}
      width={icon.px}
      height={icon.px}
      alt=""
    />,
    { width: icon.px, height: icon.px },
  );
}
