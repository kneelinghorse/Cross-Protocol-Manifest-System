import {lazy, Suspense} from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './index.module.css';

const LazyPlayground = lazy(() => import('../../components/playground/Playground'));

export default function PlaygroundPage() {
  return (
    <Layout title="Live Playground" description="Validate manifests in the browser using CPMS protocol packages.">
      <main className="container margin-vert--lg">
        <section className={styles.header}>
          <p className="badge badge--primary">Live</p>
          <h1>Manifest Playground</h1>
          <p>
            Edit manifests, switch between protocols, and watch Monaco highlight validation issues in real time. All logic runs
            inside a dedicated worker so the UI stays responsive.
          </p>
        </section>
        <BrowserOnly fallback={<div className={styles.fallback}>Loading editor…</div>}>
          {() => (
            <Suspense fallback={<div className={styles.fallback}>Preparing playground…</div>}>
              <LazyPlayground />
            </Suspense>
          )}
        </BrowserOnly>
      </main>
    </Layout>
  );
}
