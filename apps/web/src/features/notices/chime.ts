// The card's short chime (F04 design 3.4), made on the spot so no sound file is loaded. Each chime is
// counted on the page (`data-chimes`) so tests can tell how many played.
export function chime(): void {
  document.body.dataset["chimes"] = String(Number(document.body.dataset["chimes"] ?? "0") + 1);
  try {
    const context = new AudioContext();
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.frequency.value = 880;
    volume.gain.setValueAtTime(0.15, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
    tone.connect(volume).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.25);
    tone.onended = () => void context.close();
  } catch {
    // No sound on this computer: the card still shows.
  }
}
