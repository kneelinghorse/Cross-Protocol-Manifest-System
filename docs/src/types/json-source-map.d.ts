declare module 'json-source-map' {
  export interface PointerPosition {
    line: number;
    column: number;
    pos: number;
  }

  export interface PointerInfo {
    key?: PointerPosition;
    keyEnd?: PointerPosition;
    value: PointerPosition;
    valueEnd: PointerPosition;
  }

  export function parse(json: string): {
    data: unknown;
    pointers: Record<string, PointerInfo>;
  };

  const jsonSourceMap: {
    parse: typeof parse;
  };

  export default jsonSourceMap;
}
