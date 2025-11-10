import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const metrics = [
  {label: 'Hashing', value: '1M+ ops/sec'},
  {label: 'Diff', value: '<10 ms'},
  {label: 'CLI Startup', value: '<500 ms'},
  {label: 'Coverage', value: '100%'},
];

function HomepageHeader(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroContent}>
          <Heading as="h1">{siteConfig.title}</Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <p>
            Describe every dataset, event stream, API, and agent once. CPMS
            keeps manifests immutable, validation deterministic, and automation
            zero-dependency so you can ship faster without governance drift.
          </p>
          <div className={styles.actions}>
            <Link className="button button--primary button--lg" to="/docs/getting-started/overview">
              Explore the Docs
            </Link>
            <Link className="button button--secondary button--lg" to="/playground">
              Open the Playground
            </Link>
          </div>
          <div className={styles.heroMetrics}>
            {metrics.map((metric) => (
              <div key={metric.label} className={styles.metricCard}>
                <div className={styles.metricLabel}>{metric.label}</div>
                <div className={styles.metricValue}>{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Cross-Protocol Manifest System documentation and live playground.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
