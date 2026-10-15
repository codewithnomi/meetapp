// A weak connection (AC-F02-28, design 3.8): over 5% packet loss or over 300 ms delay, for 5 seconds in
// a row, read once a second from the person's own connection. It clears as soon as a reading is good.
export interface LineReading {
  /** 0–1: the share of packets lost. */
  loss: number;
  /** Seconds there and back. */
  roundTrip: number;
}

const BAD_LOSS = 0.05;
const BAD_DELAY_S = 0.3;
const SECONDS_IN_A_ROW = 5;

export function createWeakDetector() {
  let badSeconds = 0;
  return (reading: LineReading): boolean => {
    const bad = reading.loss > BAD_LOSS || reading.roundTrip > BAD_DELAY_S;
    badSeconds = bad ? badSeconds + 1 : 0;
    return badSeconds >= SECONDS_IN_A_ROW;
  };
}

/** The worst loss and delay the far side reports for what this app sends (WebRTC "remote-inbound-rtp"). */
export function readingOf(report: RTCStatsReport): LineReading | undefined {
  let reading: LineReading | undefined;
  report.forEach((stat: { type: string; fractionLost?: number; roundTripTime?: number }) => {
    if (stat.type !== "remote-inbound-rtp") return;
    reading = {
      loss: Math.max(reading?.loss ?? 0, stat.fractionLost ?? 0),
      roundTrip: Math.max(reading?.roundTrip ?? 0, stat.roundTripTime ?? 0),
    };
  });
  return reading;
}
