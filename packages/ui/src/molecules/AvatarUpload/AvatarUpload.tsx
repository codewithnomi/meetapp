// AvatarUpload (molecule): the photo part of the approved "Profile and account" canvas (AC-F01-25): the
// person's photo (or initials) in a large circle, "Upload a photo", "Remove" when there is one, and the
// rule underneath, replaced by the error when a file is refused. The button opens the computer's file
// picker (JPEG, PNG or WebP); the chosen file goes to `onFile`. All words arrive as props.
import { useId, useRef, type ChangeEvent } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { cx } from "../../lib/cx.ts";

export interface AvatarUploadLabels {
  upload: string;
  remove: string;
  /** "JPEG, PNG or WebP, up to 5 MB. Location details are removed." */
  hint: string;
  /** Read out while the photo is being sent. */
  uploading: string;
}

export interface AvatarUploadProps {
  name: string;
  photoUrl?: string | undefined;
  busy?: boolean;
  /** Already translated, e.g. "Use a JPEG, PNG or WebP image up to 5 MB". */
  error?: string | undefined;
  onFile: (file: File) => void;
  onRemove: () => void;
  labels: AvatarUploadLabels;
}

export function AvatarUpload({ name, photoUrl, busy = false, error, onFile, onRemove, labels }: AvatarUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const messageId = useId();
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again still reports it.
    event.target.value = "";
    if (file) onFile(file);
  };
  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} size="xl" {...(photoUrl ? { src: photoUrl } : {})} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {busy ? (
            <Button variant="secondary" size="sm" loading loadingLabel={labels.uploading}>
              {labels.upload}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" aria-describedby={messageId} onClick={() => input.current?.click()}>
              {labels.upload}
            </Button>
          )}
          {photoUrl ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              {labels.remove}
            </Button>
          ) : null}
        </div>
        <span
          id={messageId}
          role={error ? "alert" : undefined}
          className={cx("text-[13px]", error ? "font-medium text-danger" : "text-ink-muted")}
        >
          {error ?? labels.hint}
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={choose}
      />
    </div>
  );
}
