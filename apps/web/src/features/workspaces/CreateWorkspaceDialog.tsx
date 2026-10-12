// "Create a company workspace" (approved canvas, AC-F01-15): a name of 2–60 characters, what happens
// next, and Create. On success the dialog closes and the app switches to the new workspace. One
// Idempotency-Key per opening of the dialog, so repeating the same create makes one workspace.
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Dialog, Input } from "@meetapp/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ActionErrorNotice } from "../auth/index.ts";
import { useCreateWorkspace } from "./create-workspace.ts";

const form = z.object({ name: z.string().trim().min(2, "nameRule").max(60, "nameRule") });
type Form = z.infer<typeof form>;

export interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspaceId: string) => void;
}

function NextSteps() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-surface-sunken p-4">
      <span className="text-[13px] font-semibold">{t("workspaces.create.nextTitle")}</span>
      <ul className="m-0 flex flex-col gap-1.5 pl-4.5 text-[14px] leading-5 text-ink-muted">
        <li>{t("workspaces.create.nextInvite")}</li>
        <li>{t("workspaces.create.nextJoin")}</li>
        <li>{t("workspaces.create.nextPersonal")}</li>
      </ul>
    </div>
  );
}

function CreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [key] = useState(() => crypto.randomUUID());
  const create = useCreateWorkspace();
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(form) });
  const submit = handleSubmit((values) =>
    create.mutate({ ...values, key }, { onSuccess: (r) => onCreated(r.switchTo) }),
  );
  const nameError = formState.errors.name ? { error: t("workspaces.create.nameRule") } : {};
  const nameField = register("name");
  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <Input
        id="workspace-name"
        label={t("workspaces.create.name")}
        hint={t("workspaces.create.hint")}

        {...nameError}
        {...nameField}
      />
      <NextSteps />
      <ActionErrorNotice error={create.error} onRetry={() => void submit()} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("workspaces.create.cancel")}
        </Button>
        {create.isPending ? (
          <Button type="submit" loading loadingLabel={t("workspaces.create.pending")}>
            {t("workspaces.create.submit")}
          </Button>
        ) : (
          <Button type="submit">{t("workspaces.create.submit")}</Button>
        )}
      </div>
    </form>
  );
}

export function CreateWorkspaceDialog({ open, onOpenChange, onCreated }: CreateWorkspaceDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("workspaces.create.title")}
      description={t("workspaces.create.description")}
      closeLabel={t("workspaces.create.close")}
      initialFocusId="workspace-name"
    >
      {open ? <CreateForm onCancel={() => onOpenChange(false)} onCreated={onCreated} /> : null}
    </Dialog>
  );
}
