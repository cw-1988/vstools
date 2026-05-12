type SeqPreference = 'auto' | 'battle' | 'common';
type SequenceKind = 'battle' | 'common';

export type ShpSupplementalCandidate = {
  kind: SequenceKind;
  label: string;
  source: 'seq' | 'zud';
  url: string;
};

export function buildShpSupplementalCandidates(
  url: string,
  preference: SeqPreference
): ShpSupplementalCandidate[] {
  if (!url.match(/\.shp$/i)) return [];

  const kinds = preferredSequenceKinds(preference);
  const candidates: ShpSupplementalCandidate[] = [];
  const seen = new Set<string>();

  const dir = dirname(url);
  const fileName = basename(url);
  const stem = stripExt(fileName);
  const base = url.slice(0, -4);
  const zudStem = extractZudStem(stem);
  const folderName = basename(dir);
  const launchRoot = dirname(dir);

  const addCandidate = (
    kind: SequenceKind,
    source: 'seq' | 'zud',
    candidateUrl: string,
    label: string
  ) => {
    const key = `${source}:${kind}:${candidateUrl}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      kind,
      label,
      source,
      url: candidateUrl,
    });
  };

  for (const kind of kinds) {
    addCandidate(
      kind,
      'seq',
      `${base}_${kind === 'battle' ? 'Battle' : 'Common'}.SEQ`,
      `${kind} (same folder)`
    );
  }

  for (const kind of kinds) {
    if (kind === 'common') {
      addCandidate(
        kind,
        'seq',
        joinPath(dir, `${stem}_COM.SEQ`),
        'common (OBJ companion)'
      );
    }
  }

  if (zudStem) {
    for (const kind of kinds) {
      addCandidate(
        kind,
        'zud',
        joinPath(dir, `${zudStem}.ZUD`),
        `${kind} (same folder zud)`
      );
    }
  }

  if (folderName.endsWith('_Model_SHP') && zudStem) {
    const folderPrefix = folderName.slice(0, -'_Model_SHP'.length);

    for (const kind of kinds) {
      const seqFolder = `${folderPrefix}_Model_SEQ_${
        kind === 'battle' ? 'Battle' : 'Common'
      }`;
      addCandidate(
        kind,
        'zud',
        joinPath(joinPath(launchRoot, seqFolder), `${zudStem}.ZUD`),
        `${kind} (actor seq zud)`
      );
    }
  }

  if (zudStem && zudStem.match(/^Z[0-9A-F]{3}U[0-9A-F]{2}$/i)) {
    for (const kind of kinds) {
      addCandidate(
        kind,
        'zud',
        joinPath(
          joinPath(launchRoot, `CD_ROOT_MAP_${zudStem}.ZUD`),
          `${zudStem}.ZUD`
        ),
        `${kind} (cd root zud)`
      );
    }
  }

  return candidates;
}

function preferredSequenceKinds(preference: SeqPreference): SequenceKind[] {
  if (preference === 'common') return ['common', 'battle'];
  return ['battle', 'common'];
}

function extractZudStem(stem: string): string | null {
  const match = stem.match(/^(Z[0-9A-F]{3}U[0-9A-F]{2})/i);
  return match ? match[1] : null;
}

function dirname(value: string): string {
  const index = value.lastIndexOf('/');
  return index >= 0 ? value.slice(0, index) : '';
}

function basename(value: string): string {
  const index = value.lastIndexOf('/');
  return index >= 0 ? value.slice(index + 1) : value;
}

function stripExt(value: string): string {
  const index = value.lastIndexOf('.');
  return index >= 0 ? value.slice(0, index) : value;
}

function joinPath(left: string, right: string): string {
  if (!left) return right;
  return `${left}/${right}`;
}
