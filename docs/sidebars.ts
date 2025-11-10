import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsible: false,
      items: [
        'getting-started/overview',
        'getting-started/installation',
        'getting-started/first-manifest',
        'getting-started/validation-pipeline',
      ],
    },
    {
      type: 'category',
      label: 'Protocols',
      items: [
        'protocols/data-protocol',
        'protocols/event-protocol',
        'protocols/api-protocol',
        'protocols/agent-protocol',
        'protocols/semantic-protocol',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/cli-guide',
        'guides/publishing-runbook',
        'guides/ci-cd',
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/analytics-stack',
        'examples/manifest-diffing',
        'examples/governance-controls',
      ],
    },
    {
      type: 'category',
      label: 'Playground',
      items: ['playground/playground-architecture'],
    },
  ],
};

export default sidebars;
