import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  body: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Manifest-First Automation',
    body: (
      <>
        Every artifact—validators, SDKs, migrations, docs—is generated from a
        single JSON manifest, so governance and delivery stay perfectly aligned.
      </>
    ),
  },
  {
    title: 'Zero-Dependency Protocols',
    body: (
      <>
        Packages such as <code>@proto/data</code> and <code>@proto/api</code>{' '}
        inline all helpers at build time, making security reviews and air-gapped
        deployments painless.
      </>
    ),
  },
  {
    title: 'Live Monaco Playground',
    body: (
      <>
        Validate manifests in the browser using the same pure functions shipped
        in the CLI. Monaco + workers keep latency low and highlight issues in
        real time.
      </>
    ),
  },
];

function Feature({title, body}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={clsx(styles.feature, 'text--center')}>
        <Heading as="h3">{title}</Heading>
        <p>{body}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
