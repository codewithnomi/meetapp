import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AvatarUpload } from "./AvatarUpload.tsx";

const meta = {
  title: "Molecules/AvatarUpload",
  component: AvatarUpload,
  args: {
    name: "Aisha Khan",
    onFile: fn(),
    onRemove: fn(),
    labels: {
      upload: "Upload a photo",
      remove: "Remove",
      hint: "JPEG, PNG or WebP, up to 5 MB. Location details are removed.",
      uploading: "Uploading photo",
    },
  },
} satisfies Meta<typeof AvatarUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const WithPhoto: Story = {
  args: {
    photoUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='88' height='88'><rect width='88' height='88' fill='%2333aa77'/></svg>",
  },
};
export const Loading: Story = { args: { busy: true } };
export const WithError: Story = { args: { error: "Use a JPEG, PNG or WebP image up to 5 MB." } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
