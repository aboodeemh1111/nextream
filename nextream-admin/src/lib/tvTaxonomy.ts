/** Predefined TV show genres (aligned with movie genre options). */
export const TV_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Crime",
  "Drama",
  "Fantasy",
  "Historical",
  "Horror",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "Western",
  "Animation",
  "Documentary",
] as const;

/** Predefined TV show tags for classification. */
export const TV_TAGS = [
  "Award-winning",
  "Family",
  "Kids",
  "Bingeable",
  "Limited Series",
  "Anthology",
  "Based on True Story",
  "Adaptations",
  "Critically Acclaimed",
  "Feel-good",
] as const;

export type TVGenre = (typeof TV_GENRES)[number];
export type TVTag = (typeof TV_TAGS)[number];
