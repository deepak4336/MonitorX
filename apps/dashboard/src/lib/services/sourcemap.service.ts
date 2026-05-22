import { prisma } from '../prisma';

interface StackFrame {
  filename: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  context_line?: string;
  resolved_filename?: string;
  resolved_lineno?: number;
  resolved_colno?: number;
  resolved_function?: string;
}

export async function resolveStackTrace(
  frames: StackFrame[],
  projectId: string,
  release?: string
): Promise<StackFrame[]> {
  if (!frames.length) return frames;

  let releaseId: string | undefined;
  if (release) {
    const rel = await prisma.release.findUnique({
      where: { project_id_version: { project_id: projectId, version: release } },
    });
    releaseId = rel?.id;
  }

  const sourceMaps = await prisma.sourceMap.findMany({
    where: {
      project_id: projectId,
      ...(releaseId ? { release_id: releaseId } : {}),
    },
  });

  if (!sourceMaps.length) return frames;

  return frames.map((frame) => {
    const filename = extractFilename(frame.filename);
    const sm = sourceMaps.find(
      (s) => s.filename === filename || frame.filename.includes(s.filename)
    );
    if (!sm || !frame.lineno || !frame.colno) return frame;

    try {
      const resolved = resolvePosition(sm.content, frame.lineno, frame.colno);
      if (resolved) {
        return {
          ...frame,
          resolved_filename: resolved.source,
          resolved_lineno: resolved.line,
          resolved_colno: resolved.column,
          resolved_function: resolved.name ?? frame.function,
        };
      }
    } catch {}

    return frame;
  });
}

function extractFilename(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split('/').pop() ?? url;
  } catch {
    return url.split('/').pop() ?? url;
  }
}

function resolvePosition(
  sourceMapContent: string,
  line: number,
  column: number
): { source: string; line: number; column: number; name?: string } | null {
  try {
    const sm = JSON.parse(sourceMapContent);
    if (!sm.mappings || !sm.sources) return null;

    const decoded = decodeMappings(sm.mappings);
    const mappingLine = decoded[line - 1];
    if (!mappingLine) return null;

    let closest = mappingLine[0];
    for (const seg of mappingLine) {
      if (seg[0] <= column) closest = seg;
      else break;
    }

    if (!closest || closest.length < 4) return null;

    const source = sm.sources[closest[1]] ?? 'unknown';
    const name = closest[4] !== undefined ? sm.names?.[closest[4]] : undefined;

    return {
      source: source.replace(/^(\.\.\/)+/, '').replace('webpack:///', ''),
      line: closest[2] + 1,
      column: closest[3],
      name,
    };
  } catch {
    return null;
  }
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeVlq(str: string): { value: number; rest: string } {
  let result = 0, shift = 0, i = 0;
  while (i < str.length) {
    const digit = BASE64_CHARS.indexOf(str[i]);
    if (digit === -1) break;
    i++;
    result |= (digit & 0x1f) << shift;
    shift += 5;
    if (!(digit & 0x20)) {
      const negate = result & 1;
      result >>= 1;
      return { value: negate ? -result : result, rest: str.slice(i) };
    }
  }
  return { value: 0, rest: str.slice(i) };
}

function decodeMappings(mappings: string): number[][][] {
  const state = [0, 0, 0, 0, 0];
  return mappings.split(';').map((line) => {
    state[0] = 0;
    if (!line) return [];
    return line.split(',').map((seg) => {
      const fields: number[] = [];
      let rest = seg;
      for (let i = 0; i < 5 && rest.length > 0; i++) {
        const { value, rest: remaining } = decodeVlq(rest);
        rest = remaining;
        state[i] += value;
        fields.push(state[i]);
      }
      return fields;
    });
  });
}