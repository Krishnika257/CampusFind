const ignoredWords = new Set(['and', 'for', 'from', 'has', 'have', 'into', 'near', 'the', 'this', 'that', 'with', 'your', 'was', 'were']);

function words(value = '') {
  return new Set(
    String(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((word) => !ignoredWords.has(word)) || [],
  );
}

function diceSimilarity(first, second) {
  if (!first.size || !second.size) return 0;
  let overlap = 0;
  for (const word of first) if (second.has(word)) overlap += 1;
  return (2 * overlap) / (first.size + second.size);
}

function textWords(item, fields) {
  return new Set(fields.flatMap((field) => [...words(item[field]) ]));
}

export function rankMatches(source, candidates, limit = 5) {
  const sourceLocation = words(source.location);
  const sourceKeywords = textWords(source, ['title', 'description']);

  return candidates
    .map((item) => {
      let score = 0;
      const reasons = [];
      if (source.category && source.category === item.category) {
        score += 30;
        reasons.push('Same category');
      }

      const locationScore = Math.round(diceSimilarity(sourceLocation, words(item.location)) * 30);
      if (locationScore >= 8) {
        score += locationScore;
        reasons.push('Similar campus location');
      }

      const keywordScore = Math.round(diceSimilarity(sourceKeywords, textWords(item, ['title', 'description'])) * 40);
      if (keywordScore >= 8) {
        score += keywordScore;
        reasons.push('Similar item details');
      }

      return { item, score: Math.min(100, score), reasons };
    })
    .filter((match) => match.score >= 25)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit);
}
