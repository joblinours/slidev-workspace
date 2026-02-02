import type { Meta, StoryObj } from "@storybook/vue3-vite";

import "../assets/main.css";
import SlideSidebar from "./SlideSidebar.vue";

const meta: Meta<typeof SlideSidebar> = {
  title: "Preview/SlideSidebar",
  component: SlideSidebar,
  args: {
    title: "Slide Deck",
    githubUrl: "https://github.com/slidevjs/slidev",
    categories: [
      { name: "All", count: 18 },
      { name: "Design", count: 6 },
      { name: "Engineering", count: 8 },
      { name: "Product", count: 4 },
    ],
    selectedCategory: "All",
    searchTerm: "",
    isDark: false,
    variant: "desktop",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["desktop", "drawer"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof SlideSidebar>;

export const Desktop: Story = {};

export const Drawer: Story = {
  args: {
    variant: "drawer",
  },
};
