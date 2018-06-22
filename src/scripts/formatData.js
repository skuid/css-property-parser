/**
 * Takes raw data from MDN, filters out the shorthand properties, and decorates the data with additional properties.
 * Writes the formatted data to FORMATTED_DATA_PATH.
 */
const fs = require('fs-extra');
const path = require('path');
const { css: { properties } } = require('mdn-data');
const ShorthandPropertyClassifierUtils = require('../utils/ShorthandPropertyClassifierUtils');
const PATHS = require('../constants/paths');

const SHORTHAND_FORMATTED_DATA_FILE_NAME = 'shorthand-properties.json';
const formattedData = Object.entries(properties)
// properties that have an array as their computed value, are shorthand properties
  .filter(([, data]) => {
    console.log('computed3a');
    const a = Array.isArray(data.computed);
    console.log('computed3b');
    return a;
  })
  // add the shorthandType property to the data
  .map(([prop, data]) => [
    prop,
    Object.assign({
      shorthandType: ShorthandPropertyClassifierUtils.classifyLonghandProperty(prop, data.syntax),
    }, data),
  ])
  // reduce it down to an object again so we can write it to a file
  .reduce((propertyMap, [property, data]) => Object.assign({ [property]: data }, propertyMap), {});

fs.writeJson(path.join(PATHS.FORMATTED_DATA_PATH, SHORTHAND_FORMATTED_DATA_FILE_NAME), formattedData, { spaces: 2 })
  .then(() => {
    const fdPath = path.join(PATHS.FORMATTED_DATA_PATH, SHORTHAND_FORMATTED_DATA_FILE_NAME);
    console.log(`Successfully formatted data to ${fdPath}`);
  });
