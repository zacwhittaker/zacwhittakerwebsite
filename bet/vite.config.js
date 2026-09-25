import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (Boolean(url) !== Boolean(key))
    throw new Error(
      "Set both Supabase public variables, or leave both empty for preview mode.",
    );
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("VITE_SUPABASE_URL must be a valid HTTPS project URL.");
    }
    if (parsed.protocol !== "https:")
      throw new Error("VITE_SUPABASE_URL must use HTTPS.");
    if (key.startsWith("sb_secret_"))
      throw new Error(
        "A Supabase secret key must never be included in a browser build. Use the publishable key.",
      );
    if (key.split(".").length === 3) {
      let payload;
      try {
        payload = JSON.parse(
          Buffer.from(key.split(".")[1], "base64url").toString(),
        );
      } catch {
        throw new Error("Invalid legacy Supabase public key.");
      }
      if (payload.role !== "anon")
        throw new Error(
          "Only an anon or publishable Supabase key can be included in the browser build.",
        );
    }
  }
  return {};
});
