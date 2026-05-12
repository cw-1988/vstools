import { test } from './util.js';
import { buildShpSupplementalCandidates } from '../dist/shp-seq-resolver.js';

test({
  label: 'SHP Resolver: extracted zud bundle',
  test: () => {
    const candidates = buildShpSupplementalCandidates(
      'data/launches/Z001U00/Z001U00.SHP',
      'auto'
    );
    const urls = candidates.map((it) => it.url);

    if (urls[0] !== 'data/launches/Z001U00/Z001U00_Battle.SEQ') {
      throw new Error(`Unexpected first candidate: ${urls[0]}`);
    }

    if (!urls.includes('data/launches/Z001U00/Z001U00_Common.SEQ')) {
      throw new Error('Missing common extracted companion');
    }

    if (!urls.includes('data/launches/Z001U00/Z001U00.ZUD')) {
      throw new Error('Missing same-folder zud candidate');
    }
  },
});

test({
  label: 'SHP Resolver: godhands actor shps',
  test: () => {
    const candidates = buildShpSupplementalCandidates(
      'data/launches/godhands/APP_ROOT_MAP_ZONE009.ZND_Actors_Actor_6_Model_SHP/Z009U06_Character_SHP.SHP',
      'battle'
    );
    const urls = candidates.map((it) => it.url);

    if (
      !urls.includes(
        'data/launches/godhands/APP_ROOT_MAP_ZONE009.ZND_Actors_Actor_6_Model_SEQ_Battle/Z009U06.ZUD'
      )
    ) {
      throw new Error('Missing actor battle zud candidate');
    }

    if (
      !urls.includes(
        'data/launches/godhands/CD_ROOT_MAP_Z009U06.ZUD/Z009U06.ZUD'
      )
    ) {
      throw new Error('Missing copied cd-root zud candidate');
    }
  },
});
