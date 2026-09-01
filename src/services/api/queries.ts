/** Raw GraphQL documents. Kept apart from transport and normalisation. */

export const MEDIA_FIELDS = `
  id
  idMal
  isAdult
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  description(asHtml: false)
  genres
  episodes
  duration
  seasonYear
  season
  format
  status
  averageScore
  popularity
  source
  siteUrl
  startDate { year month day }
  endDate { year month day }
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode airingAt }
`;

export const SEARCH_QUERY = `
  query Search($q: String, $page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage currentPage }
      media(search: $q, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC], isAdult: $isAdult) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const BROWSE_QUERY = `
  query Browse(
    $page: Int
    $perPage: Int
    $sort: [MediaSort]
    $season: MediaSeason
    $seasonYear: Int
    $status: MediaStatus
    $genre: String
    $isAdult: Boolean
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage currentPage }
      media(
        type: ANIME
        sort: $sort
        season: $season
        seasonYear: $seasonYear
        status: $status
        genre: $genre
        isAdult: $isAdult
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const BY_IDS_QUERY = `
  query ByIds($ids: [Int], $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(id_in: $ids, type: ANIME) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const DETAIL_QUERY = `
  query Detail($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
      relations {
        edges {
          relationType(version: 2)
          node { ${MEDIA_FIELDS} }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 12) {
        nodes {
          mediaRecommendation { ${MEDIA_FIELDS} }
        }
      }
    }
  }
`;

/**
 * Episodes that have already aired, newest first.
 * Without `mediaId_in` it is the worldwide feed; with it, only the user's series.
 */
export const RECENT_AIRINGS_QUERY = `
  query RecentAirings($ids: [Int], $from: Int, $to: Int, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      airingSchedules(
        mediaId_in: $ids
        airingAt_greater: $from
        airingAt_lesser: $to
        sort: TIME_DESC
      ) {
        episode
        airingAt
        media { ${MEDIA_FIELDS} }
      }
    }
  }
`;

/** Imports a public AniList profile — the fast way to fill an empty watchlist. */
export const USER_LIST_QUERY = `
  query UserList($name: String) {
    MediaListCollection(userName: $name, type: ANIME) {
      user { id name avatar { medium } }
      lists {
        name
        entries {
          status
          progress
          repeat
          score(format: POINT_10_DECIMAL)
          startedAt { year month day }
          completedAt { year month day }
          notes
          media { ${MEDIA_FIELDS} }
        }
      }
    }
  }
`;

export const RECOMMENDATIONS_QUERY = `
  query Recos($id: Int) {
    Media(id: $id, type: ANIME) {
      recommendations(sort: RATING_DESC, perPage: 10) {
        nodes {
          mediaRecommendation { ${MEDIA_FIELDS} }
        }
      }
    }
  }
`;
