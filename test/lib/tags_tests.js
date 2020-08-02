'use strict';

const {generateTagsSpec, matchingTags} = require('../../lib/tags.js');

describe('tags.js', () => {

  describe('generateTagsSpec()', () => {
    it('WHEN tags are supplied THEN should generate specs', () => {
      const tags = ['User', 'Student'];
      const tagsSpec = generateTagsSpec(tags);
      return expect(tagsSpec.map(t => t.name)).toEqual(tags);
    });
  });

  describe('matchingTags()', () => {
    it('WHEN path contains tags THEN it should include them', () => {
      const tags = ['User', 'Student'];
      const tagsSpec = generateTagsSpec(tags);
      const path = '/users/:id';
      const tagsMatchingPath = matchingTags(tagsSpec, path);
      return expect(tagsMatchingPath).toEqual([tags.shift()]);
    });
  });
});