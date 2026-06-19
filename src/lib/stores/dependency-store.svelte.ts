import { invoke } from "@tauri-apps/api/core";

let ytdlpAvailable: boolean = $state(false);
let checked: boolean = $state(false);

export function isYtdlpAvailable(): boolean {
  return ytdlpAvailable;
}

export function isDepsChecked(): boolean {
  return checked;
}

export async function refreshYtdlpStatus(): Promise<void> {
  try {
    ytdlpAvailable = await invoke<boolean>("check_ytdlp_available");
  } catch {
    ytdlpAvailable = false;
  }
  checked = true;
}

/** Poll until bundled yt-dlp is ready or timeout (startup auto-install). */
export function watchYtdlpStatus(maxMs = 120_000): () => void {
  const started = Date.now();
  const interval = setInterval(async () => {
    if (ytdlpAvailable || Date.now() - started >= maxMs) {
      clearInterval(interval);
      return;
    }
    await refreshYtdlpStatus();
  }, 2000);
  return () => clearInterval(interval);
}
