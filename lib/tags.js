module.exports.generateTagsSpec = tags => {
  return tags.map(t => {
    return {
      name: t,
      description: `${t} resource`
    };
  });
};

module.exports.matchingTags = (tagsSpec, path) => {
  return tagsSpec.filter(t => {
    return path.toLowerCase().includes(t.name.toLowerCase());
  }).map(t => t.name);
};
