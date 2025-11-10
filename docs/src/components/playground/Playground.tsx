import {useCallback, useEffect, useRef, useState} from 'react';
import Editor, {useMonaco} from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import clsx from 'clsx';
import {useColorMode} from '@docusaurus/theme-common';
import {manifestSchema} from './manifestSchema';
import {sampleManifests, type ProtocolId} from './sampleManifests';
import type {ValidatorResponse} from './workerTypes';
import styles from './Playground.module.css';

const protocolOptions: Array<{label: string; value: ProtocolId}> = [
  {label: 'Data', value: 'data'},
  {label: 'Event', value: 'event'},
  {label: 'API', value: 'api'},
  {label: 'Agent', value: 'agent'},
  {label: 'Semantic', value: 'semantic'},
];

export function Playground() {
  const [protocol, setProtocol] = useState<ProtocolId>('data');
  const [code, setCode] = useState<string>(sampleManifests.data);
  const [validation, setValidation] = useState<ValidatorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const workerRef = useRef<Worker | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const versionRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monacoInstance = useMonaco();
  const monacoRef = useRef<Monaco | null>(null);
  const {colorMode} = useColorMode();

  const applyMarkers = useCallback(
    (payload: ValidatorResponse) => {
      if (!monacoRef.current || !editorRef.current) return;
      const model = editorRef.current.getModel();
      if (!model) return;
      const markerData = payload.markers.map((marker) => ({
        ...marker,
        severity:
          marker.severity === 'error'
            ? monacoRef.current!.MarkerSeverity.Error
            : marker.severity === 'warn'
            ? monacoRef.current!.MarkerSeverity.Warning
            : monacoRef.current!.MarkerSeverity.Info,
      }));
      monacoRef.current.editor.setModelMarkers(model, 'cpms-playground', markerData);
    },
    [],
  );

  useEffect(() => {
    if (!monacoInstance) return;
    monacoRef.current = monacoInstance;
    monacoInstance.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      enableSchemaRequest: false,
      schemas: [
        {
          uri: manifestSchema.$id,
          fileMatch: ['*'],
          schema: manifestSchema,
        },
      ],
    });
    if (validation) applyMarkers(validation);
  }, [monacoInstance, validation, applyMarkers]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./validatorWorker.ts', import.meta.url), {
      type: 'module',
    });
    const worker = workerRef.current;
    worker.onmessage = (event: MessageEvent<ValidatorResponse>) => {
      setLoading(false);
      const payload = event.data;
      if (payload.version !== versionRef.current) return;
      setValidation(payload);
      applyMarkers(payload);
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [applyMarkers]);

  useEffect(() => {
    if (!monacoRef.current) return;
    monacoRef.current.editor.setTheme(colorMode === 'dark' ? 'vs-dark' : 'vs');
  }, [colorMode]);

  const postToWorker = useCallback(
    (source: string) => {
      if (!workerRef.current) return;
      const nextVersion = ++versionRef.current;
      workerRef.current.postMessage({
        type: 'validate',
        code: source,
        protocol,
        version: nextVersion,
      });
      setLoading(true);
    },
    [protocol],
  );

  useEffect(() => {
    postToWorker(code);
  }, [protocol, postToWorker]);

  const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback(
    (value?: string) => {
      const next = value ?? '';
      setCode(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        postToWorker(next);
      }, 250);
    },
    [postToWorker],
  );

  const loadTemplate = () => {
    const template = sampleManifests[protocol];
    setCode(template);
    postToWorker(template);
  };

  return (
    <div className={styles.playground}>
      <div className={styles.toolbar}>
        <div>
          <p className={styles.lede}>Paste any manifest or start from a template. Validation runs in a sandboxed worker using the same protocol packages as the CLI.</p>
        </div>
        <div className={styles.controls}>
          <label className={styles.selectLabel}>
            Protocol
            <select
              className={styles.select}
              value={protocol}
              onChange={(event) => setProtocol(event.target.value as ProtocolId)}>
              {protocolOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={clsx('button button--secondary button--sm', styles.templateButton)} onClick={loadTemplate}>
            Load template
          </button>
        </div>
      </div>

      <div className={styles.surface}>
        <div className={styles.editorPane}>
          <Editor
            height="60vh"
            language="json"
            theme={colorMode === 'dark' ? 'vs-dark' : 'vs'}
            value={code}
            onMount={(editor) => handleEditorMount(editor)}
            onChange={handleChange}
            options={{
              minimap: {enabled: false},
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        </div>
        <aside className={styles.resultsPane}>
          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={clsx(styles.badge, validation?.status === 'ok' ? styles.badgeSuccess : styles.badgeError)}>
                {validation?.status === 'ok' ? 'Valid' : 'Needs attention'}
              </span>
              <span className={styles.elapsed}>{validation ? `${validation.elapsedMs} ms` : '—'}</span>
            </div>
            <dl className={styles.resultMeta}>
              <div>
                <dt>Dataset / Service</dt>
                <dd>{validation?.datasetName ?? '—'}</dd>
              </div>
              <div>
                <dt>Validators</dt>
                <dd>{validation?.validatorsRan ?? 0}</dd>
              </div>
              <div>
                <dt>Issues</dt>
                <dd>{validation?.issues.length ?? 0}</dd>
              </div>
            </dl>
            <div className={styles.tableWrapper}>
              {loading && <p className={styles.muted}>Running validation…</p>}
              {!loading && validation?.issues.length === 0 && (
                <p className={styles.muted}>No issues detected for the selected validators.</p>
              )}
              {!loading && validation?.issues.length ? (
                <table className={styles.issueTable}>
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Path</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.issues.map((issue, index) => (
                      <tr key={`${issue.msg}-${index}`}>
                        <td>
                          <span className={clsx(styles.chip, issue.level === 'error' && styles.chipError, issue.level === 'warn' && styles.chipWarn)}>
                            {issue.level || 'info'}
                          </span>
                        </td>
                        <td className={styles.codeCell}>{issue.path ?? '—'}</td>
                        <td>{issue.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Playground;
