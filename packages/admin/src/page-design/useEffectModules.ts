import { useQuery } from "@tanstack/react-query";

/**
 * Where each effect module is served beside the admin (see vite.config.ts), read from their
 * manifest: { pointer: "https://admin.example.com/canvas-effects/pointer-X.js", ... }. The
 * builder uses it to try effects on the canvas and in the gallery. Undefined until loaded,
 * or when the modules aren't there; effects can still be added then, just not previewed.
 */
export function useEffectModules(address: (file: string) => string) {
  const manifest = useQuery({
    queryKey: ["canvas-effects", "manifest"],
    queryFn: async () => {
      const response = await fetch(address("canvas-effects/manifest.json"));
      if (!response.ok) throw new Error("The effect modules aren't available.");
      return (await response.json()) as { modules: Record<string, { file: string }> };
    },
    staleTime: Infinity,
    retry: false,
  });
  // Anything else (an old admin build, a proxy's error page) means no previews, not a crash.
  const modules = manifest.data?.modules;
  if (typeof modules !== "object" || modules === null) return undefined;
  return Object.fromEntries(
    Object.entries(modules)
      .filter(([, entry]) => typeof entry?.file === "string")
      .map(([name, { file }]) => [name, address(`canvas-effects/${file}`)]),
  );
}
