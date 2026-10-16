// Test helper (tests only): a stand-in for livekit-client's Room, driven by events from the test.
import { EventEmitter } from "node:events";
import { vi } from "vitest";

export interface FakeParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  attributes: Record<string, string>;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isSpeaking: boolean;
  connectionQuality: string;
  joinedAt: Date | undefined;
  permissions?: { canPublishSources: number[] } | undefined;
  getTrackPublication: ReturnType<typeof vi.fn>;
  setMicrophoneEnabled: ReturnType<typeof vi.fn>;
  setCameraEnabled: ReturnType<typeof vi.fn>;
  setScreenShareEnabled: ReturnType<typeof vi.fn>;
  publishData: ReturnType<typeof vi.fn>;
}

export function fakeParticipant(identity: string, extra: Partial<FakeParticipant> = {}): FakeParticipant {
  return {
    identity,
    name: identity,
    isLocal: false,
    attributes: {},
    isMicrophoneEnabled: true,
    isCameraEnabled: false,
    isSpeaking: false,
    connectionQuality: "excellent",
    joinedAt: new Date(0),
    getTrackPublication: vi.fn(() => undefined),
    setMicrophoneEnabled: vi.fn(async () => undefined),
    setCameraEnabled: vi.fn(async () => undefined),
    setScreenShareEnabled: vi.fn(async () => undefined),
    publishData: vi.fn(async () => undefined),
    ...extra,
  };
}

export class FakeRoom extends EventEmitter {
  static instances: FakeRoom[] = [];
  static options: unknown[] = [];
  static localDevices: Record<string, { deviceId: string; label: string }[]> = {};
  static getLocalDevices = vi.fn(async (kind: string) => FakeRoom.localDevices[kind] ?? []);
  localParticipant = fakeParticipant("me", { isLocal: true });
  remoteParticipants = new Map<string, FakeParticipant>();
  metadata: string | undefined;
  active: Record<string, string> = {};
  /** What `connect` does in the next rooms made (set before the screen opens). */
  static connectImpl: () => Promise<void> = async () => undefined;
  connect = vi.fn<(url: string, pass: string) => Promise<void>>(() => FakeRoom.connectImpl());
  disconnect = vi.fn(async () => undefined);
  switchActiveDevice = vi.fn<(kind: string, id: string) => Promise<boolean>>(async () => true);
  getActiveDevice = (kind: string) => this.active[kind];

  constructor(options?: unknown) {
    super();
    FakeRoom.options.push(options);
    FakeRoom.instances.push(this);
  }

  static reset() {
    FakeRoom.instances = [];
    FakeRoom.options = [];
    FakeRoom.localDevices = {};
    FakeRoom.connectImpl = async () => undefined;
    FakeRoom.getLocalDevices.mockClear();
  }
}
