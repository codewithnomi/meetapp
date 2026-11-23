// The calendar's screens (F13): the calendar, New meeting (optionally with a dragged range) and Edit
// meeting (the series, or one meeting of it). The desktop app keeps routes in memory, so what to edit
// travels in the route's state.
import { Route, useLocation, useNavigate, useParams } from "react-router";
import type { PreJoinState } from "../features/meetings/index.ts";
import type { AppScreen } from "../features/workspaces/index.ts";
import { CalendarPage, type CalendarEdit } from "../pages/CalendarPage/index.ts";
import { SchedulePage } from "../pages/SchedulePage/index.ts";

interface NewState {
  startsAt?: string;
  endsAt?: string;
}

function NewMeeting({ onNavigate }: { onNavigate: (screen: AppScreen) => void }) {
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as NewState;
  const range =
    state.startsAt && state.endsAt ? { startsAt: new Date(state.startsAt), endsAt: new Date(state.endsAt) } : undefined;
  return <SchedulePage onNavigate={onNavigate} onDone={() => void navigate("/calendar")} range={range} />;
}

function EditMeeting({ onNavigate }: { onNavigate: (screen: AppScreen) => void }) {
  const navigate = useNavigate();
  const { meetingId = "" } = useParams();
  const state = (useLocation().state ?? {}) as Partial<CalendarEdit>;
  return (
    <SchedulePage
      onNavigate={onNavigate}
      onDone={() => void navigate("/calendar")}
      edit={{ meetingId, scope: state.scope ?? "series", occurrence: state.occurrence }}
    />
  );
}

function Calendar({
  onNavigate,
  onPreJoin,
}: {
  onNavigate: (screen: AppScreen) => void;
  onPreJoin: (state: PreJoinState) => void;
}) {
  const navigate = useNavigate();
  return (
    <CalendarPage
      onNavigate={onNavigate}
      onPreJoin={onPreJoin}
      onNewMeeting={(range) =>
        void navigate("/calendar/new", {
          state: range ? { startsAt: range.startsAt.toISOString(), endsAt: range.endsAt.toISOString() } : {},
        })
      }
      onEdit={(edit) => void navigate(`/calendar/${edit.meetingId}/edit`, { state: edit })}
    />
  );
}

export function calendarRoutes(onNavigate: (screen: AppScreen) => void, onPreJoin: (state: PreJoinState) => void) {
  return [
    <Route key="calendar" path="/calendar" element={<Calendar onNavigate={onNavigate} onPreJoin={onPreJoin} />} />,
    <Route key="new" path="/calendar/new" element={<NewMeeting onNavigate={onNavigate} />} />,
    <Route key="edit" path="/calendar/:meetingId/edit" element={<EditMeeting onNavigate={onNavigate} />} />,
  ];
}
