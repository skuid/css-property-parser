const CaseConverterUtils = require('../utils/CaseConverterUtils');
const fs = require('fs-extra');
const PATHS = require('../constants/paths');
const GRAMMAR_CONSTANTS = require('../constants/grammars');
const OhmGrammarFormatterTest = require('../../test/formatters/OhmGrammarFormatterTest');

const BASE_GRAMMAR_FORMATTER_MAP = {
  [GRAMMAR_CONSTANTS.LEXICAL_BASE_KEY]: 'exp',
  [GRAMMAR_CONSTANTS.SYNTACTIC_BASE_KEY]: 'Exp',
};

/**
 * Class to format a JSON Grammar into an Ohm Grammar
 * @type {OhmGrammarFormatter}
 */
module.exports = class OhmGrammarFormatter {
  /**
   * Given a JSON grammar format it into an Ohm Grammar string. This function, recursively resolves grammar
   * rules defined in the given json grammar. Any intermediate grammar rules are prefixed with the file name in order
   * to avoid rule name collisions between recursively resolved grammar rules.
   * <p>
   * @see {@link https://github.com/harc/ohm/blob/master/doc/syntax-reference.md|Ohm Syntax}
   * for more information on Ohm Syntax.
   * @see {@link OhmGrammarFormatterTest} for examples usage.
   *
   * @param {Array} jsonGrammar - json structure representing a grammar
   * @param {string} grammarName - the name of the grammar. Will be used as the name in the outputted Ohm grammar.
   * @returns {string} - the formatted Ohm Grammar string
   */
  static formatOhmGrammarFromJson(jsonGrammar, grammarName) {
    OhmGrammarFormatter._isGrammarValid(jsonGrammar);

    // get the file name for each grammar that needs to be pulled into this grammar. Grab the files for those
    // jsonGrammars and pull in the rule definitions in those jsonGrammars.
    const recursivelyResolvedGrammars = OhmGrammarFormatter
      ._getGrammarsToResolve(jsonGrammar)
      .map(fileToResolve => [fileToResolve, fs.readJsonSync(`${PATHS.JSON_GRAMMAR_PATH}${fileToResolve}.json`)])
      .filter(([, json]) => OhmGrammarFormatter._isGrammarValid(json))
      .map(([fileName, jsonGrammar]) => [CaseConverterUtils.formalSyntaxIdentToOhmIdent(`<${fileName}>`), jsonGrammar])
      .map(([grammarName, jsonGrammar]) => (
        [grammarName, OhmGrammarFormatter._prefixIntermediateGrammarRules(grammarName, jsonGrammar)]
      ))
      .map(([grammarName, json]) => json
        .filter(grammarPair => grammarPair.length === 2) // filter out any jsonGrammars that need resolution
        .map(([ruleName, ruleBody]) => (Object.keys(BASE_GRAMMAR_FORMATTER_MAP).includes(ruleName)
          ? [grammarName, ruleBody]
          : [ruleName, ruleBody])));
    const [[baseKey, baseValue], ...otherRules] = OhmGrammarFormatter
      ._prefixIntermediateGrammarRules(grammarName, jsonGrammar);
    // the base key for this grammar should be mapped to exp or Exp, then concat the rest of the rules and
    // format them into Ohm syntax. i.e <ruleName> = <ruleBody>.
    const ohmGrammarBody = [[BASE_GRAMMAR_FORMATTER_MAP[baseKey], baseValue]]
      .concat(otherRules.filter(rule => rule.length === 2)) // add any rules that don't need to be resolved
      .concat(...recursivelyResolvedGrammars) // add all the rules we resolved
      .map(([ruleName, ruleBody]) => (
        `  ${ruleName} = ${OhmGrammarFormatter._formatJsonRuleBody(ruleBody)}`
      ))
      .join('\n');

    return `${grammarName} {\n${ohmGrammarBody}\n}`;
  }

  /**
   * Given a json grammar recursively finds all additional jsonGrammars that the grammar depends on. Returns a set
   * of unique file names indicating which jsonGrammars need to be resolved.
   *
   * @param {Array} jsonGrammar - a json structure representing a grammar
   * @returns {Array} - a set of unique file names indicating which json grammars need to resolved.
   * @private
   */
  static _getGrammarsToResolve(jsonGrammar) {
    const resolutions = jsonGrammar
      .filter(grammarLine => grammarLine.length === 1)
      .map(([grammarName]) => GRAMMAR_CONSTANTS.R_GRAMMAR_IDENT.exec(grammarName)[1]);

    if (resolutions.length === 0) {
      return [];
    }

    return [...new Set(resolutions.concat(
      ...resolutions
        .map(file => fs.readJsonSync(`${PATHS.JSON_GRAMMAR_PATH}${file}.json`))
        .map(OhmGrammarFormatter._getGrammarsToResolve)))];
  }

  /**
   * Given a grammarName and a json grammar, prefixes all the intermediate rule names with the grammar name.
   * This is necessary in order to prevent rule name conflicts when recursively resolving grammars.
   * <p>
   * For example, two grammars 'a' and 'b' may contain a rule named 'foo'. If another grammar uses both 'a' and 'b'
   * we need to differentiate between the rule 'foo' defined in both 'a' and 'b'. Thus we prefix 'foo' for both grammars
   * and rename the rules 'a_foo' and 'b_foo'.
   *
   * @param {string} grammarName - the name of the given json grammar. This should be a camelCase name.
   * @param {Array} jsonGrammar - the json grammar to be prefixed
   * @returns {Array} - the prefixed json grammar
   * @private
   */
  static _prefixIntermediateGrammarRules(grammarName, jsonGrammar) {
    // prefix all rules that we don't need to recursively resolve and are not base rules
    const ruleNamesToPrefix = jsonGrammar
      .filter(rule => rule.length === 2)
      .filter(([ruleName]) => !Object.keys(BASE_GRAMMAR_FORMATTER_MAP).includes(ruleName))
      .map(([ruleName]) => (
        `(?:[^a-z"](${ruleName})$|^(${ruleName})[^a-z"]|^(${ruleName})$|[^a-z"](${ruleName})[^a-z"])`
      ));

    // iterate through all the rules and replace rule name/rule body with prefixed rule names
    if (ruleNamesToPrefix.length) {
      const ruleNamesToPrefixRegex = new RegExp(`${ruleNamesToPrefix.join('|')}`, 'g');

      return jsonGrammar
        .filter(rule => rule.length === 2)
        .map(rule => rule.map(rulePart => rulePart
          .replace(ruleNamesToPrefixRegex, (completeMatch, ...ruleNameMatches) => {
            const ruleName = ruleNameMatches.find(Boolean);
            return completeMatch.replace(ruleName, OhmGrammarFormatter._prefixRuleName(grammarName, ruleName));
          })));
    }

    return jsonGrammar;
  }

  /**
   * Prefixes the given rule name with the grammar name.
   * @param {string} grammarName - the grammar name
   * @param {string} ruleName - the rule name
   * @returns {string} - the prefixed rule name
   * @private
   */
  static _prefixRuleName(grammarName, ruleName) {
    return `${grammarName}_${ruleName}`;
  }

  /**
   * Formats the given rule body into a string that is compatible with Ohm.
   *
   * @param {string} ruleBody - the JSON grammar body
   * @returns {string} - the formatted rule body
   * @private
   */
  static _formatJsonRuleBody(ruleBody) {
    return CaseConverterUtils.formalSyntaxIdentToOhmIdent(ruleBody);
  }

  /**
   * Given a grammar json, checks if the grammar is valid.
   *
   * @param {Object} jsonGrammar - a json structure representing a grammar.
   * @returns {boolean} - returns true if given grammar is valid, else throws an error
   * @private
   */
  static _isGrammarValid(jsonGrammar) {
    if (!Array.isArray(jsonGrammar)) {
      throw new Error(`Invalid grammar. Grammar must be a 2-dimensional array:\n${jsonGrammar}`);
    } else if (!jsonGrammar.length) {
      throw new Error(`Invalid grammar. Grammar must be of length >= 1:\n${jsonGrammar}`);
    } else if (!jsonGrammar[0].length || !Object.keys(BASE_GRAMMAR_FORMATTER_MAP).includes(jsonGrammar[0][0])) {
      throw new Error(`Invalid grammar. Grammar must include base key:\n${jsonGrammar}`);
    }

    return true;
  }
};
