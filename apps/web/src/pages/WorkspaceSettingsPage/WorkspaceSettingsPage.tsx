// WorkspaceSettingsPage (page): "Workspace settings" (F02 design.md section 2, item 5): the workspace's
// name (company workspaces, AC-F01-24) and the Allow guests switch (AC-F02-40), which applies at once to
// every meeting of the workspace. Only the owner and admins (in Personal, its user) have this screen;
// anyone else is sent Home.
import { Button, Input, Notice, Toggle } from "@meetapp/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import {
  WorkspaceShell,
  useAllowGuests,
  useCurrentWorkspace,
  useRenameWorkspace,
  useWorkspaceName,
  type AppScreen,
  type MyWorkspace,
} from "../../features/workspaces/index.ts";

export interface WorkspaceSettingsPageProps {
  onNavigate: (screen: AppScreen) => void;
}

const validName = (name: string) => name.length >= 2 && name.length <= 60;

function NameForm({ workspace }: { workspace: MyWorkspace }) {
  const { t } = useTranslation();
  const rename = useRenameWorkspace(workspace.id);
  const [value, setValue] = useState(workspace.name);
  const [ruleBroken, setRuleBroken] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    setRuleBroken(!validName(trimmed));
    if (validName(trimmed)) rename.mutate(trimmed);
  };
  return (
    <form noValidate onSubmit={submit} className="flex max-w-130 flex-wrap items-start gap-3">
      <Input
        id="workspace-name"
        className="flex-[1_1_260px]"
        label={t("workspaces.settings.name")}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (rename.isSuccess) rename.reset();
        }}
        {...(ruleBroken ? { error: t("workspaces.settings.nameRule") } : {})}
      />
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="h-4.5" />
        {rename.isPending ? (
          <Button type="submit" variant="secondary" loading loadingLabel={t("workspaces.settings.saving")}>
            {t("workspaces.settings.save")}
          </Button>
        ) : (
          <Button type="submit" variant="secondary">
            {t("workspaces.settings.save")}
          </Button>
        )}
      </div>
      <div className="basis-full empty:hidden">
        <ActionErrorNotice error={rename.error} onRetry={() => rename.mutate(value.trim())} />
        {rename.isSuccess ? <Notice tone="success">{t("workspaces.settings.saved")}</Notice> : null}
      </div>
    </form>
  );
}

function GuestsSwitch({ workspace }: { workspace: MyWorkspace }) {
  const { t } = useTranslation();
  const change = useAllowGuests(workspace.id);
  // While saving, the switch shows the new choice; afterwards /me has the saved value.
  const checked = change.isPending ? change.variables : workspace.allowGuests;
  return (
    <>
      <Toggle
        id="allow-guests"
        className="max-w-130"
        label={t("workspaces.settings.allowGuests")}
        description={t("workspaces.settings.allowGuestsHint")}
        checked={checked}
        disabled={change.isPending}
        onChange={(next) => change.mutate(next)}
      />
      <ActionErrorNotice error={change.error} onRetry={() => change.reset()} />
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="m-0 text-heading text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SettingsContent({ workspace }: { workspace: MyWorkspace }) {
  const { t } = useTranslation();
  const nameOf = useWorkspaceName();
  return (
    <main className="flex max-w-245 min-w-0 flex-col gap-8 px-6 py-10 sm:px-12">
      <header className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
          {t("workspaces.settings.title")}
        </h1>
        <p className="m-0 text-ink-muted">{t("workspaces.settings.subtitle", { name: nameOf(workspace) })}</p>
      </header>
      {workspace.kind === "company" ? (
        <Section id="workspace-name-title" title={t("workspaces.settings.nameTitle")}>
          {/* A new form when the saved name changes (e.g. in another window), so the field shows it. */}
          <NameForm key={workspace.name} workspace={workspace} />
        </Section>
      ) : null}
      <Section id="workspace-guests-title" title={t("workspaces.settings.guestsTitle")}>
        <GuestsSwitch workspace={workspace} />
      </Section>
    </main>
  );
}

export function WorkspaceSettingsPage({ onNavigate }: WorkspaceSettingsPageProps) {
  const { current } = useCurrentWorkspace();
  if (current && current.role === "member") return <Navigate to="/" replace />;
  return (
    <WorkspaceShell screen="workspace" onNavigate={onNavigate}>
      {current ? <SettingsContent key={current.id} workspace={current} /> : null}
    </WorkspaceShell>
  );
}
