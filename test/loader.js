import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const redirects = new Map([
  [
    'https://unpkg.com/three@0.184.0/build/three.module.js',
    'three',
  ],
  [
    'https://unpkg.com/three@0.184.0/examples/jsm/controls/OrbitControls.js',
    'three/addons/controls/OrbitControls.js',
  ],
  [
    'https://unpkg.com/three@0.184.0/examples/jsm/exporters/OBJExporter.js',
    'three/addons/exporters/OBJExporter.js',
  ],
  [
    'https://unpkg.com/three@0.184.0/examples/jsm/helpers/VertexNormalsHelper.js',
    'three/addons/helpers/VertexNormalsHelper.js',
  ],
]);

export function resolve(specifier, context, defaultResolve) {
  return defaultResolve(
    redirects.get(specifier) || specifier,
    context,
    defaultResolve
  );
}

export function getFormat(url, context, defaultGetFormat) {
  if (url.match(/node_modules\/three\//)) {
    return {
      format: 'module',
    };
  }

  return defaultGetFormat(url, context, defaultGetFormat);
}

export async function load(url, context, defaultLoad) {
  if (url.match(/node_modules\/three\/.*\.js$/)) {
    return {
      format: 'module',
      source: await readFile(fileURLToPath(url), 'utf8'),
      shortCircuit: true,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
