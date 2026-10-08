import "server-only";
import { headers } from "next/headers";

/**
 * The CSP nonce the proxy generated for this request, or undefined when no proxy ran (for example
 * in a unit test). Reading request headers also makes the page dynamically rendered, which nonces require.
 */
export async function getRequestNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
