/**
 * Takes raw data from MDN, filters out the shorthand properties, and decorates the data with additional properties.
 * Writes the formatted data to FORMATTED_DATA_PATH.
 */
const fs = require('fs-extra');
const path = require('path');

let { css: { properties } } = require('mdn-data');
const PATHS = require('../constants/paths');

const whitelistedProperties = [
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-right',
  'margin-left',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'border',
  'border-color',
  'border-style',
  'border-width',
];

const propertiesTemp = {};
whitelistedProperties.forEach(propName => propertiesTemp[propName] = properties[propName]);
properties = propertiesTemp;

const ALL_PROPERTIES_DATA_FILE_NAME = 'properties.json';
const OUTPUT_FILE = path.join(PATHS.FORMATTED_DATA_PATH, ALL_PROPERTIES_DATA_FILE_NAME);
fs.writeJson(OUTPUT_FILE, properties, { spaces: 2 })
  .then(() => (
    console.log(`Successfully extracted properties to ${OUTPUT_FILE}`)
  ));
