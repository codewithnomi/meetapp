// Copy to the clipboard. Answers whether it worked, so the screen can say "Copied" or not.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
