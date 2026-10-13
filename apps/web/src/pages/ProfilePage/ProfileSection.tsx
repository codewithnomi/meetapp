// "Profile" (AC-F01-25): the photo with Upload and Remove, and the name (1–60 characters). Both show in
// this app at once and reach people who share a workspace within a minute.
import { AvatarUpload, Button, Input, Notice } from "@meetapp/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { apiFileUrl } from "../../features/api/index.ts";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import { isPhotoRefusal, useRemovePhoto, useUpdateName, useUploadPhoto } from "../../features/profile/index.ts";

interface Person {
  name: string;
  photoUrl: string | null;
}

function Photo({ person }: { person: Person }) {
  const { t } = useTranslation();
  const upload = useUploadPhoto();
  const remove = useRemovePhoto();
  const error = upload.error ?? remove.error;
  return (
    <>
      <AvatarUpload
        name={person.name}
        photoUrl={apiFileUrl(person.photoUrl)}
        busy={upload.isPending || remove.isPending}
        error={isPhotoRefusal(upload.error) ? t("profile.photo.rule") : undefined}
        onFile={(file) => upload.mutate(file)}
        onRemove={() => remove.mutate()}
        labels={{
          upload: t("profile.photo.upload"),
          remove: t("profile.photo.remove"),
          hint: t("profile.photo.hint"),
          uploading: t("profile.photo.uploading"),
        }}
      />
      {error && !isPhotoRefusal(error) ? <ActionErrorNotice error={error} onRetry={() => upload.reset()} /> : null}
    </>
  );
}

type NameUpdate = ReturnType<typeof useUpdateName>;

/** The field; the save itself lives in the section, so its result outlives a refreshed name. */
function NameForm({ name, update }: { name: string; update: NameUpdate }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(name);
  const [ruleBroken, setRuleBroken] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    setRuleBroken(trimmed.length < 1 || trimmed.length > 60);
    if (trimmed.length >= 1 && trimmed.length <= 60) update.mutate(trimmed);
  };
  return (
    <form noValidate onSubmit={submit} className="flex max-w-130 flex-wrap items-start gap-3">
      <Input
        id="display-name"
        className="flex-[1_1_260px]"
        label={t("profile.name.label")}
        value={value}
        autoComplete="name"
        onChange={(event) => setValue(event.target.value)}
        {...(ruleBroken ? { error: t("profile.name.rule") } : {})}
      />
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="h-4.5" />
        {update.isPending ? (
          <Button type="submit" variant="secondary" loading loadingLabel={t("profile.name.saving")}>
            {t("profile.name.save")}
          </Button>
        ) : (
          <Button type="submit" variant="secondary">
            {t("profile.name.save")}
          </Button>
        )}
      </div>
      <div className="basis-full empty:hidden">
        <ActionErrorNotice error={update.error} onRetry={() => update.mutate(value.trim())} />
      </div>
    </form>
  );
}

export function ProfileSection({ person }: { person: Person }) {
  const { t } = useTranslation();
  const update = useUpdateName();
  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="profile-title" className="m-0 text-heading text-ink">
          {t("profile.title")}
        </h2>
        <p className="m-0 text-ink-muted">{t("profile.description")}</p>
      </div>
      <Photo person={person} />
      {/* A new key when the saved name changes (e.g. in another window), so the field shows it. */}
      <NameForm key={person.name} name={person.name} update={update} />
      {update.isSuccess ? <Notice tone="success">{t("profile.name.saved")}</Notice> : null}
    </section>
  );
}
