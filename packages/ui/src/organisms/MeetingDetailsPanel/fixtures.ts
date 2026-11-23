// Example details shared by the MeetingDetailsPanel stories and tests.
import type { MeetingDetailsPanelProps } from "./MeetingDetailsPanel.tsx";

export type Answer = "accepted" | "tentative" | "declined";

export const detailsExample = (on: () => void): MeetingDetailsPanelProps<Answer> => ({
  title: "Weekly planning",
  closeLabel: "Close details",
  onClose: on,
  when: ["Wed 25 Nov · 10:00 – 10:30", "Every week on Wednesday, until 30 Dec"],
  join: { label: "Join", onClick: on },
  edit: { label: "Edit", onClick: on },
  cancel: { label: "Cancel meeting", onClick: on },
  answer: {
    label: "Your answer",
    options: [
      { value: "accepted", label: "Accept" },
      { value: "tentative", label: "Maybe" },
      { value: "declined", label: "Decline" },
    ],
    value: "accepted",
    onChange: on,
  },
  details: [
    { label: "Meeting link", value: "https://meetapp.app/m/Vb3kQ9xLr2TnWp8s" },
    { label: "Meeting ID", value: "284 615 903 172", mono: true },
    { label: "Passcode", value: "h3Tq9z", mono: true },
  ],
  people: {
    heading: "People · 2 accepted, 1 maybe, 1 no answer",
    list: [
      { key: "1", name: "Olivia Owner", answer: "Organizer" },
      { key: "2", name: "Sara Malik", answer: "Accepted" },
      { key: "3", name: "Omar Farooq", answer: "Maybe" },
      { key: "4", name: "lena@partner.example", answer: "Outside · email sent" },
    ],
  },
  notes: { label: "Notes", text: "Plan the week. Board: https://plan.example.com/week" },
});
