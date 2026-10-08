import { ImageResponse } from "next/og";
import { appIconDataUri } from "@/components/brand/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Full bleed: iOS rounds the corners itself, and transparent corners would show as black.
export default function AppleIcon() {
  return new ImageResponse(
    <img
      src={appIconDataUri({ fullBleed: true })}
      width={size.width}
      height={size.height}
      alt=""
    />,
    size,
  );
}
