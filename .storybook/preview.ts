import type { Preview } from "@storybook/react-vite";
import React from "react";
import "../src/index.css"; // Import Tailwind CSS

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "dark",
      values: [
        {
          name: "dark",
          value: "#0a0a0a", // audafact-bg-primary
        },
        {
          name: "light",
          value: "#ffffff",
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: {
            width: "375px",
            height: "667px",
          },
        },
        tablet: {
          name: "Tablet",
          styles: {
            width: "768px",
            height: "1024px",
          },
        },
        desktop: {
          name: "Desktop",
          styles: {
            width: "1024px",
            height: "768px",
          },
        },
      },
    },
  },
  decorators: [
    (Story) =>
      React.createElement(
        "div",
        {
          className:
            "audafact-bg-primary audafact-text-primary min-h-screen p-4",
        },
        React.createElement(Story)
      ),
  ],
};

export default preview;
