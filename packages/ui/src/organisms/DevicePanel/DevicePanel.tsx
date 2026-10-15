// DevicePanel (organism): the Device settings panel of the approved "Device settings in a meeting"
// screen: camera, microphone with its level, speakers with Test speakers, the noise suppression switch
// (on by default, AC-F02-30), and a note such as "Your connection is weak". All words arrive as props.
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { LevelMeter } from "../../atoms/LevelMeter/index.ts";
import { Toggle } from "../../atoms/Toggle/index.ts";
import { DeviceSelect, type DeviceSelectProps } from "../../molecules/DeviceSelect/index.ts";
import { SidePanel } from "../../molecules/SidePanel/index.ts";

type Select = Omit<DeviceSelectProps, "children" | "className">;

export interface DevicePanelProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  camera: Select;
  microphone: Select & { level: number; levelLabel: string };
  speakers: Select & { test: { label: string; onClick: () => void } };
  noiseSuppression: { label: string; description: string; checked: boolean; onChange: (on: boolean) => void };
  /** "Your connection is weak." and what it means. */
  note?: { title: string; text: string } | undefined;
}

export function DevicePanel(props: DevicePanelProps) {
  const { title, closeLabel, onClose, camera, noiseSuppression, note } = props;
  const { level, levelLabel, ...microphone } = props.microphone;
  const { test, ...speakers } = props.speakers;
  return (
    <SidePanel title={title} closeLabel={closeLabel} onClose={onClose} className="max-w-90 gap-4.5">
      <DeviceSelect {...camera} />
      <DeviceSelect {...microphone}>
        <LevelMeter level={level} label={levelLabel} className="pl-3.5" />
      </DeviceSelect>
      <DeviceSelect {...speakers}>
        <Button variant="ghost" size="sm" icon="sliders" onClick={test.onClick} className="self-start">
          {test.label}
        </Button>
      </DeviceSelect>
      <div className="border-t border-line pt-3.5">
        <Toggle id="noise-suppression" {...noiseSuppression} />
      </div>
      {note ? (
        <div role="status" className="flex gap-2.5 rounded-md bg-surface-sunken p-3 text-[13px] leading-4.5">
          <Icon name="signal" size={18} />
          <span>
            <strong>{note.title}</strong> {note.text}
          </span>
        </div>
      ) : null}
    </SidePanel>
  );
}
